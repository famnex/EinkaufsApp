const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established.');

        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('Users');

        if (!tableInfo.householdId) {
            console.log('Adding householdId column to Users...');
            await queryInterface.addColumn('Users', 'householdId', {
                type: DataTypes.INTEGER,
                allowNull: true
            });
            console.log('Column householdId added successfully.');
        } else {
            console.log('Column householdId already exists.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
