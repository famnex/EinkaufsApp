
const { List, ListItem, PlannedRecipe, Recipe, RecipeIngredient, Product, User } = require('./server/src/models');
const { Op } = require('sequelize');

async function verifyQuantityFixes() {
    console.log('--- Verification: Quantity Fixes ---');

    // 1. Setup mock data
    const user = await User.findOne({ where: { role: 'admin' } });
    if (!user) {
        console.error('No admin user found for testing.');
        return;
    }

    const recipe = await Recipe.findOne({
        where: { UserId: user.id },
        include: [{ model: RecipeIngredient, include: [Product] }]
    });

    if (!recipe || recipe.RecipeIngredients.length === 0) {
        console.error('No recipe with ingredients found for testing.');
        return;
    }

    const list1 = await List.create({ name: 'Test List 1', date: new Date(), UserId: user.id });
    const list2 = await List.create({ name: 'Test List 2', date: new Date(), UserId: user.id });

    console.log(`Using Recipe: "${recipe.title}" (ID: ${recipe.id}, Baseline Servings: ${recipe.servings})`);
    console.log(`Using Lists: "${list1.name}" (ID: ${list1.id}) and "${list2.name}" (ID: ${list2.id})`);

    try {
        // --- TEST 1: Multiple saves on the same list ---
        console.log('\n--- Test 1: Multiple saves on SAME list ---');

        // Mock the POST logic twice
        for (let i = 1; i <= 2; i++) {
            console.log(`Save Iteration ${i}...`);

            // Simulation of POST /:listId/planned-recipes/:recipeId
            let planned = await PlannedRecipe.findOne({
                where: { ListId: list1.id, RecipeId: recipe.id }
            });

            if (!planned) {
                planned = await PlannedRecipe.create({
                    ListId: list1.id,
                    RecipeId: recipe.id,
                    UserId: user.id,
                    servings: 4
                });
            } else {
                await planned.update({ servings: 4 });
            }

            // The critical fix: destroyWhere with ListId
            const destroyWhere = {
                UserId: user.id,
                ListId: list1.id,
                [Op.or]: [
                    { PlannedRecipeId: planned.id },
                    { ListId: list1.id, note: `Rezept: ${recipe.title}`, PlannedRecipeId: null }
                ]
            };
            await ListItem.destroy({ where: destroyWhere });

            // Create items (just use 1st ingredient for simplicity)
            const ri = recipe.RecipeIngredients[0];
            const ratio = 4 / (recipe.servings || 1);
            await ListItem.create({
                ListId: list1.id,
                ProductId: ri.ProductId,
                UserId: user.id,
                quantity: ri.quantity * ratio,
                unit: ri.unit,
                note: `Rezept: ${recipe.title}`,
                PlannedRecipeId: planned.id
            });
        }

        const itemsOnList1 = await ListItem.findAll({ where: { ListId: list1.id, PlannedRecipeId: { [Op.not]: null } } });
        console.log(`Items on List 1: ${itemsOnList1.length} (Expected: 1)`);
        if (itemsOnList1.length === 1) {
            console.log('✅ Duplicates on same list prevented.');
        } else {
            console.log('❌ Failed: Duplicates found on same list.');
        }

        // --- TEST 2: Isolation between lists ---
        console.log('\n--- Test 2: Isolation between lists ---');

        // Save to List 2
        console.log('Saving to List 2...');
        let planned2 = await PlannedRecipe.create({
            ListId: list2.id,
            RecipeId: recipe.id,
            UserId: user.id,
            servings: 4
        });

        // Delete from List 2 only
        const destroyWhere2 = {
            UserId: user.id,
            ListId: list2.id,
            [Op.or]: [
                { PlannedRecipeId: planned2.id }
            ]
        };
        await ListItem.destroy({ where: destroyWhere2 });

        await ListItem.create({
            ListId: list2.id,
            ProductId: recipe.RecipeIngredients[0].ProductId,
            UserId: user.id,
            quantity: 10, // Some dummy quantity
            PlannedRecipeId: planned2.id
        });

        // Re-check List 1
        const itemsOnList1After = await ListItem.findAll({ where: { ListId: list1.id } });
        console.log(`Items on List 1 after List 2 action: ${itemsOnList1After.length} (Expected: 1)`);
        if (itemsOnList1After.length === 1) {
            console.log('✅ Isolation verified. Deleting from List 2 did not affect List 1.');
        } else {
            console.log('❌ Failed: Isolation broken.');
        }

    } finally {
        // Cleanup
        await List.destroy({ where: { id: [list1.id, list2.id] } });
        await PlannedRecipe.destroy({ where: { ListId: [list1.id, list2.id] } });
        await ListItem.destroy({ where: { ListId: [list1.id, list2.id] } });
        console.log('\nCleanup done.');
    }
}

verifyQuantityFixes().catch(console.error);
