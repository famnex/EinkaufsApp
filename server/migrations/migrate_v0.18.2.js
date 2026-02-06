/**
 * Migration for v0.18.2
 * 
 * Includes:
 * - Product.synonyms (TEXT/JSON)
 * - Product.isNew (BOOLEAN)
 * - Product.source (STRING)
 * - Product.is_hidden (BOOLEAN) - Ensuring consistency if missed in 0.17.x
 * - Recipe.imageSource (ENUM)
 * - List.status (ENUM)
 */

const { sequelize, DataTypes } = require('../src/models');

async function up() {
    console.log('Running migration v0.18.2...');
    const queryInterface = sequelize.getQueryInterface();
    const table = 'Products';

    try {
        const description = await queryInterface.describeTable(table);

        // 1. Synonyms (New in 0.18.0)
        if (!description.synonyms) {
            console.log('Adding synonyms column...');
            await queryInterface.addColumn(table, 'synonyms', {
                type: DataTypes.TEXT, // SQLite stores JSON as TEXT
                defaultValue: '[]'
            });
        } else {
            console.log('synonyms column already exists.');
        }

        // 2. isNew (Likely added in 0.17.x but good to ensure)
        if (!description.isNew) {
            console.log('Adding isNew column...');
            await queryInterface.addColumn(table, 'isNew', {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            });
        } else {
            console.log('isNew column already exists.');
        }

        // 3. source (Likely added in 0.17.x but good to ensure)
        if (!description.source) {
            console.log('Adding source column...');
            await queryInterface.addColumn(table, 'source', {
                type: DataTypes.STRING,
                defaultValue: 'manual'
            });
        } else {
            console.log('source column already exists.');
        }

        // 4. is_hidden (Found in schema, ensuring model consistency)
        if (!description.is_hidden) {
            console.log('Adding is_hidden column...');
            await queryInterface.addColumn(table, 'is_hidden', {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            });
        } else {
            console.log('is_hidden column already exists.');
        }

        // 5. Recipe.imageSource (Added recently)
        const recipeDesc = await queryInterface.describeTable('Recipes');
        if (!recipeDesc.imageSource) {
            console.log('Adding imageSource column to Recipes...');
            await queryInterface.addColumn('Recipes', 'imageSource', {
                type: DataTypes.ENUM('upload', 'scraped', 'ai'),
                defaultValue: 'scraped'
            });
        } else {
            console.log('Recipes.imageSource column already exists.');
        }

        // 6. List.status (Added recently)
        const listDesc = await queryInterface.describeTable('Lists');
        if (!listDesc.status) {
            console.log('Adding status column to Lists...');
            await queryInterface.addColumn('Lists', 'status', {
                type: DataTypes.ENUM('active', 'completed', 'archived'),
                defaultValue: 'active'
            });
        } else {
            console.log('Lists.status column already exists.');
        }

        console.log('Migration v0.18.2 finished.');
    } catch (err) {
        console.error('Migration v0.18.2 Failed:', err);
        throw err;
    }
}

module.exports = { up };
