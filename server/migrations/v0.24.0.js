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
    // Check if table exists
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='ComplianceReports';", (err, tables) => {
        if (err) {
            console.error('Error checking for table:', err.message);
            db.close();
            return;
        }

        if (tables.length === 0) {
            console.log('Table ComplianceReports does not exist (will be created by app start). existing migration.');
            db.close();
            return;
        }

        // Check columns
        db.all("PRAGMA table_info(ComplianceReports);", (err, rows) => {
            if (err) {
                console.error('Error reading table info:', err.message);
                db.close();
                return;
            }

            const columnExists = rows.some(row => row.name === 'screenshotPath');
            if (columnExists) {
                console.log('Migration v0.24.0 skipped: Column screenshotPath already exists.');
            } else {
                console.log('Migration v0.24.0 started: Adding screenshotPath column...');
                db.run("ALTER TABLE ComplianceReports ADD COLUMN screenshotPath TEXT;", (err) => {
                    if (err) {
                        console.error('Error adding column:', err.message);
                    } else {
                        console.log('Migration v0.24.0 success: Column screenshotPath added.');
                    }
                });
            }
            // Close inside callback to ensure it happens after query
            db.close();
        });
    });
});
