const { sequelize, Recipe, User, Store, ComplianceReport } = require('./src/models');

async function inspectImages() {
    try {
        const recipes = await Recipe.findAll({ attributes: ['image_url'], limit: 5 });
        const users = await User.findAll({ attributes: ['cookbookImage'], limit: 5 });
        const stores = await Store.findAll({ attributes: ['logo_url'], limit: 5 });
        const compliance = await ComplianceReport.findAll({ attributes: ['screenshotPath'], limit: 5 });

        console.log('Recipe images:', recipes.map(r => r.image_url));
        console.log('User images:', users.map(u => u.cookbookImage));
        console.log('Store logos:', stores.map(s => s.logo_url));
        console.log('Compliance screenshots:', compliance.map(c => c.screenshotPath));
    } catch (err) {
        console.error('Inspection failed:', err);
    } finally {
        process.exit();
    }
}

inspectImages();
