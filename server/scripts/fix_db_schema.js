const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
console.log('Opening DB:', dbPath);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Create ProductRelations table
    console.log('Creating ProductRelations table...');
    db.run(`
        CREATE TABLE IF NOT EXISTS ProductRelations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            StoreId INTEGER NOT NULL REFERENCES Stores(id) ON DELETE CASCADE ON UPDATE CASCADE,
            PredecessorId INTEGER NOT NULL REFERENCES Products(id) ON DELETE CASCADE ON UPDATE CASCADE,
            SuccessorId INTEGER NOT NULL REFERENCES Products(id) ON DELETE CASCADE ON UPDATE CASCADE,
            weight INTEGER DEFAULT 1,
            createdAt DATETIME NOT NULL,
            updatedAt DATETIME NOT NULL,
            UNIQUE(StoreId, PredecessorId, SuccessorId)
        );
    `, (err) => {
        if (err) console.error('Error creating table:', err.message);
        else console.log('Table ProductRelations checked/created.');
    });

    // 2. Add bought_at to ListItems
    console.log('Adding bought_at to ListItems...');
    db.run(`ALTER TABLE ListItems ADD COLUMN bought_at DATETIME;`, (err) => {
        if (err && err.message.includes('duplicate column name')) {
            console.log('Column bought_at already exists.');
        } else if (err) {
            console.error('Error adding column:', err.message);
        } else {
            console.log('Column bought_at added.');
        }
    });

    // 3. Add is_committed to ListItems
    console.log('Adding is_committed to ListItems...');
    db.run(`ALTER TABLE ListItems ADD COLUMN is_committed BOOLEAN DEFAULT 0;`, (err) => {
        if (err && err.message.includes('duplicate column name')) {
            console.log('Column is_committed already exists.');
        } else if (err) {
            console.error('Error adding column:', err.message);
        } else {
            console.log('Column is_committed added.');
        }
    });

    // 4. Add sort_order to ListItems
    console.log('Adding sort_order to ListItems...');
    db.run(`ALTER TABLE ListItems ADD COLUMN sort_order FLOAT DEFAULT 0;`, (err) => {
        if (err && err.message.includes('duplicate column name')) {
            console.log('Column sort_order already exists.');
        } else if (err) {
            console.error('Error adding column:', err.message);
        } else {
            console.log('Column sort_order added.');
        }
    });
});

db.close(() => console.log('DB Connection closed.'));
