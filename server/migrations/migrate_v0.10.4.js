const { sequelize } = require('../src/models');

/**
 * Migration v0.10.4
 * Fixes RecipeTags table schema.
 * Recreates the table to ensure standard Sequelize schema (with id) but correct Unique constraints.
 */
async function migrate() {
    const t = await sequelize.transaction();
    try {
        console.log('Starting RecipeTags Schema Fix (v2)...');

        // 1. Rename existing table
        const tables = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='RecipeTags';", { type: sequelize.QueryTypes.SELECT });
        if (tables.length > 0) {
            console.log('Backing up existing RecipeTags...');
            await sequelize.query("ALTER TABLE RecipeTags RENAME TO RecipeTags_backup;", { transaction: t });
        }

        // 2. Create new table with standard Sequelize schema + Correct Unique Index
        console.log('Creating fresh RecipeTags table...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS RecipeTags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                createdAt DATETIME NOT NULL,
                updatedAt DATETIME NOT NULL,
                RecipeId INTEGER NOT NULL REFERENCES Recipes(id) ON DELETE CASCADE ON UPDATE CASCADE,
                TagId INTEGER NOT NULL REFERENCES Tags(id) ON DELETE CASCADE ON UPDATE CASCADE,
                UNIQUE(RecipeId, TagId)
            );
        `, { transaction: t });

        // 3. Restore data if backup exists
        if (tables.length > 0) {
            console.log('Restoring data...');
            // Need to handle missing 'id' if the backup implementation was weird, but normally we just copy the content columns and let ID auto-gen if needed, or copy ID if it exists.
            // Let's check columns of backup to be safe, or just insert content.
            // Safest: Insert content columns (RecipeId, TagId, createdAt, updatedAt) and let ID auto-increment.

            await sequelize.query(`
                INSERT OR IGNORE INTO RecipeTags (createdAt, updatedAt, RecipeId, TagId)
                SELECT createdAt, updatedAt, RecipeId, TagId FROM RecipeTags_backup;
            `, { transaction: t });

            console.log('Dropping backup table...');
            await sequelize.query("DROP TABLE RecipeTags_backup;", { transaction: t });
        }

        await t.commit();
        console.log('Migration v0.10.4 successful: RecipeTags schema rebuilt.');
        process.exit(0);

    } catch (err) {
        await t.rollback();
        console.error('Migration v0.10.4 failed:', err);
        process.exit(1);
    }
}

migrate();
