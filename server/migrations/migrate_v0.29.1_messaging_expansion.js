const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
    try {
        console.log('Starting migration v0.29.1 (Messaging Expansion)...');
        const tableInfo = await queryInterface.describeTable('Emails');

        // Add previousFolder
        if (!tableInfo.previousFolder) {
            console.log('Adding previousFolder column...');
            await queryInterface.addColumn('Emails', 'previousFolder', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        // SQLite ENUM handling: SQLite doesn't strictly enforce ENUMs, 
        // but we should ensure the column exists or adjust if needed.
        // Usually, we just update the model definition in code for SQLite.

        console.log('Migration v0.29.1 completed successfully.');
    } catch (error) {
        console.error('Migration v0.29.1 failed:', error);
        throw error;
    }
}

async function down({ context: queryInterface }) {
    // Optional: implementation for rollback
}

if (require.main === module) {
    const { sequelize } = require('../src/models');
    up({ context: sequelize.getQueryInterface() })
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { up, down };
