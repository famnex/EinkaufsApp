const { sequelize } = require('../models');

async function migrate() {
    try {
        console.log('Starting migration...');

        // Check if column exists (naive check or just try adding it)
        // SQLite doesn't support "IF NOT EXISTS" in ADD COLUMN easily in all versions, 
        // but we can try-catch it.

        try {
            await sequelize.query("ALTER TABLE Products ADD COLUMN synonyms TEXT DEFAULT '[]';");
            console.log('Successfully added synonyms column to Products table.');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('Column synonyms already exists.');
            } else {
                throw error;
            }
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
