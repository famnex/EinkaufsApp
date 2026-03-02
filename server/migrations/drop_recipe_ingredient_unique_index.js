/**
 * Migration: Drop composite unique index on RecipeIngredients (RecipeId, ProductId)
 * This index was created by the belongsToMany association and prevents multiple
 * ingredients with null ProductId from being saved for the same recipe.
 */

const path = require('path');
const { sequelize } = require('../src/models');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('DB connected.');

        // Get all indexes on RecipeIngredients table
        const [indexes] = await sequelize.query(
            `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='RecipeIngredients';`
        );
        console.log('Existing indexes:', indexes.map(i => i.name));

        // Drop any composite unique index involving RecipeId and ProductId
        for (const idx of indexes) {
            if (idx.name && (idx.name.toLowerCase().includes('recipeingredientrecipeid') ||
                idx.name.toLowerCase().includes('recipe_ingredients_recipe_id'))) {
                console.log(`Dropping index: ${idx.name}`);
                await sequelize.query(`DROP INDEX IF EXISTS "${idx.name}";`);
                console.log(`Dropped: ${idx.name}`);
            }
        }

        // Also try common Sequelize auto-generated name
        await sequelize.query(`DROP INDEX IF EXISTS "recipe_ingredients_recipe_id_product_id";`);
        await sequelize.query(`DROP INDEX IF EXISTS "RecipeIngredients_RecipeId_ProductId";`);
        await sequelize.query(`DROP INDEX IF EXISTS "RecipeIngredients_recipe_id_product_id";`);

        console.log('Done. Unique index removed if it existed.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

run();
