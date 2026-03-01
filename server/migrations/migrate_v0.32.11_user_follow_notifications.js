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

        // Check if followNotificationsEnabled exists in Users table
        const tableInfo = await queryInterface.describeTable('Users');

        if (!tableInfo.followNotificationsEnabled) {
            console.log('Adding followNotificationsEnabled column to Users table...');
            await queryInterface.addColumn('Users', 'followNotificationsEnabled', {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            });
            console.log('Successfully added followNotificationsEnabled column.');
        } else {
            console.log('followNotificationsEnabled column already exists in Users table.');
        }

        console.log('Migration v0.32.11_user_follow_notifications completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
