const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Pfad zur Datenbankdatei auflösen
const dbPath = path.resolve(__dirname, 'database.sqlite');

// Verbindung zur Datenbank herstellen
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Fehler beim Öffnen der Datenbank:', err.message);
    }
});

db.serialize(() => {
    const tableName = 'Users';
    // PRAGMA table_info gibt Metadaten über alle Spalten der Tabelle zurück
    const query = `PRAGMA table_info('${tableName}')`;

    db.all(query, [], (err, columns) => {
        if (err) {
            console.error('Fehler beim Abrufen der Struktur:', err.message);
        } else {
            // Wenn das Array leer ist, gibt es die Tabelle nicht
            if (columns.length === 0) {
                console.log(`Fehler: Die Tabelle "${tableName}" existiert nicht.`);
            } else {
                // Hier formatieren wir die rohen SQLite-Daten in genau die Infos, die du brauchst
                const structure = columns.map(col => {
                    return {
                        'Spalte': col.name,
                        'Datentyp': col.type,
                        // SQLite gibt bei 'notnull' eine 1 (darf nicht null sein) oder 0 (darf null sein) zurück
                        'Allow Null': col.notnull === 0 ? 'Ja' : 'Nein',
                        // Wenn dflt_value null ist, gibt es keinen Standardwert
                        'Default': col.dflt_value !== null ? col.dflt_value : 'NULL',
                        // Bonus: Zeigt an, ob die Spalte der Primary Key ist
                        'Primary Key': col.pk === 1 ? 'Ja' : 'Nein'
                    };
                });

                console.log(`\n--- Tabellenstruktur von "${tableName}" ---`);
                console.table(structure);
            }
        }
    });
});

// Datenbankverbindung sauber schließen
db.close((err) => {
    if (err) {
        console.error('Fehler beim Schließen der Datenbank:', err.message);
    }
});