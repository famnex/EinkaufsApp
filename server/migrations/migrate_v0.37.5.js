const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function migrate() {
    // Pfad zur Datenbankdatei (passe diesen ggf. an deine Ordnerstruktur an)
    const dbPath = path.resolve(__dirname, '../database.sqlite');

    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    try {
        const queryInterface = sequelize.getQueryInterface();

        // Holt die Struktur der Tabelle "Users"
        const tableInfo = await queryInterface.describeTable('Users');

        // Prüft, ob die Spalte "showAppTutorial" bereits existiert
        if (!tableInfo.showAppTutorial) {
            console.log('Adding showAppTutorial column to Users table...');

            await queryInterface.addColumn('Users', 'showAppTutorial', {
                type: DataTypes.BOOLEAN,
                defaultValue: true, // Entspricht der '1' in SQLite
                allowNull: true     // Entspricht 'Allow Null: Ja'
            });

            console.log('Column added successfully.');
        } else {
            console.log('showAppTutorial column already exists in Users table.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        // Verbindung sauber schließen
        await sequelize.close();
    }
}

migrate();