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
    console.log('=== Migration v0.16.0 Starting ===\n');

    try {
        // Add 'isNew' column to Products
        if (!(await checkColumnExists('Products', 'isNew'))) {
            console.log('Adding column: Products.isNew...');
            // SQLite boolean is usually TINYINT or INTEGER
            await sequelize.query('ALTER TABLE Products ADD COLUMN isNew BOOLEAN DEFAULT 0;');
            console.log('✓ Added Products.isNew\n');
        } else {
            console.log('✓ Column Products.isNew already exists\n');
        }

        // Add 'source' column to Products
        if (!(await checkColumnExists('Products', 'source'))) {
            console.log('Adding column: Products.source...');
            await sequelize.query("ALTER TABLE Products ADD COLUMN source VARCHAR(255) DEFAULT 'manual';");
            console.log('✓ Added Products.source\n');
        } else {
            console.log('✓ Column Products.source already exists\n');
        }

        console.log('=== Migration v0.16.0 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
