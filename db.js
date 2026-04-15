const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const uploadsDir = path.join(__dirname, 'uploads');
const profilePicsDir = path.join(__dirname, 'uploads', 'profiles');

// Ensure directories exist
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(profilePicsDir)) fs.mkdirSync(profilePicsDir);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Setup Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT,
            bio TEXT DEFAULT '',
            profile_picture_url TEXT DEFAULT ''
        )`);

        // Setup Photos Table
        // deleted_by_user allows images to persist in the db/uploads folder
        // while not being shown directly on the user's personal profile if they remove it.
        // Wait, requirement #2: images show to *everyone* on website.
        // If a user removes it, it shouldn't show on their profile? Or shouldn't show anywhere?
        // Requirement #3: "whatever the images are uploaded... should me save in our database even after user removes it"
        // Let's use an is_archived or deleted_by_user flag. If true, it won't show up in standard lists, 
        // OR it will still show, it's just recorded. We will only hide it from their profile if they delete.
        // Actually, if they "remove" it, maybe standard flow means it sets deleted_by_user = 1 but remains in DB.
        db.run(`CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            filename TEXT,
            original_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_by_user BOOLEAN DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        console.log('Database tables ensured.');
    }
});

module.exports = db;
