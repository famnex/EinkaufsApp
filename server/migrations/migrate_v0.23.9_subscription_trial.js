const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();
    try {
        await queryInterface.addColumn('Users', 'isTrialUsed', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
        console.log('Successfully added isTrialUsed column to Users table');
    } catch (err) {
        if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
            console.log('Column isTrialUsed already exists');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        process.exit();
    }
}

migrate();
