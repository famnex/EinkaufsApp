const { sequelize, RecipeIngredient } = require('./src/models');

async function resetTable() {
    try {
        await RecipeIngredient.sync({ force: true });
        console.log('RecipeIngredient table forced synced');
    } catch (err) {
        console.error('Failed to sync:', err);
    }
}

resetTable();
