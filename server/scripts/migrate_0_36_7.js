const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const { sequelize } = require('../src/models');

async function migrate() {
    console.log('--- Comprehensive Migration v0.36.7 ---');
    const queryInterface = sequelize.getQueryInterface();

    try {
        // 1. Users Table Columns
        const userTable = await queryInterface.describeTable('Users');

        const userColumns = [
            { name: 'intoleranceDisclaimerAccepted', type: DataTypes.BOOLEAN, defaultValue: false },
            { name: 'followNotificationsEnabled', type: DataTypes.BOOLEAN, defaultValue: true },
            { name: 'lastFollowedUpdatesCheck', type: DataTypes.DATE, allowNull: true },
            { name: 'lastFollowedUpdatesNudgeSent', type: DataTypes.DATE, allowNull: true }
        ];

        for (const col of userColumns) {
            if (!userTable[col.name]) {
                console.log(`Adding column: Users.${col.name}`);
                await queryInterface.addColumn('Users', col.name, {
                    type: col.type,
                    allowNull: col.allowNull !== undefined ? col.allowNull : true,
                    defaultValue: col.defaultValue
                });
            }
        }

        // 2. New Tables (using IF NOT EXISTS logic via a helper)
        const createTableIfNotExists = async (tableName, attributes) => {
            try {
                await queryInterface.createTable(tableName, attributes);
                console.log(`Table ${tableName} created or already exists.`);
            } catch (err) {
                if (!err.message.includes('already exists')) throw err;
                console.log(`Table ${tableName} already exists.`);
            }
        };

        // ProductVariants
        await createTableIfNotExists('ProductVariants', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            title: { type: DataTypes.STRING, allowNull: false },
            UserId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false }
        });

        // ProductVariations
        await createTableIfNotExists('ProductVariations', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            category: { type: DataTypes.STRING },
            unit: { type: DataTypes.STRING, defaultValue: 'Stück' },
            ProductId: { type: DataTypes.INTEGER, references: { model: 'Products', key: 'id' }, onDelete: 'CASCADE' },
            ProductVariantId: { type: DataTypes.INTEGER, references: { model: 'ProductVariants', key: 'id' } },
            UserId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false }
        });

        // Intolerances
        await createTableIfNotExists('Intolerances', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            name: { type: DataTypes.STRING, allowNull: false, unique: true },
            warningText: { type: DataTypes.STRING, allowNull: true },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false }
        });

        // UserIntolerances
        await createTableIfNotExists('UserIntolerances', {
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
            UserId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' }, primaryKey: true },
            IntoleranceId: { type: DataTypes.INTEGER, references: { model: 'Intolerances', key: 'id' }, primaryKey: true }
        });

        // ProductIntolerances
        await createTableIfNotExists('ProductIntolerances', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            probability: { type: DataTypes.INTEGER, defaultValue: 100 },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
            ProductId: { type: DataTypes.INTEGER, references: { model: 'Products', key: 'id' } },
            IntoleranceId: { type: DataTypes.INTEGER, references: { model: 'Intolerances', key: 'id' } }
        });

        // UserProductIntolerances
        await createTableIfNotExists('UserProductIntolerances', {
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
            UserId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' }, primaryKey: true },
            ProductId: { type: DataTypes.INTEGER, references: { model: 'Products', key: 'id' }, primaryKey: true }
        });

        // RecipeSubstitutions
        await createTableIfNotExists('RecipeSubstitutions', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            originalQuantity: { type: DataTypes.FLOAT, allowNull: true },
            originalUnit: { type: DataTypes.STRING, allowNull: true },
            substituteQuantity: { type: DataTypes.FLOAT, allowNull: true },
            substituteUnit: { type: DataTypes.STRING, allowNull: true },
            isOmitted: { type: DataTypes.BOOLEAN, defaultValue: false },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
            RecipeId: { type: DataTypes.INTEGER, references: { model: 'Recipes', key: 'id' } },
            originalProductId: { type: DataTypes.INTEGER, references: { model: 'Products', key: 'id' } },
            substituteProductId: { type: DataTypes.INTEGER, references: { model: 'Products', key: 'id' } },
            UserId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } }
        });

        // RecipeInstructionOverrides
        await createTableIfNotExists('RecipeInstructionOverrides', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            instructions: { type: DataTypes.JSON, allowNull: false },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
            RecipeId: { type: DataTypes.INTEGER, references: { model: 'Recipes', key: 'id' } },
            UserId: { type: DataTypes.INTEGER, references: { model: 'Users', key: 'id' } }
        });

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
