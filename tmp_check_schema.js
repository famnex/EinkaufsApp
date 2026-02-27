const { Sequelize } = require('sequelize');
const path = require('path');

async function check() {
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: false,
    });
    try {
        const [results] = await sequelize.query("SELECT sql FROM sqlite_master WHERE name='RecipeSubstitutions'");
        console.log(results[0].sql);
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
check();
