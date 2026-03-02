/**
 * Migration v0.36.1: Rebuild RecipeIngredients table without composite unique constraint.
 * 
 * Background: The Sequelize belongsToMany association between Recipe and Product
 * created a SQLite autoindex (composite unique on RecipeId + ProductId).
 * This prevented multiple ingredients with null ProductId (AI-generated ingredients
 * without a catalog match) from being saved for the same recipe.
 * 
 * This migration recreates the table with explicit foreign keys but no unique constraint.
 */

const { sequelize } = require('../src/models');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('[migrate_v0.36.1] DB connected.');

        // Check if the autoindex still exists (idempotency: skip if already removed)
        const [indexes] = await sequelize.query(
            `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='RecipeIngredients';`
        );
        const hasUniqueIndex = indexes.some(i => i.name && i.name.includes('autoindex'));

        if (!hasUniqueIndex) {
            console.log('[migrate_v0.36.1] No composite autoindex found - migration already applied, skipping.');
            process.exit(0);
            return;
        }

        console.log('[migrate_v0.36.1] Rebuilding RecipeIngredients table to remove composite unique index...');

        await sequelize.transaction(async (t) => {
            await sequelize.query(`ALTER TABLE RecipeIngredients RENAME TO RecipeIngredients_old;`, { transaction: t });

            await sequelize.query(`
                CREATE TABLE RecipeIngredients (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    quantity    FLOAT NOT NULL,
                    unit        VARCHAR(255),
                    originalName VARCHAR(255),
                    isOptional  TINYINT(1) NOT NULL DEFAULT 0,
                    quantityText VARCHAR(255),
                    createdAt   DATETIME NOT NULL,
                    updatedAt   DATETIME NOT NULL,
                    RecipeId    INTEGER REFERENCES Recipes(id) ON DELETE SET NULL ON UPDATE CASCADE,
                    ProductId   INTEGER REFERENCES Products(id) ON DELETE SET NULL ON UPDATE CASCADE,
                    UserId      INTEGER REFERENCES Users(id) ON DELETE SET NULL ON UPDATE CASCADE
                );
            `, { transaction: t });

            await sequelize.query(`
                INSERT INTO RecipeIngredients
                SELECT id, quantity, unit, originalName, isOptional, quantityText, createdAt, updatedAt, RecipeId, ProductId, UserId
                FROM RecipeIngredients_old;
            `, { transaction: t });

            await sequelize.query(`DROP TABLE RecipeIngredients_old;`, { transaction: t });
        });

        console.log('[migrate_v0.36.1] Done. Composite unique constraint removed from RecipeIngredients.');
        process.exit(0);
    } catch (err) {
        console.error('[migrate_v0.36.1] Migration failed:', err.message);
        process.exit(1);
    }
}

run();
