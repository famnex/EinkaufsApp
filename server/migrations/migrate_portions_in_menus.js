const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();
    try {
        await queryInterface.addColumn('Menus', 'portions', {
            type: DataTypes.INTEGER,
            allowNull: true
        });
        console.log('Successfully added portions column to Menus table');
    } catch (err) {
        if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
            console.log('Column portions already exists');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        process.exit();
    }
}

migrate();
