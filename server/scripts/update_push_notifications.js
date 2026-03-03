const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Push Notifications DB Update ---');
console.log('Database:', dbPath);

db.serialize(() => {
    // 1. Add pushEnabled to Users
    db.run("ALTER TABLE Users ADD COLUMN pushEnabled BOOLEAN DEFAULT 1", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log("[OK] Users.pushEnabled already exists.");
            } else {
                console.error("[ERROR] Failed to add Users.pushEnabled:", err.message);
            }
        } else {
            console.log("[FIXED] Added column Users.pushEnabled");
        }
    });

    // 2. Add followNotificationsEnabled to Users
    db.run("ALTER TABLE Users ADD COLUMN followNotificationsEnabled BOOLEAN DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log("[OK] Users.followNotificationsEnabled already exists.");
            } else {
                console.error("[ERROR] Failed to add Users.followNotificationsEnabled:", err.message);
            }
        } else {
            console.log("[FIXED] Added column Users.followNotificationsEnabled");
        }
    });

    // 3. Add lastFollowedUpdatesCheck to Users
    db.run("ALTER TABLE Users ADD COLUMN lastFollowedUpdatesCheck DATETIME", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log("[OK] Users.lastFollowedUpdatesCheck already exists.");
            } else {
                console.error("[ERROR] Failed to add Users.lastFollowedUpdatesCheck:", err.message);
            }
        } else {
            console.log("[FIXED] Added column Users.lastFollowedUpdatesCheck");
        }
    });

    // 4. Create PushSubscriptions table
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
            console.error("[ERROR] Failed to create PushSubscriptions table:", err.message);
        } else {
            console.log("[FIXED] PushSubscriptions table ensured.");
        }
    });

    // 5. Verify
    db.all("PRAGMA table_info(Users)", (err, rows) => {
        if (err) {
            console.error("Failed to verify Users table:", err);
        } else {
            const hasPush = rows.some(r => r.name === 'pushEnabled');
            const hasFollow = rows.some(r => r.name === 'followNotificationsEnabled');
            console.log(hasPush ? "[VERIFIED] Users.pushEnabled is present." : "[FAILED] Users.pushEnabled is MISSING.");
            console.log(hasFollow ? "[VERIFIED] Users.followNotificationsEnabled is present." : "[FAILED] Users.followNotificationsEnabled is MISSING.");
        }
    });
});

db.close(() => console.log('Done.'));
