const { sequelize } = require('../src/models');
const { QueryTypes } = require('sequelize');

async function recreateTable() {
    let transaction;
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();

        console.log('Beginning transaction...');
        transaction = await sequelize.transaction();

        // 0. Check if Settings_old exists and drop it (cleanup fro prev run)
        await sequelize.query("DROP TABLE IF EXISTS Settings_old", { transaction });

        // 1. Rename old table
        console.log('Renaming old table...');
        await sequelize.query("ALTER TABLE Settings RENAME TO Settings_old", { transaction });

        // 2. Create new table
        console.log('Creating new table...');
        await sequelize.query(`
            CREATE TABLE Settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key VARCHAR(255) NOT NULL,
                value TEXT,
                createdAt DATETIME NOT NULL,
                updatedAt DATETIME NOT NULL,
                UserId INTEGER REFERENCES Users(id) ON DELETE SET NULL ON UPDATE CASCADE
            )
        `, { transaction });

        // 3. Copy data
        console.log('Copying data...');
        await sequelize.query(`
            INSERT INTO Settings (id, key, value, createdAt, updatedAt, UserId)
            SELECT id, key, value, createdAt, updatedAt, UserId FROM Settings_old
        `, { transaction });

        // 4. Create composite unique index
        console.log('Creating index...');
        // Drop it if it somehow exists
        await sequelize.query("DROP INDEX IF EXISTS settings_key_userid_unique", { transaction });

        await sequelize.query(`
            CREATE UNIQUE INDEX settings_key_userid_unique ON Settings(key, UserId)
        `, { transaction });

        // 5. Drop old table
        console.log('Dropping old table...');
        await sequelize.query("DROP TABLE Settings_old", { transaction });

        await transaction.commit();
        console.log('Table recreated successfully.');

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('Migration failed, rolling back:', err);
    } finally {
        await sequelize.close();
    }
}

recreateTable();
