const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function migrate() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    console.log('Database Path:', dbPath);

    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    const queryInterface = sequelize.getQueryInterface();

    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Create ProductIntolerances join table
        await queryInterface.createTable('ProductIntolerances', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER
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
            IntoleranceId: {
                type: DataTypes.INTEGER,
                references: {
                    model: 'Intolerances',
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

        console.log('Table ProductIntolerances created successfully.');
        console.log('Migration product_intolerances completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
