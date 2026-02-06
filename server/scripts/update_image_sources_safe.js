const { sequelize, Recipe } = require('../src/models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Check if column exists or add it via Raw SQL (safer for SQLite)
        try {
            await sequelize.query("ALTER TABLE Recipes ADD COLUMN imageSource TEXT DEFAULT 'scraped';");
            console.log("Column 'imageSource' added.");
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log("Column 'imageSource' already exists.");
            } else {
                throw e;
            }
        }

        // 2. Update existing records
        const [results, metadata] = await sequelize.query("UPDATE Recipes SET imageSource = 'scraped' WHERE image_url IS NOT NULL;");
        console.log("Updated records to 'scraped'.");

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
