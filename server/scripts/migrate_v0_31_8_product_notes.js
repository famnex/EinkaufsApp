const { sequelize, Product, ListItem } = require('../src/models');
const { QueryTypes } = require('sequelize');

async function migrate() {
    console.log('Starting migration v0.31.8: Moving notes from Product to ListItem...');

    // We can't use a single transaction for everything if we need to PRAGMA foreign_keys = OFF
    // actually we can, but let's be careful.

    try {
        // 1. Add 'note' column to ListItems if it doesn't exist
        const listItemTable = await sequelize.getQueryInterface().describeTable('ListItems');
        if (!listItemTable.note) {
            console.log('Adding "note" column to ListItems...');
            await sequelize.getQueryInterface().addColumn('ListItems', 'note', {
                type: require('sequelize').DataTypes.TEXT,
                allowNull: true
            });
        }

        // 2. Transfer existing notes
        const productTable = await sequelize.getQueryInterface().describeTable('Products');
        if (productTable.note) {
            console.log('Products still has "note" column. Transferring data...');

            await sequelize.query(`
                Update ListItems 
                SET note = (SELECT note FROM Products WHERE Products.id = ListItems.ProductId)
                WHERE note IS NULL OR note = ''
            `);

            console.log('Data transfer complete.');

            // 3. Drop 'note' column from Products
            console.log('Removing "note" column from Products (disabling FKs)...');
            await sequelize.query('PRAGMA foreign_keys = OFF;');
            await sequelize.getQueryInterface().removeColumn('Products', 'note');
            await sequelize.query('PRAGMA foreign_keys = ON;');
            console.log('"note" column removed from Products.');
        }

        console.log('Migration v0.31.8 successful.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate().then(() => process.exit(0));
