const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    try {
        console.log('Starting consolidated migration v0.26.4: Schema Fixes...');
        await sequelize.authenticate();
        const queryInterface = sequelize.getQueryInterface();

        // --- USERS TABLE ---
        const userTableInfo = await queryInterface.describeTable('Users');

        const userFields = [
            { name: 'bannedAt', type: DataTypes.DATE },
            { name: 'banReason', type: DataTypes.TEXT },
            { name: 'banExpiresAt', type: DataTypes.DATE },
            { name: 'isPermanentlyBanned', type: DataTypes.BOOLEAN, defaultValue: false },
            { name: 'newsletterSignedUp', type: DataTypes.BOOLEAN, defaultValue: false },
            { name: 'newsletterSignupDate', type: DataTypes.DATE },
            { name: 'resetPasswordToken', type: DataTypes.STRING },
            { name: 'resetPasswordExpires', type: DataTypes.DATE }
        ];

        for (const field of userFields) {
            if (!userTableInfo[field.name]) {
                console.log(`Adding ${field.name} to Users table...`);
                await queryInterface.addColumn('Users', field.name, {
                    type: field.type,
                    allowNull: true,
                    defaultValue: field.defaultValue !== undefined ? field.defaultValue : null
                });
            }
        }

        // --- RECIPES TABLE ---
        const recipeTableInfo = await queryInterface.describeTable('Recipes');
        if (!recipeTableInfo['bannedAt']) {
            console.log('Adding bannedAt to Recipes table...');
            await queryInterface.addColumn('Recipes', 'bannedAt', {
                type: DataTypes.DATE,
                allowNull: true
            });
        }

        // --- COMPLIANCE REPORTS TABLE ---
        // ComplianceReport is relatively new, ensure it exists or has all fields
        try {
            const reportTableInfo = await queryInterface.describeTable('ComplianceReports');
            if (!reportTableInfo['screenshotPath']) {
                console.log('Adding screenshotPath to ComplianceReports table...');
                await queryInterface.addColumn('ComplianceReports', 'screenshotPath', {
                    type: DataTypes.STRING,
                    allowNull: true
                });
            }
        } catch (e) {
            console.log('ComplianceReports table might not exist yet, sequelize.sync() should handle creation if alter:true was used, but we are being safe.');
        }

        console.log('Consolidated migration v0.26.4 successful.');

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

migrate();
