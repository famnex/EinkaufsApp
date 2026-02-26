const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
console.log('Database Path:', dbPath);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: console.log,
});

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Add PredecessorVariationId
        try {
            await sequelize.query(`
                ALTER TABLE ProductRelations
                ADD COLUMN PredecessorVariationId INTEGER NULL;
            `);
            console.log('Added PredecessorVariationId column successfully.');
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column PredecessorVariationId already exists.');
            } else {
                console.error('Error adding PredecessorVariationId column:', err);
            }
        }

        // Add SuccessorVariationId
        try {
            await sequelize.query(`
                ALTER TABLE ProductRelations
                ADD COLUMN SuccessorVariationId INTEGER NULL;
            `);
            console.log('Added SuccessorVariationId column successfully.');
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column SuccessorVariationId already exists.');
            } else {
                console.error('Error adding SuccessorVariationId column:', err);
            }
        }

        console.log('Migration completed.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
