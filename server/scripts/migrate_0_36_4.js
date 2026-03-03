const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Migration v0.36.4 ---');
console.log('Database:', dbPath);

db.serialize(() => {
    // 1. Create SentPushNotifications table
    db.run(`CREATE TABLE IF NOT EXISTS SentPushNotifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        recipientCount INTEGER DEFAULT 0,
        successCount INTEGER DEFAULT 0,
        failureCount INTEGER DEFAULT 0,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
    )`, (err) => {
        if (err) {
            console.error("[ERROR] Failed to create SentPushNotifications table:", err.message);
        } else {
            console.log("[FIXED] SentPushNotifications table ensured.");
        }
    });

    // 2. Ensure PushSubscriptions table exists
    db.run(`CREATE TABLE IF NOT EXISTS PushSubscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        UserId INTEGER,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        FOREIGN KEY (UserId) REFERENCES Users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error("[ERROR] Failed to ensure PushSubscriptions table:", err.message);
        } else {
            console.log("[OK] PushSubscriptions table ensured.");
        }
    });

    // 3. Ensure Users columns for push (redundancy check)
    const columnsToEnsure = [
        { name: 'followNotificationsEnabled', type: 'BOOLEAN DEFAULT 1' },
        { name: 'lastFollowedUpdatesCheck', type: 'DATETIME' }
    ];

    columnsToEnsure.forEach(col => {
        db.run(`ALTER TABLE Users ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`[OK] Users.${col.name} already exists.`);
                } else {
                    console.error(`[ERROR] Failed to add Users.${col.name}:`, err.message);
                }
            } else {
                console.log(`[FIXED] Added column Users.${col.name}`);
            }
        });
    });
});

db.close(() => console.log('Migration v0.36.4 done.'));
