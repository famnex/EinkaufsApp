const { sequelize, ProductReport } = require('./src/models');

async function syncTable() {
    try {
        console.log('Synchronisiere Datenbank für neue ProductReports-Tabelle...');
        await ProductReport.sync({ alter: true });
        console.log('Tabelle "ProductReports" wurde erfolgreich angelegt oder aktualisiert.');
        process.exit(0);
    } catch (error) {
        console.error('Fehler beim Synchronisieren der Tabelle:', error);
        process.exit(1);
    }
}

syncTable();
