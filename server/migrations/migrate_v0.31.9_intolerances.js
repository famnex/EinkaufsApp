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

        // Create Intolerances table
        try {
            await queryInterface.createTable('Intolerances', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                    allowNull: false
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false
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
            console.log('Table Intolerances created successfully.');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('Table Intolerances already exists.');
            } else {
                throw err;
            }
        }

        console.log('Migration v0.32.0 completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
