/**
 * Migration v0.18.2 (Comprehensive)
 * 
 * Automatically detects and adds any missing columns for ALL models
 * defined in Sequelize but missing in the SQLite database.
 * 
 * This covers:
 * - Product: synonyms, isNew, source, is_hidden
 * - Recipe: imageSource
 * - List: status
 * - And any future/missed columns automatically.
 */

const { sequelize } = require('../src/models');

async function up() {
    console.log('Running comprehensive schema check (v0.18.2)...');

    const queryInterface = sequelize.getQueryInterface();
    const models = sequelize.models;

    try {
        // Iterate over every model defined in our code
        for (const modelName of Object.keys(models)) {
            const model = models[modelName];
            const tableName = model.tableName;

            console.log(`Checking table: ${tableName}`);

            // Get current DB structure
            const tableDesc = await queryInterface.describeTable(tableName).catch(err => {
                console.warn(`Table ${tableName} does not exist? skipping...`, err.message);
                return null;
            });

            if (!tableDesc) continue;

            // Iterate over every attribute (column) defined in the model
            for (const [colName, attribute] of Object.entries(model.rawAttributes)) {
                // Skip if column already exists
                if (tableDesc[colName]) continue;

                console.log(`[FIX] Adding missing column: ${tableName}.${colName}`);

                try {
                    // Use the definition from the model to add the column
                    await queryInterface.addColumn(tableName, colName, attribute);
                    console.log(`   -> Success: Added ${colName}`);
                } catch (colErr) {
                    console.error(`   -> Failed to add ${colName}:`, colErr.message);
                }
            }
        }

        console.log('Schema synchronization finished.');
    } catch (err) {
        console.error('Migration Failed:', err);
        throw err;
    }
}

module.exports = { up };
