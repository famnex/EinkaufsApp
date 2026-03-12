
const { List, ListItem, PlannedRecipe, Recipe, RecipeIngredient, Product, User } = require('./src/models');
const { Op } = require('sequelize');

async function testDoubling() {
    console.log('--- Test Doubling Simulation ---');

    const user = await User.findOne({ where: { role: 'admin' } });
    if (!user) {
        console.error('No admin user found.');
        return;
    }

    // Attempt to find a recipe or create a mock one if needed
    let recipe = await Recipe.findOne({
        include: [{ model: RecipeIngredient, include: [Product] }]
    });

    if (!recipe) {
        console.log('No recipe found. Creating a mock one.');
        // This is a bit complex for a script, maybe search harder first
    }

    const list = await List.create({ name: 'Doubling Test List', date: new Date(), UserId: user.id });

    try {
        console.log(`Recipe: ${recipe?.title || 'Unknown'}, Base Servings: ${recipe?.servings}`);
        const ri = recipe.RecipeIngredients[0];
        console.log(`Ingredient: ${ri.Product?.name}, Qty: ${ri.quantity}, Unit: ${ri.unit}`);

        console.log('Simulating save with servings = 1...');

        const chosenServings = 1;
        const baseServings = Number(recipe.servings) || 1;
        const ratio = chosenServings / baseServings;
        console.log(`Calculated Ratio: ${ratio} (Chosen: ${chosenServings}, Base: ${baseServings})`);

        const itemsToSave = [{
            ProductId: ri.ProductId,
            quantity: ri.quantity * ratio,
            unit: ri.unit,
            note: `Rezept: ${recipe.title}`
        }];

        console.log('Payload item qty sent to backend:', itemsToSave[0].quantity);

        // --- BACKEND LOGIC ---
        let planned = await PlannedRecipe.create({
            ListId: list.id,
            RecipeId: recipe.id,
            UserId: user.id,
            servings: chosenServings
        });

        // The logic from lists.js
        const destroyWhere = {
            UserId: user.id,
            ListId: list.id,
            [Op.or]: [
                { PlannedRecipeId: planned.id },
                { ListId: list.id, note: `Rezept: ${recipe.title}`, PlannedRecipeId: null }
            ]
        };
        await ListItem.destroy({ where: destroyWhere });

        const products = await Product.findAll({
            where: { id: itemsToSave.map(i => i.ProductId) }
        });

        const newItems = itemsToSave.map(item => {
            const product = products.find(p => p.id === item.ProductId);
            return {
                ListId: list.id,
                UserId: user.id,
                ProductId: item.ProductId,
                quantity: item.quantity,
                unit: item.unit,
                note: item.note,
                PlannedRecipeId: planned.id,
                name: product?.name
            };
        });

        await ListItem.bulkCreate(newItems);

        // --- VERIFY ---
        const finalItems = await ListItem.findAll({ where: { ListId: list.id } });
        console.log(`Number of items created: ${finalItems.length}`);
        finalItems.forEach(i => {
            console.log(`Item Qty in DB: ${i.quantity}`);
            const expected = ri.quantity * ratio;
            if (i.quantity === expected) {
                console.log(`✅ Qty matches expectation: ${i.quantity}`);
            } else {
                console.log(`❌ Qty DOES NOT match! Expected ${expected}, got ${i.quantity}`);
            }
        });

    } finally {
        await List.destroy({ where: { id: list.id } });
        await ListItem.destroy({ where: { ListId: list.id } });
        await PlannedRecipe.destroy({ where: { ListId: list.id } });
        console.log('Cleanup done.');
    }
}

testDoubling().catch(console.error);
