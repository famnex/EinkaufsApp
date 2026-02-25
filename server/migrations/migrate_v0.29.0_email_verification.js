const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: console.log
});

async function migrate() {
    try {
        console.log('Starting migration v0.29.0 (Email Verification)...');

        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('Users');

        // Add isEmailVerified
        if (!tableInfo.isEmailVerified) {
            console.log('Adding isEmailVerified column...');
            await queryInterface.addColumn('Users', 'isEmailVerified', {
                type: DataTypes.BOOLEAN,
                defaultValue: true // Existing users are considered verified
            });
        }

        // Add emailVerificationToken
        if (!tableInfo.emailVerificationToken) {
            console.log('Adding emailVerificationToken column...');
            await queryInterface.addColumn('Users', 'emailVerificationToken', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        // Add pendingEmail
        if (!tableInfo.pendingEmail) {
            console.log('Adding pendingEmail column...');
            await queryInterface.addColumn('Users', 'pendingEmail', {
                type: DataTypes.STRING,
                allowNull: true
            });
        }

        // Add tokenVersion
        if (!tableInfo.tokenVersion) {
            console.log('Adding tokenVersion column...');
            await queryInterface.addColumn('Users', 'tokenVersion', {
                type: DataTypes.INTEGER,
                defaultValue: 0
            });
        }

        console.log('Migration v0.29.0 completed successfully.');
    } catch (error) {
        console.error('Migration v0.29.0 failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
