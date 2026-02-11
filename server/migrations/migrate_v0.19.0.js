const { sequelize, User, Manufacturer, Store, Product, List, ListItem, Menu, Expense, Recipe, RecipeIngredient, Tag, ProductRelation, Settings, HiddenCleanup, ProductSubstitution, RecipeTag } = require('../src/models');
const crypto = require('crypto');
const { DataTypes } = require('sequelize');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established.');

        const queryInterface = sequelize.getQueryInterface();

        // 1. Multi-User: Add UserId to all target tables
        const tables = [
            'Manufacturers', 'Stores', 'Products', 'Lists', 'ListItems', 'Menus', 'Expenses',
            'Recipes', 'RecipeIngredients', 'Tags', 'ProductRelations', 'Settings',
            'HiddenCleanups', 'ProductSubstitutions', 'RecipeTags'
        ];

        for (const table of tables) {
            const tableDefinition = await queryInterface.describeTable(table).catch(() => ({}));
            if (!tableDefinition.UserId) {
                console.log(`Adding UserId to ${table}...`);
                // Using raw SQL for SQLite compatibility and specific FK constraint
                await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`UserId\` INTEGER REFERENCES \`Users\`(\`id\`);`);
            }
        }

        // 2. Sharing Keys & Alexa API Key
        const usersDefinition = await queryInterface.describeTable('Users').catch(() => ({}));

        if (!usersDefinition.alexaApiKey) {
            console.log('Adding alexaApiKey to Users...');
            await queryInterface.addColumn('Users', 'alexaApiKey', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        if (!usersDefinition.sharingKey) {
            console.log('Adding sharingKey to Users...');
            await queryInterface.addColumn('Users', 'sharingKey', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        // 3. Cookbook Customization
        if (!usersDefinition.cookbookTitle) {
            console.log('Adding cookbookTitle to Users...');
            await queryInterface.addColumn('Users', 'cookbookTitle', {
                type: DataTypes.STRING,
                defaultValue: 'MEIN KOCHBUCH'
            });
        }

        if (!usersDefinition.cookbookImage) {
            console.log('Adding cookbookImage to Users...');
            await queryInterface.addColumn('Users', 'cookbookImage', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        // Sync models to ensure internal state is correct
        await sequelize.sync();
        console.log('Database schema updated and synced.');

        // 4. Data Migration: Assign existing data to primary user
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

        const userId = primaryUser.id;
        console.log(`Using user ID ${userId} (${primaryUser.username}) as the primary user for existing data.`);

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
            // Settings excluded to prevent resetting global settings to admin user
            // { model: Settings, table: 'Settings' },
            { model: HiddenCleanup, table: 'HiddenCleanups' },
            { model: ProductSubstitution, table: 'ProductSubstitutions' },
            { model: RecipeTag, table: 'RecipeTags' }
        ];

        for (const { model, table } of modelsToUpdate) {
            const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM \`${table}\` WHERE \`UserId\` IS NULL;`);
            const count = results[0].count;
            if (count > 0) {
                console.log(`Assigning ${count} records in ${table} to user ${userId}...`);
                await sequelize.query(`UPDATE \`${table}\` SET \`UserId\` = ? WHERE \`UserId\` IS NULL;`, {
                    replacements: [userId]
                });
            }
        }

        // 5. Generate missing sharing keys
        const users = await User.findAll();
        for (const user of users) {
            if (!user.sharingKey) {
                const key = crypto.randomBytes(8).toString('hex');
                await user.update({ sharingKey: key });
                console.log(`Generated sharingKey for ${user.username}: ${key}`);
            }
        }

        console.log('Migration v0.19.0 completed successfully.');
    } catch (error) {
        console.error('Migration v0.19.0 failed:', error);
        throw error;
    }
}

if (require.main === module) {
    migrate().then(() => {
        console.log('Migration script finished.');
        process.exit(0);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = migrate;
