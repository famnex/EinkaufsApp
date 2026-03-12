const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || path.join(__dirname, 'database.sqlite'),
    logging: false
});

async function resetUser() {
    try {
        await sequelize.query("UPDATE `Users` SET `forkyTutorialsSeen` = '{}' WHERE `id` = 1");
        console.log("Tutorials für User 1 erfolgreich zurückgesetzt.");
    } catch (e) {
        console.error("Fehler:", e);
    } finally {
        await sequelize.close();
    }
}
resetUser();
