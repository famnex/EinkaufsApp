const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function migrate() {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '../database.sqlite'),
        logging: false
    });

    const queryInterface = sequelize.getQueryInterface();

    try {
        await queryInterface.createTable('ProductVariations', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            category: {
                type: DataTypes.STRING
            },
            unit: {
                type: DataTypes.STRING,
                defaultValue: 'Stück'
            },
            ProductId: {
                type: DataTypes.INTEGER,
                references: {
                    model: 'Products',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            ProductVariantId: {
                type: DataTypes.INTEGER,
                references: {
                    model: 'ProductVariants',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            UserId: {
                type: DataTypes.INTEGER,
                references: {
                    model: 'Users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: DataTypes.DATE
            }
        });
        console.log('Table ProductVariations created successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
