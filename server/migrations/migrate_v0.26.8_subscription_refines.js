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
    console.log('=== Migration v0.26.8 (Subscription Refinements: pendingTier) Starting ===\n');

    try {
        if (!(await checkColumnExists('Users', 'pendingTier'))) {
            console.log('Adding column: Users.pendingTier...');
            // In SQLite, adding an ENUM column is basically adding a TEXT column with constraints, 
            // but for simplicity and since Sequelize handles ENUM as TEXT in SQLite anyway, we use TEXT.
            await sequelize.query("ALTER TABLE Users ADD COLUMN pendingTier TEXT DEFAULT 'none';");
            console.log('✓ Added Users.pendingTier\n');
        } else {
            console.log('Column Users.pendingTier already exists.\n');
        }

        console.log('=== Migration v0.26.8 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
