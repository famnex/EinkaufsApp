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

        // Check if lastFollowedUpdatesCheck exists in Users table
        const tableInfo = await queryInterface.describeTable('Users');

        if (!tableInfo.lastFollowedUpdatesCheck) {
            console.log('Adding lastFollowedUpdatesCheck column to Users table...');
            await queryInterface.addColumn('Users', 'lastFollowedUpdatesCheck', {
                type: DataTypes.DATE,
                allowNull: true
            });
            console.log('Successfully added lastFollowedUpdatesCheck column.');
        } else {
            console.log('lastFollowedUpdatesCheck column already exists in Users table.');
        }

        console.log('Migration v0.32.12_user_last_updates_check completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
