const { Sequelize } = require('sequelize');
const path = require('path');
const { User } = require('../src/models');
const logger = require('../src/utils/logger');

async function migrate() {
    console.log('Starting migration: Add lastFollowedUpdatesNudgeSent to Users...');

    try {
        const queryInterface = User.sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('Users');

        if (!tableInfo.lastFollowedUpdatesNudgeSent) {
            console.log('Adding column: lastFollowedUpdatesNudgeSent');
            await queryInterface.addColumn('Users', 'lastFollowedUpdatesNudgeSent', {
                type: Sequelize.DATE,
                allowNull: true
            });
            console.log('Column added successfully.');
        } else {
            console.log('Column lastFollowedUpdatesNudgeSent already exists.');
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
