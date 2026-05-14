require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { User, Photo, dbConnect } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'afterglow_super_secret_key_2026';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB Connection Middleware for API routes
app.use('/api', async (req, res, next) => {
    try {
        await dbConnect();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Firebase Admin if credentials are available
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const firebaseServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(firebaseServiceAccount) });
        console.log('Firebase Admin initialized');
    } catch (err) {
        console.warn('Failed to initialize Firebase Admin:', err.message);
    }
} else {
    console.warn('FIREBASE_SERVICE_ACCOUNT not set; Firebase authentication endpoint disabled.');
}

// Multer Storage Configuration (Cloudinary)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folderName = 'photo-gallery/uploads';
        if (file.fieldname === 'profilePic') {
            folderName = 'photo-gallery/profiles';
        }
        return {
            folder: folderName,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
        };
    }
});
const upload = multer({ storage });

// JWT Middleware
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized!' });
        req.userId = decoded.id;
        next();
    });
};

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const newUser = await User.create({ username, email, password_hash: hash });

        const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: 86400 });
        res.json({ message: 'Registered successfully', token, user: { id: newUser._id, username, email } });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { login, password } = req.body;

    try {
        const user = await User.findOne({ $or: [{ username: login }, { email: login }] });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: 86400 });
        res.json({ message: 'Login successful', token, user: { id: user._id, username: user.username, email: user.email, profile_picture_url: user.profile_picture_url } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/firebase', async (req, res) => {
    console.log('Firebase auth endpoint called', req.method, req.path);
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'No Firebase ID token provided' });
    if (!admin.apps.length) return res.status(500).json({ error: 'Firebase Admin is not configured' });

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (!decodedToken.email) return res.status(400).json({ error: 'Firebase user email is required' });

        let user = await User.findOne({ email: decodedToken.email });
        if (!user) {
            const baseUsername = decodedToken.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'user';
            let username = baseUsername;
            let count = 1;
            while (await User.findOne({ username })) {
                username = `${baseUsername}${count++}`;
            }

            user = await User.create({
                username,
                email: decodedToken.email,
                password_hash: bcrypt.hashSync(Math.random().toString(36).slice(-16), 10),
                profile_picture_url: decodedToken.picture || ''
            });
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: 86400 });
        res.json({ message: 'Firebase login successful', token, user: { id: user._id, username: user.username, email: user.email, profile_picture_url: user.profile_picture_url } });
    } catch (err) {
        console.error('Firebase auth error:', err);
        res.status(401).json({ error: 'Failed to verify Firebase token' });
    }
});

// --- USER ROUTES ---

app.get('/api/user/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('username email bio profile_picture_url');
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/user/public/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).select('username bio profile_picture_url');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users/search', async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) return res.json([]);
        const users = await User.find({ username: { $regex: q, $options: 'i' } })
            .select('username profile_picture_url')
            .limit(10);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/user/profile', verifyToken, upload.single('profilePic'), async (req, res) => {
    const { username, bio } = req.body;

    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Multer-storage-cloudinary returns the URL in req.file.path
        const profilePic = req.file ? req.file.path : null;
        const newPicUrl = profilePic || user.profile_picture_url;

        user.username = username || user.username;
        user.bio = bio !== undefined ? bio : user.bio;
        user.profile_picture_url = newPicUrl;

        await user.save();
        res.json({ message: 'Profile updated', profile_picture_url: newPicUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// --- PHOTO ROUTES ---

// Upload photo
app.post('/api/photos', verifyToken, upload.single('photo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    try {
        // req.file.path contains the secure Cloudinary URL
        const newPhoto = await Photo.create({
            user_id: req.userId,
            filename: req.file.path,
            original_name: req.file.originalname
        });

        res.json({ message: 'Photo uploaded successfully', photo_id: newPhoto._id, src: req.file.path });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get all photos
app.get('/api/photos', async (req, res) => {
    try {
        const photos = await Photo.find({ deleted_by_user: false })
            .populate('user_id', 'username')
            .sort({ created_at: -1 })
            .lean();

        // Map to expected format
        const formattedPhotos = photos.map(p => ({
            id: p._id,
            src: p.filename,
            title: p.original_name,
            date: p.created_at,
            username: p.user_id ? p.user_id.username : "Unknown"
        }));

        res.json(formattedPhotos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get logged in user's photos
app.get('/api/photos/me', verifyToken, async (req, res) => {
    try {
        const photos = await Photo.find({ user_id: req.userId, deleted_by_user: false })
            .sort({ created_at: -1 })
            .lean();

        const formattedPhotos = photos.map(p => ({
            id: p._id,
            src: p.filename,
            title: p.original_name,
            date: p.created_at
        }));

        res.json(formattedPhotos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/photos/public/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const photos = await Photo.find({ user_id: user._id, deleted_by_user: false })
            .sort({ created_at: -1 })
            .lean();

        const formattedPhotos = photos.map(p => ({
            id: p._id,
            src: p.filename,
            title: p.original_name,
            date: p.created_at
        }));

        res.json(formattedPhotos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// "Delete" photo (Soft delete)
app.delete('/api/photos/:id', verifyToken, async (req, res) => {
    try {
        const photo = await Photo.findOneAndUpdate(
            { _id: req.params.id, user_id: req.userId },
            { deleted_by_user: true }
        );

        if (!photo) return res.status(404).json({ error: 'Photo not found or unauthorized' });
        res.json({ message: 'Photo removed from your profile (still archived in DB)' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// API 404 handler
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// Serve static HTML/CSS/JS from root
app.use(express.static(__dirname));

// Serve frontend fallback for SPA
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
