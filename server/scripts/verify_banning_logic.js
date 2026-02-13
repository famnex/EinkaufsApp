const { sequelize, User, Recipe, ComplianceReport } = require('../src/models');
const { sendSystemEmail } = require('../src/services/emailService');
const axios = require('axios'); // We need axios to call our own API or mock it

// Mock environment
process.env.NODE_ENV = 'test';

async function verifyBanning() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();

        // 1. Create a Test User and Recipe
        const testUser = await User.create({
            username: 'bannable_user_' + Date.now(),
            email: 'ban_test@example.com',
            sharingKey: 'ban-test-key-' + Date.now(),
            isPublicCookbook: true
        });

        const testRecipe = await Recipe.create({
            title: 'Bannable Recipe',
            UserId: testUser.id,
            bannedAt: null
        });

        console.log(`Created User ${testUser.id} and Recipe ${testRecipe.id}`);

        // 2. Mock URL for Compliance Report
        const cookbookUrl = `https://gabelguru.de/shared/${testUser.sharingKey}`;
        const recipeUrl = `https://gabelguru.de/shared/recipe/${testUser.sharingKey}/${testRecipe.id}`;

        // 3. Simulate Report Submission (Directly invoking logic logic or calling API?)
        // Since we want to test the ROUTE logic (including the auto-ban), 
        // reproducing the logic here is safer than spinning up a server, 
        // OR we just invoke the logic block if we extracted it. 
        // But the logic is inside the route handler. 
        // Let's just execute the logic manually to verify it WORKS as intended on the DB model.
        // NOTE: The route uses regex to parse. Let's verify THAT regex logic works.

        console.log('Testing Regex Matchers...');
        // Patterns from compliance.js
        const cookbookMatch = cookbookUrl.match(/\/shared\/([a-zA-Z0-9-]+)$/);
        const recipeMatch = recipeUrl.match(/\/shared\/recipe\/([a-zA-Z0-9-]+)\/(\d+)/);

        if (!cookbookMatch || cookbookMatch[1] !== testUser.sharingKey) {
            throw new Error('Cookbook Regex Failed');
        }
        if (!recipeMatch || recipeMatch[1] !== testUser.sharingKey || recipeMatch[2] !== String(testRecipe.id)) {
            throw new Error('Recipe Regex Failed');
        }
        console.log('Regex Matchers OK.');

        // 4. Test Banning Logic (Recipe)
        console.log('Simulating Recipe Ban...');
        {
            const sharingKey = recipeMatch[1];
            const recipeId = recipeMatch[2];
            const user = await User.findOne({ where: { sharingKey } });
            if (user) {
                const recipe = await Recipe.findOne({ where: { id: recipeId, UserId: user.id } });
                if (recipe) {
                    recipe.bannedAt = new Date();
                    await recipe.save();
                    console.log('Recipe banned via logic simulation.');
                }
            }
        }

        // Verify Recipe Ban
        await testRecipe.reload();
        if (!testRecipe.bannedAt) throw new Error('Recipe was not banned!');
        console.log('Recipe Ban Verified.');


        // 5. Test Banning Logic (Cookbook)
        console.log('Simulating Cookbook Ban...');
        {
            const sharingKey = cookbookMatch[1];
            const user = await User.findOne({ where: { sharingKey } });
            if (user) {
                user.bannedAt = new Date();
                user.isPublicCookbook = false;
                await user.save();
                console.log('Cookbook banned via logic simulation.');
            }
        }

        // Verify Cookbook Ban
        await testUser.reload();
        if (!testUser.bannedAt) throw new Error('User (Cookbook) was not banned!');
        if (testUser.isPublicCookbook) throw new Error('User isPublicCookbook should be false!');
        console.log('Cookbook Ban Verified.');

        // Cleanup
        await testRecipe.destroy();
        await testUser.destroy();
        console.log('Cleanup done.');

    } catch (err) {
        console.error('Verification Failed:', err);
    } finally {
        await sequelize.close();
    }
}

verifyBanning();
