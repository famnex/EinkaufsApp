const { sequelize } = require('../models');
const { DataTypes } = require('sequelize');

async function run() {
    console.log('--- SUBSCRIPTION MIGRATION START ---');
    const queryInterface = sequelize.getQueryInterface();

    const SafeAddColumn = async (table, column, type, defaultValue) => {
        try {
            console.log(`Attempting to add ${table}.${column}...`);
            await queryInterface.addColumn(table, column, { type, defaultValue });
            console.log(`✅ Success: Added ${table}.${column}`);
        } catch (err) {
            console.log(`⚠️  Skipped ${table}.${column} (probably exists):`, err.message);
        }
    };

    try {
        // User Subscription Fields
        await SafeAddColumn('Users', 'subscriptionStatus', DataTypes.ENUM('active', 'canceled', 'past_due', 'none'), 'none');
        await SafeAddColumn('Users', 'subscriptionExpiresAt', DataTypes.DATE, null);
        await SafeAddColumn('Users', 'cancelAtPeriodEnd', DataTypes.BOOLEAN, false);
        await SafeAddColumn('Users', 'stripeCustomerId', DataTypes.STRING, null);
        await SafeAddColumn('Users', 'stripeSubscriptionId', DataTypes.STRING, null);
        await SafeAddColumn('Users', 'paypalSubscriptionId', DataTypes.STRING, null);

        console.log('--- SUBSCRIPTION MIGRATION DONE ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Critical Error during migration:', err);
        process.exit(1);
    }
}

run();
