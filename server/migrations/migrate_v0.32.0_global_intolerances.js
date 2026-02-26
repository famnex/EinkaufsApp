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

        // 1. Drop old table if exists (structure changed significantly)
        try {
            await queryInterface.dropTable('Intolerances');
            console.log('Previous Intolerances table dropped.');
        } catch (e) { }

        // 2. Create Global Intolerances table
        await queryInterface.createTable('Intolerances', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
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
        console.log('Table Intolerances (Global) created.');

        // 3. Create UserIntolerances Join Table
        await queryInterface.createTable('UserIntolerances', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
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
        console.log('Table UserIntolerances (Join) created.');

        // 4. Seed with defaults
        const now = new Date();
        const defaults = ['Laktose', 'Gluten', 'Glutamat', 'Fruktose', 'Nüsse', 'Eier', 'Soja', 'Milcheiweiß'].map(name => ({
            name,
            createdAt: now,
            updatedAt: now
        }));

        await queryInterface.bulkInsert('Intolerances', defaults);
        console.log('Default intolerances seeded.');

        console.log('Migration global_intolerances completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
