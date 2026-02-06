const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

db.serialize(() => {
    console.log("--- Products Table Schema ---");
    db.all("PRAGMA table_info(Products);", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });

    console.log("--- Recipes Table Schema ---");
    db.all("PRAGMA table_info(Recipes);", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });

    console.log("--- Lists Table Schema ---");
    db.all("PRAGMA table_info(Lists);", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });
});

db.close();
