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

        // Add intoleranceDisclaimerAccepted column to Users table
        await queryInterface.addColumn('Users', 'intoleranceDisclaimerAccepted', {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        });

        console.log('Column intoleranceDisclaimerAccepted added to Users successfully.');
        console.log('Migration intolerance_disclaimer completed successfully.');
    } catch (error) {
        if (error.name === 'SequelizeDatabaseError' && error.message.includes('duplicate column name')) {
            console.log('Column intoleranceDisclaimerAccepted already exists. Skipping...');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        await sequelize.close();
    }
}

migrate();
