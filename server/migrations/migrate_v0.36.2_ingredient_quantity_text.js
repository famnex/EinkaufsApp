const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();
    try {
        await queryInterface.addColumn('RecipeIngredients', 'quantityText', {
            type: DataTypes.STRING,
            allowNull: true
        });
        console.log('Successfully added quantityText column to RecipeIngredients table');
    } catch (err) {
        if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
            console.log('Column quantityText already exists');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        process.exit();
    }
}

migrate();
