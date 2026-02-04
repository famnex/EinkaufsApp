const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();

    console.log('Running Migration v0.10.5: Create HiddenCleanups table...');

    try {
        await queryInterface.createTable('HiddenCleanups', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            context: {
                type: DataTypes.ENUM('category', 'manufacturer', 'unit'),
                allowNull: false
            },
            ProductId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Products',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: new Date()
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: new Date()
            }
        });

        console.log('Migration v0.10.5 completed.');
    } catch (error) {
        console.error('Migration v0.10.5 failed:', error);
    }
}

migrate();
