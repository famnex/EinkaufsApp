const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function checkColumnExists(tableName, columnName) {
    const result = await sequelize.query(
        `PRAGMA table_info(${tableName})`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return result.some(col => col.name === columnName);
}

async function migrate() {
    console.log('=== Migration v0.22.13 (Public Cookbook Toggle) Starting ===\n');

    try {
        if (!(await checkColumnExists('Users', 'isPublicCookbook'))) {
            console.log('Adding column: Users.isPublicCookbook...');
            await sequelize.query("ALTER TABLE Users ADD COLUMN isPublicCookbook BOOLEAN DEFAULT 0;");
            console.log('✓ Added Users.isPublicCookbook\n');
        } else {
            console.log('Column Users.isPublicCookbook already exists.\n');
        }

        console.log('=== Migration v0.22.13 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
