const { sequelize } = require('../src/models');

/**
 * Migration Script for v0.10.0
 * 
 * Adds the following to the database:
 * 1. ListItems.bought_at (DATETIME) - Track when item was bought
 * 2. ListItems.is_committed (BOOLEAN) - Track if item is "locked" in learning history
 * 3. ListItems.sort_order (FLOAT) - Manual drag & drop ordering
 * 4. ListItems.sort_store_id (INTEGER) - Store context for manual sorting
 * 5. ProductRelations table - Smart sorting learning graph
 * 
 * This script is IDEMPOTENT - safe to run multiple times.
 */

async function checkColumnExists(tableName, columnName) {
    const result = await sequelize.query(
        `PRAGMA table_info(${tableName})`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return result.some(col => col.name === columnName);
}

async function checkTableExists(tableName) {
    const result = await sequelize.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return result.length > 0;
}

async function migrate() {
    console.log('=== Migration v0.10.0 Starting ===\n');

    try {
        // 1. Add bought_at to ListItems
        if (!(await checkColumnExists('ListItems', 'bought_at'))) {
            console.log('Adding column: ListItems.bought_at...');
            await sequelize.query('ALTER TABLE ListItems ADD COLUMN bought_at DATETIME;');
            console.log('✓ Added ListItems.bought_at\n');
        } else {
            console.log('✓ Column ListItems.bought_at already exists\n');
        }

        // 2. Add is_committed to ListItems
        if (!(await checkColumnExists('ListItems', 'is_committed'))) {
            console.log('Adding column: ListItems.is_committed...');
            await sequelize.query('ALTER TABLE ListItems ADD COLUMN is_committed BOOLEAN DEFAULT 0;');
            console.log('✓ Added ListItems.is_committed\n');
        } else {
            console.log('✓ Column ListItems.is_committed already exists\n');
        }

        // 3. Add sort_order to ListItems
        if (!(await checkColumnExists('ListItems', 'sort_order'))) {
            console.log('Adding column: ListItems.sort_order...');
            await sequelize.query('ALTER TABLE ListItems ADD COLUMN sort_order FLOAT DEFAULT 0;');
            console.log('✓ Added ListItems.sort_order\n');
        } else {
            console.log('✓ Column ListItems.sort_order already exists\n');
        }

        // 4. Add sort_store_id to ListItems
        if (!(await checkColumnExists('ListItems', 'sort_store_id'))) {
            console.log('Adding column: ListItems.sort_store_id...');
            await sequelize.query('ALTER TABLE ListItems ADD COLUMN sort_store_id INTEGER DEFAULT NULL;');
            console.log('✓ Added ListItems.sort_store_id\n');
        } else {
            console.log('✓ Column ListItems.sort_store_id already exists\n');
        }

        // 5. Create ProductRelations table
        if (!(await checkTableExists('ProductRelations'))) {
            console.log('Creating table: ProductRelations...');
            await sequelize.query(`
                CREATE TABLE ProductRelations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    StoreId INTEGER NOT NULL,
                    PredecessorId INTEGER NOT NULL,
                    SuccessorId INTEGER NOT NULL,
                    weight INTEGER DEFAULT 1,
                    createdAt DATETIME NOT NULL,
                    updatedAt DATETIME NOT NULL,
                    FOREIGN KEY (StoreId) REFERENCES Stores(id) ON DELETE CASCADE,
                    FOREIGN KEY (PredecessorId) REFERENCES Products(id) ON DELETE CASCADE,
                    FOREIGN KEY (SuccessorId) REFERENCES Products(id) ON DELETE CASCADE
                );
            `);
            console.log('✓ Created ProductRelations table\n');
        } else {
            console.log('✓ Table ProductRelations already exists\n');
        }

        console.log('=== Migration v0.10.0 Completed Successfully ===');
        console.log('\nChanges applied:');
        console.log('  ✓ ListItems.bought_at (DATETIME)');
        console.log('  ✓ ListItems.is_committed (BOOLEAN)');
        console.log('  ✓ ListItems.sort_order (FLOAT)');
        console.log('  ✓ ListItems.sort_store_id (INTEGER)');
        console.log('  ✓ ProductRelations table');
        console.log('\nYou can now restart your server.');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        console.error(err);
        process.exit(1);
    }
}

// Run migration
migrate();
