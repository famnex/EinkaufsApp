const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function migrate() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    console.log('Database Path:', dbPath);

    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    const queryInterface = sequelize.getQueryInterface();

    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const tableInfo = await queryInterface.describeTable('RecipeSubstitutions');

        const columnsToAdd = [
            { name: 'originalQuantity', type: DataTypes.FLOAT },
            { name: 'originalUnit', type: DataTypes.STRING },
            { name: 'substituteQuantity', type: DataTypes.FLOAT },
            { name: 'substituteUnit', type: DataTypes.STRING }
        ];

        for (const col of columnsToAdd) {
            if (!tableInfo[col.name]) {
                await queryInterface.addColumn('RecipeSubstitutions', col.name, {
                    type: col.type,
                    allowNull: true
                });
                console.log(`Column "${col.name}" added to RecipeSubstitutions.`);
            } else {
                console.log(`Column "${col.name}" already exists in RecipeSubstitutions.`);
            }
        }

        console.log('Migration v0.32.7_recipe_substitution_quantities completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
