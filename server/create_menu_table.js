const { Menu, Recipe, sequelize } = require('./src/models');

async function createTable() {
    try {
        await Menu.sync({ force: true }); // Create Menu table (force true is safe as it's new)
        console.log('Menu table created.');
    } catch (err) {
        console.error('Failed to create Menu table:', err);
    } finally {
        await sequelize.close();
    }
}

createTable();
