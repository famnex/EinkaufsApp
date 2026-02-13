const { sequelize, Settings, User } = require('../src/models');

async function migrate() {
    let transaction;
    try {
        console.log('Starting migration v0.24.4: Global Email Settings...');
        await sequelize.authenticate();
        transaction = await sequelize.transaction();

        // 1. Recreate Settings Table to fix Unique Constraint
        // We need to drop the strict UNIQUE(key) constraint and replace it with UNIQUE(key, UserId)
        // Since SQLite doesn't support easy constraint dropping, we recreate the table.

        console.log('Recreating Settings table...');

        // Check if we need to migrate essentially by checking if we have global settings already or strict constraint
        // For safety, we just run the table recreation logic which is idempotent-ish if handled right, 
        // but let's be safe and assume this script runs once.

        await sequelize.query("DROP TABLE IF EXISTS Settings_old", { transaction });
        await sequelize.query("ALTER TABLE Settings RENAME TO Settings_old", { transaction });

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

        await sequelize.query(`
            INSERT INTO Settings (id, key, value, createdAt, updatedAt, UserId)
            SELECT id, key, value, createdAt, updatedAt, UserId FROM Settings_old
        `, { transaction });

        // Create the new composite index
        await sequelize.query("DROP INDEX IF EXISTS settings_key_userid_unique", { transaction });
        await sequelize.query(`
            CREATE UNIQUE INDEX settings_key_userid_unique ON Settings(key, UserId)
        `, { transaction });

        await sequelize.query("DROP TABLE Settings_old", { transaction });
        console.log('Settings table recreated with correct constraints.');


        // 2. Data Migration: Move Admin Email Settings to Global (UserId: null)
        console.log('Migrating admin email settings to global...');

        // Find existing admin settings
        // We have to use raw query or models. 
        // Note: We just recreated table, so we need to be careful with Model usage if it cached schema? 
        // Sequelize models should be fine as they match the new schema structure (columns didn't change, just constraints).

        const [results] = await sequelize.query(`
            SELECT s.key, s.value, s.UserId 
            FROM Settings s
            JOIN Users u ON s.UserId = u.id
            WHERE u.role = 'admin' 
            AND s.key IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_sender_name', 'smtp_secure', 'imap_host', 'imap_port', 'imap_user', 'imap_password', 'imap_secure')
            ORDER BY s.updatedAt DESC
            LIMIT 100
        `, { transaction });

        // We take the first valid config found (logic similar to previous script but in SQL/JS)
        // Group by key and take the one from the most active/recent admin? 
        // Simpler: iterate and set global if not set.

        const emailKeys = [
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_sender_name', 'smtp_secure',
            'imap_host', 'imap_port', 'imap_user', 'imap_password', 'imap_secure'
        ];

        for (const record of results) {
            // Check if global setting already exists
            const [globalExists] = await sequelize.query(`SELECT 1 FROM Settings WHERE key = '${record.key}' AND UserId IS NULL`, { transaction });

            if (globalExists.length === 0) {
                // Insert global setting
                await sequelize.query(`
                    INSERT INTO Settings (key, value, createdAt, updatedAt, UserId)
                    VALUES (:key, :value, :now, :now, NULL)
                `, {
                    replacements: {
                        key: record.key,
                        value: record.value,
                        now: new Date()
                    },
                    transaction
                });
                console.log(`Migrated ${record.key} to global.`);
            }
        }

        await transaction.commit();
        console.log('Migration v0.24.4 successful.');

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

migrate();
