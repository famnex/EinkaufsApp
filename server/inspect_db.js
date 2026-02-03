const { sequelize } = require('./src/models');

async function inspectDatabase() {
    try {
        // Get all tables
        const tables = await sequelize.query(
            "SELECT name FROM sqlite_master WHERE type='table'",
            { type: sequelize.QueryTypes.SELECT }
        );

        console.log('=== DATABASE TABLES ===');
        console.log(tables.map(t => t.name).join(', '));
        console.log('');

        // Get ListItems schema
        console.log('=== ListItems SCHEMA ===');
        const listItemsSchema = await sequelize.query(
            "PRAGMA table_info(ListItems)",
            { type: sequelize.QueryTypes.SELECT }
        );
        console.log(listItemsSchema);
        console.log('');

        // Check if ProductRelations exists
        console.log('=== ProductRelations CHECK ===');
        const prExists = tables.find(t => t.name === 'ProductRelations');
        if (prExists) {
            const prSchema = await sequelize.query(
                "PRAGMA table_info(ProductRelations)",
                { type: sequelize.QueryTypes.SELECT }
            );
            console.log('ProductRelations exists:');
            console.log(prSchema);
        } else {
            console.log('ProductRelations does NOT exist');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

inspectDatabase();
