const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();
    try {
        await queryInterface.addColumn('Users', 'alexaUserId', {
            type: require('sequelize').DataTypes.STRING,
            allowNull: true
        });
        console.log('Successfully added alexaUserId column to Users table');
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('Column alexaUserId already exists');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        process.exit();
    }
}

migrate();
