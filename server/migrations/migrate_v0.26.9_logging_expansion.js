const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    console.log('=== Migration v0.26.9 (Logging Expansion: SubscriptionLogs) Starting ===\n');

    try {
        const queryInterface = sequelize.getQueryInterface();

        // Create SubscriptionLogs table
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
                references: {
                    model: 'Users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            username: {
                type: DataTypes.STRING,
                allowNull: true
            },
            event: {
                type: DataTypes.STRING,
                allowNull: false
            },
            tier: {
                type: DataTypes.STRING,
                allowNull: true
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true
            },
            currency: {
                type: DataTypes.STRING,
                defaultValue: 'EUR'
            },
            details: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            ipHash: {
                type: DataTypes.STRING,
                allowNull: true
            },
            userAgent: {
                type: DataTypes.STRING,
                allowNull: true
            },
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE
            }
        });

        console.log('✓ Created SubscriptionLogs table\n');
        console.log('=== Migration v0.26.9 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
