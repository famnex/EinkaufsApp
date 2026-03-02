/**
 * Migration: Rebuild RecipeIngredients table without the composite unique constraint.
 * SQLite autoindexes (sqlite_autoindex_*) cannot be dropped with DROP INDEX.
 * We must recreate the table without the unique constraint.
 */

const { sequelize } = require('../src/models');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('DB connected.');

        // Check current indexes
        const [idxBefore] = await sequelize.query(
            `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='RecipeIngredients';`
        );
        console.log('Indexes before:', idxBefore.map(i => i.name));

        // Get table info
        const [cols] = await sequelize.query(`PRAGMA table_info(RecipeIngredients);`);
        console.log('Columns:', cols.map(c => c.name));

        // Recreate without the unique constraint by:
        // 1. Rename old table
        // 2. Create new table without UNIQUE on (RecipeId, ProductId)
        // 3. Copy data
        // 4. Drop old table

        await sequelize.transaction(async (t) => {
            // Step 1: Rename
            await sequelize.query(`ALTER TABLE RecipeIngredients RENAME TO RecipeIngredients_old;`, { transaction: t });

            // Step 2: Create new table without unique constraint on (RecipeId, ProductId)
            await sequelize.query(`
                CREATE TABLE RecipeIngredients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    quantity FLOAT NOT NULL,
                    unit VARCHAR(255),
                    originalName VARCHAR(255),
                    isOptional TINYINT(1) NOT NULL DEFAULT 0,
                    createdAt DATETIME NOT NULL,
                    updatedAt DATETIME NOT NULL,
                    RecipeId INTEGER REFERENCES Recipes(id) ON DELETE SET NULL ON UPDATE CASCADE,
                    ProductId INTEGER REFERENCES Products(id) ON DELETE SET NULL ON UPDATE CASCADE,
                    UserId INTEGER REFERENCES Users(id) ON DELETE SET NULL ON UPDATE CASCADE
                );
            `, { transaction: t });

            // Step 3: Copy data
            await sequelize.query(`
                INSERT INTO RecipeIngredients 
                SELECT id, quantity, unit, originalName, isOptional, createdAt, updatedAt, RecipeId, ProductId, UserId
                FROM RecipeIngredients_old;
            `, { transaction: t });

            // Step 4: Drop old
            await sequelize.query(`DROP TABLE RecipeIngredients_old;`, { transaction: t });
        });

        // Check new indexes
        const [idxAfter] = await sequelize.query(
            `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='RecipeIngredients';`
        );
        console.log('Indexes after:', idxAfter.map(i => i.name));

        console.log('Done. Unique constraint removed.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

run();
