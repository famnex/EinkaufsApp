const { sequelize } = require('../src/models');

async function fixUniqueConstraint() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();

        const queryInterface = sequelize.getQueryInterface();

        console.log('Removing old indices...');
        // Try to remove potential indices
        try { await queryInterface.removeIndex('Settings', 'settings_key'); } catch (e) { console.log('Index settings_key not found or already removed'); }
        try { await queryInterface.removeIndex('Settings', 'sqlite_autoindex_Settings_1'); } catch (e) { console.log('Autoindex 1 not found'); }
        // The error said "UNIQUE constraint failed: Settings.key", which implies a direct UNIQUE on the column or a single-column index.

        // In SQLite, if it's a constraint defined in CREATE TABLE, we might need to recreate the table or just add the correct index.
        // Let's force add the correct composite index.

        console.log('Adding correct composite unique index...');
        await queryInterface.addIndex('Settings', ['key', 'UserId'], {
            unique: true,
            name: 'settings_key_userid_unique'
        });

        console.log('Index fixed.');

    } catch (err) {
        console.error('Error fixing index:', err);
    } finally {
        await sequelize.close();
    }
}

fixUniqueConstraint();
