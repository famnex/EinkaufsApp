const { sequelize, User, Manufacturer, Store, Product, List, ListItem, Menu, Expense, Recipe, RecipeIngredient, Tag, ProductRelation, Settings, HiddenCleanup, ProductSubstitution, RecipeTag } = require('../src/models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established.');

        const queryInterface = sequelize.getQueryInterface();

        // 1. Ensure columns exist using raw SQL (safer for SQLite)
        const tables = [
            'Manufacturers', 'Stores', 'Products', 'Lists', 'ListItems', 'Menus', 'Expenses',
            'Recipes', 'RecipeIngredients', 'Tags', 'ProductRelations', 'Settings',
            'HiddenCleanups', 'ProductSubstitutions', 'RecipeTags'
        ];

        for (const table of tables) {
            const tableDefinition = await queryInterface.describeTable(table).catch(() => ({}));
            if (!tableDefinition.UserId) {
                console.log(`Adding UserId to ${table}...`);
                await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`UserId\` INTEGER REFERENCES \`Users\`(\`id\`);`);
            }
        }

        // Add alexaApiKey to Users
        const usersDefinition = await queryInterface.describeTable('Users').catch(() => ({}));
        if (!usersDefinition.alexaApiKey) {
            console.log('Adding alexaApiKey to Users...');
            await sequelize.query('ALTER TABLE `Users` ADD COLUMN `alexaApiKey` VARCHAR(255);');
        }

        // 2. Sync to ensure indexes and associations (without alter which is buggy)
        await sequelize.sync();
        console.log('Database synced.');

        // 3. Ensure at least one user exists
        let primaryUser = await User.findOne({ where: { role: 'admin' } });
        if (!primaryUser) {
            primaryUser = await User.findOne();
        }

        if (!primaryUser) {
            console.log('No user found. Creating a default admin user...');
            primaryUser = await User.create({
                username: 'admin',
                role: 'admin',
                isLdap: false
            });
        }

        console.log(`Using user ID ${primaryUser.id} (${primaryUser.username}) as the primary user for migration.`);

        const userId = primaryUser.id;

        // 4. Update all records to have the primary UserId
        const modelsToUpdate = [
            { model: Manufacturer, table: 'Manufacturers' },
            { model: Store, table: 'Stores' },
            { model: Product, table: 'Products' },
            { model: List, table: 'Lists' },
            { model: ListItem, table: 'ListItems' },
            { model: Menu, table: 'Menus' },
            { model: Expense, table: 'Expenses' },
            { model: Recipe, table: 'Recipes' },
            { model: RecipeIngredient, table: 'RecipeIngredients' },
            { model: Tag, table: 'Tags' },
            { model: ProductRelation, table: 'ProductRelations' },
            { model: Settings, table: 'Settings' },
            { model: HiddenCleanup, table: 'HiddenCleanups' },
            { model: ProductSubstitution, table: 'ProductSubstitutions' },
            { model: RecipeTag, table: 'RecipeTags' }
        ];

        for (const { model, table } of modelsToUpdate) {
            const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM \`${table}\` WHERE \`UserId\` IS NULL;`);
            const count = results[0].count;
            if (count > 0) {
                console.log(`Updating ${count} records in ${table}...`);
                await sequelize.query(`UPDATE \`${table}\` SET \`UserId\` = ? WHERE \`UserId\` IS NULL;`, {
                    replacements: [userId]
                });
            } else {
                console.log(`No records to update in ${table}.`);
            }
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
