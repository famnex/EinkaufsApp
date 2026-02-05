const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Add is_eating_out column to Menus table
    db.run("ALTER TABLE Menus ADD COLUMN is_eating_out BOOLEAN DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column "is_eating_out" already exists.');
            } else {
                console.error('Error adding column:', err.message);
            }
        } else {
            console.log('Column "is_eating_out" added successfully.');
        }
    });
});

db.close();
