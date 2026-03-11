const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || path.join(__dirname, '../database.sqlite'),
    logging: console.log
});

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Verbindung zur Datenbank erfolgreich.');
        const queryInterface = sequelize.getQueryInterface();

        console.log('Füge Spalte "forkyTutorialsSeen" zur Tabelle "Users" hinzu...');
        try {
            await queryInterface.addColumn('Users', 'forkyTutorialsSeen', {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {}
            });
            console.log('[OK] Spalte "forkyTutorialsSeen" erfolgreich hinzugefügt.');
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('[SKIP] Spalte "forkyTutorialsSeen" existiert bereits.');
            } else {
                console.error('[ERR] Fehler beim Hinzufügen der Spalte:', err.message);
                throw err;
            }
        }

        console.log('\nMigration abgeschlossen.');
    } catch (error) {
        console.error('Migration fehlgeschlagen:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

migrate();
