const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function migrate() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    const queryInterface = sequelize.getQueryInterface();

    try {
        await sequelize.authenticate();
        console.log('Connected to database at:', dbPath);

        const tableInfo = await queryInterface.describeTable('RecipeIngredients');

        if (!tableInfo.originalName) {
            console.log('Adding originalName column to RecipeIngredients...');
            await queryInterface.addColumn('RecipeIngredients', 'originalName', {
                type: DataTypes.STRING,
                allowNull: true
            });
            console.log('Column originalName added successfully.');
        } else {
            console.log('Column originalName already exists.');
        }

    } catch (err) {
        console.error('Migration Error:', err);
    } finally {
        await sequelize.close();
    }
}

migrate();
