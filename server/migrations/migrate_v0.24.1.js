const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Resolve path to database
const dbPath = path.resolve(__dirname, '../database.sqlite');
console.log('Opening database:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

// Use db.serialize to ensure sequential execution
db.serialize(() => {
    // Check columns in Users table
    db.all("PRAGMA table_info(Users);", (err, rows) => {
        if (err) {
            console.error('Error reading table info:', err.message);
            db.close();
            return;
        }

        const newsletterSignedUpExists = rows.some(row => row.name === 'newsletterSignedUp');
        const newsletterSignupDateExists = rows.some(row => row.name === 'newsletterSignupDate');

        if (newsletterSignedUpExists && newsletterSignupDateExists) {
            console.log('Migration v0.24.1 skipped: Newsletter columns already exist.');
            db.close();
            return;
        }

        console.log('Migration v0.24.1 started: Adding newsletter columns...');

        db.serialize(() => {
            if (!newsletterSignedUpExists) {
                db.run("ALTER TABLE Users ADD COLUMN newsletterSignedUp BOOLEAN DEFAULT 0;", (err) => {
                    if (err) console.error('Error adding newsletterSignedUp:', err.message);
                    else console.log('Added column newsletterSignedUp.');
                });
            }

            if (!newsletterSignupDateExists) {
                db.run("ALTER TABLE Users ADD COLUMN newsletterSignupDate DATE;", (err) => {
                    if (err) console.error('Error adding newsletterSignupDate:', err.message);
                    else console.log('Added column newsletterSignupDate.');
                });
            }

            // Close after all operations are drafted
            db.close((err) => {
                if (err) console.error('Error closing database:', err.message);
                else console.log('Migration v0.24.1 completed.');
            });
        });
    });
});
