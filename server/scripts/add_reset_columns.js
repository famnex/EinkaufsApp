const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function addResetColumns() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    const queryInterface = sequelize.getQueryInterface();

    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        console.log('Adding resetPasswordToken...');
        try {
            await queryInterface.addColumn('Users', 'resetPasswordToken', {
                type: DataTypes.STRING,
                allowNull: true
            });
            console.log('Added resetPasswordToken.');
        } catch (e) {
            console.log('resetPasswordToken might already exist:', e.message);
        }

        console.log('Adding resetPasswordExpires...');
        try {
            await queryInterface.addColumn('Users', 'resetPasswordExpires', {
                type: DataTypes.DATE,
                allowNull: true
            });
            console.log('Added resetPasswordExpires.');
        } catch (e) {
            console.log('resetPasswordExpires might already exist:', e.message);
        }

    } catch (error) {
        console.error('Error updating schema:', error);
    } finally {
        await sequelize.close();
    }
}

addResetColumns();
