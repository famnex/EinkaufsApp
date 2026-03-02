const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function migrate() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    try {
        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('Recipes');

        if (!tableInfo.isPublic) {
            console.log('Adding isPublic column to Recipes table...');
            await queryInterface.addColumn('Recipes', 'isPublic', {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false
            });
            console.log('Column added successfully.');
        } else {
            console.log('isPublic column already exists.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

migrate();
