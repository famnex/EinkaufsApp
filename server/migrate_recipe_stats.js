const { Sequelize } = require('sequelize');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: console.log,
});

async function migrate() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        console.log('Adding clicks and cookCount columns to Recipes table...');

        try {
            await queryInterface.addColumn('Recipes', 'clicks', {
                type: Sequelize.INTEGER,
                defaultValue: 0
            });
            console.log('clicks added');
        } catch (e) { }

        try {
            await queryInterface.addColumn('Recipes', 'cookCount', {
                type: Sequelize.INTEGER,
                defaultValue: 0
            });
            console.log('cookCount added');
        } catch (e) { }

        console.log('Migration successful!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

migrate();
