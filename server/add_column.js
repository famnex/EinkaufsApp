const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Check if column exists first to avoid error
    db.run("ALTER TABLE ListItems ADD COLUMN unit TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column already exists.');
            } else {
                console.error('Error adding column:', err.message);
            }
        } else {
            console.log('Column "unit" added successfully.');
        }
    });
});

db.close();
