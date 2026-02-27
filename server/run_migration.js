const { sequelize } = require('./src/models');
const migration = require('./migrations/migrate_v0.32.8_recipe_instruction_overrides');

async function run() {
    try {
        console.log('Running migration: migrate_v0.32.8_recipe_instruction_overrides');
        await migration.up({ context: sequelize });
        console.log('Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
