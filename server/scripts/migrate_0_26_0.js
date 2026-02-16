const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const alterTable = () => {
    db.serialize(() => {
        // Add resetPasswordToken
        db.run(`ALTER TABLE Users ADD COLUMN resetPasswordToken TEXT`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('Column resetPasswordToken already exists.');
                } else {
                    console.error('Error adding resetPasswordToken:', err.message);
                }
            } else {
                console.log('Added column resetPasswordToken.');
            }
        });

        // Add resetPasswordExpires
        db.run(`ALTER TABLE Users ADD COLUMN resetPasswordExpires DATETIME`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('Column resetPasswordExpires already exists.');
                } else {
                    console.error('Error adding resetPasswordExpires:', err.message);
                }
            } else {
                console.log('Added column resetPasswordExpires.');
            }
        });
    });

    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
    });
};

console.log('Starting migration for version 0.26.0...');
alterTable();
