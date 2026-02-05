const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: console.log
});

const run = async () => {
    const queryInterface = sequelize.getQueryInterface();
    const table = 'Products';

    console.log('Checking Products table...');
    try {
        const description = await queryInterface.describeTable(table);

        if (!description.isNew) {
            console.log('Adding isNew column...');
            await queryInterface.addColumn(table, 'isNew', {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            });
        } else {
            console.log('isNew column already exists.');
        }

        if (!description.source) {
            console.log('Adding source column...');
            await queryInterface.addColumn(table, 'source', {
                type: DataTypes.STRING,
                defaultValue: 'manual'
            });
        } else {
            console.log('source column already exists.');
        }

        console.log('Done.');
    } catch (err) {
        console.error('Error:', err);
    }
};

run().then(() => process.exit());
