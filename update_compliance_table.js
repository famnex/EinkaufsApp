const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
console.log('Opening database:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    db.all("PRAGMA table_info(ComplianceReports);", (err, rows) => {
        if (err) {
            console.error('Error reading table info:', err);
            // Logic to handle missing table if needed
            db.close();
            return;
        }

        const columnExists = rows && rows.some(row => row.name === 'screenshotPath');
        if (columnExists) {
            console.log('Column screenshotPath already exists.');
            db.close();
        } else {
            console.log('Adding screenshotPath column...');
            db.run("ALTER TABLE ComplianceReports ADD COLUMN screenshotPath TEXT;", (err) => {
                if (err) {
                    console.error('Error adding column:', err.message);
                } else {
                    console.log('Column screenshotPath added successfully.');
                }
                db.close();
            });
        }
    });
});
