require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { User, Photo, dbConnect } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'afterglow_super_secret_key_2026';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static HTML/CSS/JS from root 
app.use(express.static(__dirname));

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

// Serve frontend fallback for SPA
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
