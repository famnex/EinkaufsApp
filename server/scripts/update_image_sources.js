const { sequelize, Recipe } = require('../src/models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Force sync to ensure column exists (be careful in prod, but safe here per instructions)
        await sequelize.sync({ alter: true });
        console.log('Database synced.');

        const recipes = await Recipe.findAll();
        console.log(`Found ${recipes.length} recipes.`);

        let count = 0;
        for (const recipe of recipes) {
            if (recipe.image_url) {
                // Set all existing images to 'scraped' as requested
                recipe.imageSource = 'scraped';
                await recipe.save();
                count++;
            }
        }

        console.log(`Updated ${count} recipes to 'scraped'.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
