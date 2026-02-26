const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function migrate() {
    console.log('Starting migration: Creating ProductVariants table...');
    const queryInterface = sequelize.getQueryInterface();

    try {
        await queryInterface.createTable('ProductVariants', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false
            },
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: DataTypes.DATE
            },
            UserId: {
                type: DataTypes.INTEGER,
                references: {
                    model: 'Users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            }
        });
        console.log('Table ProductVariants created successfully.');
    } catch (err) {
        if (err.message.includes('already exists')) {
            console.log('Table ProductVariants already exists.');
        } else {
            console.error('Migration failed:', err);
            process.exit(1);
        }
    }
}

migrate().then(() => process.exit(0));
