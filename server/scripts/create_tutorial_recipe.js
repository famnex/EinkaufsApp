const { Sequelize } = require('sequelize');
const { Recipe, RecipeIngredient, Product, User, sequelize } = require('../src/models');

async function createTutorialRecipe() {
    try {
        await sequelize.authenticate();

        // 1. Delete existing if any
        await RecipeIngredient.destroy({ where: { RecipeId: 0 } });
        await sequelize.query('DELETE FROM FavoriteRecipes WHERE RecipeId = 0');
        await Recipe.destroy({ where: { id: 0 } });

        // 2. Create Recipe 0
        const recipe = await Recipe.create({
            id: 0,
            title: 'Beispielrezept',
            category: 'Tutorial',
            prep_time: 0,
            duration: 20,
            servings: 1,
            instructions: ['20 Minuten warten und dann GabelGuru benutzern'],
            isPublic: false,
            UserId: null
        });

        // Force id to 0 in case auto-increment ignored it
        await sequelize.query('UPDATE Recipes SET id = 0 WHERE title = "Beispielrezept" AND category = "Tutorial"');

        // 3. Find first product
        const firstProduct = await Product.findOne({ order: [['id', 'ASC']] });
        if (firstProduct) {
            await RecipeIngredient.create({
                RecipeId: 0,
                ProductId: firstProduct.id,
                quantity: 20,
                unit: firstProduct.unit || 'Stück'
            });
        }

        console.log("Tutorial Recipe 0 created successfully.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

createTutorialRecipe();
