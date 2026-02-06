const { sequelize, DataTypes } = require('../models');

async function run() {
    console.log('--- MANUAL COLUMN FIXER START ---');
    const queryInterface = sequelize.getQueryInterface();

    const SafeAddColumn = async (table, column, type, defaultValue) => {
        try {
            console.log(`Attempting to add ${table}.${column}...`);
            await queryInterface.addColumn(table, column, { type, defaultValue });
            console.log(`✅ Success: Added ${table}.${column}`);
        } catch (err) {
            console.log(`⚠️  Skipped ${table}.${column} (probably exists):`, err.message);
        }
    };

    try {
        // Products
        await SafeAddColumn('Products', 'synonyms', DataTypes.TEXT, '[]');
        await SafeAddColumn('Products', 'isNew', DataTypes.BOOLEAN, false);
        await SafeAddColumn('Products', 'source', DataTypes.STRING, 'manual');
        await SafeAddColumn('Products', 'is_hidden', DataTypes.BOOLEAN, false);

        // Recipes
        await SafeAddColumn('Recipes', 'imageSource', DataTypes.ENUM('upload', 'scraped', 'ai'), 'scraped');

        // Lists
        await SafeAddColumn('Lists', 'status', DataTypes.ENUM('active', 'completed', 'archived'), 'active');

        console.log('--- MANUAL COLUMN FIXER DONE ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Critical Error:', err);
        process.exit(1);
    }
}

run();
