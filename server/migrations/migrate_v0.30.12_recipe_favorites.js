const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: console.log
});

async function migrate() {
    try {
        console.log('Starting migration to add isFavorite to Recipes table...');

        const queryInterface = sequelize.getQueryInterface();

        const tableInfo = await queryInterface.describeTable('Recipes');

        if (!tableInfo.isFavorite) {
            await queryInterface.addColumn('Recipes', 'isFavorite', {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            });
            console.log('=> Added isFavorite column to Recipes table.');
        } else {
            console.log('=> isFavorite column already exists in Recipes table. Skipping.');
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
