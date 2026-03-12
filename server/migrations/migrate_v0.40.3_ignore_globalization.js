const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();
    try {
        await queryInterface.addColumn('Products', 'ignoreGlobalization', {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        });
        console.log('Successfully added ignoreGlobalization column to Products table');
    } catch (err) {
        if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
            console.log('Column ignoreGlobalization already exists');
        } else {
            console.error('Migration failed:', err.message);
        }
    } finally {
        process.exit();
    }
}

migrate();
