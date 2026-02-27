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

        const tableInfo = await queryInterface.describeTable('ProductIntolerances');
        if (!tableInfo.probability) {
            await queryInterface.addColumn('ProductIntolerances', 'probability', {
                type: DataTypes.INTEGER,
                defaultValue: 100,
                allowNull: false
            });
            console.log('Column "probability" added to ProductIntolerances.');
        } else {
            console.log('Column "probability" already exists in ProductIntolerances.');
        }

        console.log('Migration v0.32.4_intolerance_probability completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
