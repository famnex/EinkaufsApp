const { sequelize, Product, Manufacturer, HiddenCleanup } = require('../src/models');
const { QueryTypes } = require('sequelize');

async function migrate_remove_manufacturer() {
    console.log('Starting migration: Remove Manufacturer');

    try {
        const queryInterface = sequelize.getQueryInterface();

        // Check if Manufacturers table exists
        const tableExists = await queryInterface.showAllTables();
        if (tableExists.includes('Manufacturers')) {
            console.log('Dropping Manufacturers table...');
            await queryInterface.dropTable('Manufacturers');
        }

        // Check if ManufacturerId column exists in Products
        const productMetadata = await queryInterface.describeTable('Products');
        if (productMetadata.ManufacturerId) {
            console.log('Removing ManufacturerId column from Products table...');
            await queryInterface.removeColumn('Products', 'ManufacturerId');
        }

        // Remove hidden cleanups related to manufacturer
        if (tableExists.includes('HiddenCleanups')) {
            console.log('Removing hidden cleanups for manufacturer context...');
            await sequelize.query(`DELETE FROM HiddenCleanups WHERE context = 'manufacturer'`);
        }

        console.log('Migration Remove Manufacturer completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate_remove_manufacturer();
