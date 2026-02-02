const { sequelize, Menu, ListItem } = require('./src/models');
const { Op } = require('sequelize');

async function reset() {
    try {
        await sequelize.authenticate();
        console.log('Resetting Menu Data...');

        // 1. Delete all ListItems that originated from a Menu
        const deletedItems = await ListItem.destroy({
            where: {
                MenuId: { [Op.ne]: null }
            }
        });
        console.log(`Deleted ${deletedItems} Recipe ListItems.`);

        // 2. Delete all Menus
        const deletedMenus = await Menu.destroy({
            where: {},
            truncate: true
        });
        console.log(`Truncated Menus table.`);

        console.log('Reset Complete.');
    } catch (err) {
        console.error('Reset Failed:', err);
    }
}

reset();
