const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: console.log
});

async function migrate() {
    try {
        console.log('Starting migration for v0.31.6 (Visitor Tracking)...');
        const queryInterface = sequelize.getQueryInterface();

        // 1. Create PublicVisits table
        console.log('=> Creating PublicVisits table...');
        await queryInterface.createTable('PublicVisits', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            identifierHash: {
                type: DataTypes.STRING,
                allowNull: false
            },
            targetType: {
                type: DataTypes.ENUM('cookbook', 'recipe'),
                allowNull: false
            },
            targetId: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            lastVisitAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add index for throttling
        await queryInterface.addIndex('PublicVisits', ['identifierHash', 'targetType', 'targetId'], {
            unique: true,
            name: 'public_visits_unique_throttle'
        });
        console.log('=> Created PublicVisits table and index.');

        // 2. Add cookbookClicks to Users (Ensuring it exists)
        const userTable = await queryInterface.describeTable('Users');
        if (!userTable.cookbookClicks) {
            console.log('=> Adding cookbookClicks to Users table...');
            await queryInterface.addColumn('Users', 'cookbookClicks', {
                type: DataTypes.INTEGER,
                defaultValue: 0
            });
        } else {
            console.log('=> cookbookClicks already exists in Users table.');
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
