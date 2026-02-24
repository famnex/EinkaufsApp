const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function checkColumnExists(tableName, columnName) {
    const result = await sequelize.query(
        `PRAGMA table_info(${tableName})`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return result.some(col => col.name === columnName);
}

async function tableExists(tableName) {
    const result = await sequelize.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return result.length > 0;
}

async function migrate() {
    console.log('=== Migration v0.28.0 (Subscription Lifecycle) Starting ===\n');

    try {
        // --- 1. Users table: Add subscription columns ---
        const userColumns = [
            { name: 'subscriptionStatus', sql: "ALTER TABLE Users ADD COLUMN subscriptionStatus TEXT DEFAULT 'none';" },
            { name: 'subscriptionExpiresAt', sql: "ALTER TABLE Users ADD COLUMN subscriptionExpiresAt DATETIME;" },
            { name: 'cancelAtPeriodEnd', sql: "ALTER TABLE Users ADD COLUMN cancelAtPeriodEnd BOOLEAN DEFAULT 0;" },
            { name: 'stripeCustomerId', sql: "ALTER TABLE Users ADD COLUMN stripeCustomerId TEXT;" },
            { name: 'stripeSubscriptionId', sql: "ALTER TABLE Users ADD COLUMN stripeSubscriptionId TEXT;" },
            { name: 'paypalSubscriptionId', sql: "ALTER TABLE Users ADD COLUMN paypalSubscriptionId TEXT;" },
            { name: 'pendingTier', sql: "ALTER TABLE Users ADD COLUMN pendingTier TEXT DEFAULT 'none';" },
            { name: 'lastRefillAt', sql: "ALTER TABLE Users ADD COLUMN lastRefillAt DATETIME;" },
        ];

        for (const col of userColumns) {
            if (await checkColumnExists('Users', col.name)) {
                console.log(`✓ Users.${col.name} already exists.`);
            } else {
                await sequelize.query(col.sql);
                console.log(`+ Added Users.${col.name}`);
            }
        }

        // --- 2. SubscriptionLogs table ---
        if (await tableExists('SubscriptionLogs')) {
            console.log('✓ SubscriptionLogs table already exists.');
        } else {
            const queryInterface = sequelize.getQueryInterface();
            await queryInterface.createTable('SubscriptionLogs', {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: DataTypes.INTEGER
                },
                UserId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: 'Users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                username: { type: DataTypes.STRING, allowNull: true },
                event: { type: DataTypes.STRING, allowNull: false },
                tier: { type: DataTypes.STRING, allowNull: true },
                amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
                currency: { type: DataTypes.STRING, defaultValue: 'EUR' },
                details: { type: DataTypes.TEXT, allowNull: true },
                ipHash: { type: DataTypes.STRING, allowNull: true },
                userAgent: { type: DataTypes.STRING, allowNull: true },
                createdAt: { allowNull: false, type: DataTypes.DATE }
            });
            console.log('+ Created SubscriptionLogs table');
        }

        // --- 3. CreditTransactions table ---
        if (await tableExists('CreditTransactions')) {
            console.log('✓ CreditTransactions table already exists.');
        } else {
            const queryInterface = sequelize.getQueryInterface();
            await queryInterface.createTable('CreditTransactions', {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: DataTypes.INTEGER
                },
                UserId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: 'Users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                delta: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
                description: { type: DataTypes.TEXT, allowNull: true },
                type: { type: DataTypes.STRING, allowNull: true },
                createdAt: { allowNull: false, type: DataTypes.DATE },
                updatedAt: { allowNull: false, type: DataTypes.DATE }
            });
            console.log('+ Created CreditTransactions table');
        }

        console.log('\n=== Migration v0.28.0 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
