const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'afterglow_super_secret_key_2026'; // In prod, use environment variable

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve static HTML/CSS/JS from root (excluding node_modules is handled implicitly if not hit)
app.use(express.static(__dirname));

// Multer Storage Configurations
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'profilePic') {
            cb(null, 'uploads/profiles');
        } else {
            cb(null, 'uploads');
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
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

app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

    const hash = bcrypt.hashSync(password, 10);

    db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, hash], function(err) {
        if (err) return res.status(400).json({ error: 'Username or email already exists' });
        
        const token = jwt.sign({ id: this.lastID }, JWT_SECRET, { expiresIn: 86400 });
        res.json({ message: 'Registered successfully', token, user: { id: this.lastID, username, email } });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { login, password } = req.body; // login can be email or username
    
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [login, login], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });

        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: 86400 });
        res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, email: user.email, profile_picture_url: user.profile_picture_url } });
    });
});

// --- USER ROUTES ---

app.get('/api/user/me', verifyToken, (req, res) => {
    db.get('SELECT id, username, email, bio, profile_picture_url FROM users WHERE id = ?', [req.userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

app.post('/api/user/profile', verifyToken, upload.single('profilePic'), (req, res) => {
    const { username, bio } = req.body;
    const profilePic = req.file ? `/uploads/profiles/${req.file.filename}` : null;

    db.get('SELECT profile_picture_url FROM users WHERE id = ?', [req.userId], (err, user) => {
        const newPicUrl = profilePic || user.profile_picture_url;
        
        db.run('UPDATE users SET username = COALESCE(?, username), bio = COALESCE(?, bio), profile_picture_url = ? WHERE id = ?', 
        [username, bio, newPicUrl, req.userId], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update user' });
            res.json({ message: 'Profile updated', profile_picture_url: newPicUrl });
        });
    });
});

// --- PHOTO ROUTES ---

// Upload photo
app.post('/api/photos', verifyToken, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    db.run('INSERT INTO photos (user_id, filename, original_name) VALUES (?, ?, ?)', 
    [req.userId, `/uploads/${req.file.filename}`, req.file.originalname], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Photo uploaded successfully', photo_id: this.lastID, src: `/uploads/${req.file.filename}` });
    });
});

// Get all photos (Global Feed - only showing non-deleted by default, or all if we want to show all. 
// "whatever images users are uploading that images shows to everyone... save in our database even after user removes it"
// So we will hide it if deleted_by_user = 1)
app.get('/api/photos', (req, res) => {
    const query = `
        SELECT p.id, p.filename as src, p.original_name as title, p.created_at as date, u.username 
        FROM photos p 
        JOIN users u ON p.user_id = u.id 
        WHERE p.deleted_by_user = 0 
        ORDER BY p.created_at DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get logged in user's photos
app.get('/api/photos/me', verifyToken, (req, res) => {
    const query = `
        SELECT p.id, p.filename as src, p.original_name as title, p.created_at as date 
        FROM photos p 
        WHERE p.user_id = ? AND p.deleted_by_user = 0 
        ORDER BY p.created_at DESC
    `;
    db.all(query, [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// "Delete" photo (Soft delete to satisfy condition 3)
app.delete('/api/photos/:id', verifyToken, (req, res) => {
    db.run('UPDATE photos SET deleted_by_user = 1 WHERE id = ? AND user_id = ?', 
    [req.params.id, req.userId], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Photo not found or unauthorized' });
        res.json({ message: 'Photo removed from your profile (still archived in DB)' });
    });
});

// Serve frontend fallback for SPA (or just specific pages)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
