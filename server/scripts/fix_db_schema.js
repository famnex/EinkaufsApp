const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Database Repair Tool ---');
console.log('Database:', dbPath);

const columnsToCheck = [
    { table: 'Users', name: 'email', type: 'TEXT', def: "''" }, // temporary default empty
    { table: 'Users', name: 'newsletterSignedUp', type: 'BOOLEAN', def: '0' },
    { table: 'Users', name: 'newsletterSignupDate', type: 'DATETIME', def: 'NULL' },
    { table: 'Users', name: 'bannedAt', type: 'DATETIME', def: 'NULL' },
    { table: 'Users', name: 'resetPasswordToken', type: 'TEXT', def: 'NULL' },
    { table: 'Users', name: 'resetPasswordExpires', type: 'DATETIME', def: 'NULL' }
];

db.serialize(() => {
    columnsToCheck.forEach(col => {
        db.run(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`[OK] ${col.table}.${col.name} exists.`);
                } else {
                    console.error(`[ERROR] Failed to add ${col.table}.${col.name}:`, err.message);
                }
            } else {
                console.log(`[FIXED] Added column ${col.table}.${col.name}`);
            }
        });
    });

    // Diagnositic: Print Users
    console.log('\n--- User Audit ---');
    db.all("SELECT id, username, email FROM Users", (err, rows) => {
        if (err) {
            console.error('Failed to read users:', err);
        } else {
            console.log(`Found ${rows.length} users.`);
            rows.forEach(row => {
                console.log(`ID: ${row.id} | User: ${row.username} | Email: ${row.email || 'NULL'} (Set this if NULL!)`);
            });
        }
    });
});

db.close(() => console.log('\nDone.'));
