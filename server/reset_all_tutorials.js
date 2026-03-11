const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || path.join(__dirname, 'database.sqlite'),
    logging: false
});

async function resetAllUsers() {
    try {
        await sequelize.query("UPDATE `Users` SET `forkyTutorialsSeen` = '{}'");
        console.log("Tutorials für alle Benutzer erfolgreich zurückgesetzt.");
    } catch (e) {
        console.error("Fehler:", e);
    } finally {
        await sequelize.close();
    }
}
resetAllUsers();
