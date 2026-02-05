const { sequelize } = require('../src/models');
const { QueryTypes } = require('sequelize');

async function checkColumnExists(tableName, columnName) {
    const result = await sequelize.query(
        `PRAGMA table_info(${tableName})`,
        { type: QueryTypes.SELECT }
    );
    return result.some(col => col.name === columnName);
}

async function migrate() {
    console.log('=== Migration v0.16.2 Starting ===\n');

    try {
        // Add 'is_eating_out' column to Menus
        if (!(await checkColumnExists('Menus', 'is_eating_out'))) {
            console.log('Adding column: Menus.is_eating_out...');
            await sequelize.query("ALTER TABLE Menus ADD COLUMN is_eating_out BOOLEAN DEFAULT 0;");
            console.log('✓ Added Menus.is_eating_out\n');
        } else {
            console.log('✓ Column Menus.is_eating_out already exists\n');
        }

        console.log('=== Migration v0.16.2 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
