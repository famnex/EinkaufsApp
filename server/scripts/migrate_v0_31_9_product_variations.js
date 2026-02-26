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

        // 1. Create ProductVariants
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
                throw err;
            }
        }

        // 2. Create ProductVariations
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
            if (error.message.includes('already exists')) {
                console.log('Table ProductVariations already exists.');
            } else {
                throw error;
            }
        }

        // 3. Add ProductVariationId to ListItems
        try {
            await queryInterface.addColumn('ListItems', 'ProductVariationId', {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'ProductVariations',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
            console.log('Column ProductVariationId added to ListItems successfully.');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('Column ProductVariationId already exists in ListItems.');
            } else {
                console.error('Error adding ProductVariationId to ListItems:', error);
            }
        }

        // 4. Add PredecessorVariationId to ProductRelations
        try {
            await sequelize.query(`
                ALTER TABLE ProductRelations
                ADD COLUMN PredecessorVariationId INTEGER NULL;
            `);
            console.log('Added PredecessorVariationId column successfully.');
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column PredecessorVariationId already exists.');
            } else {
                console.error('Error adding PredecessorVariationId column:', err);
            }
        }

        // 5. Add SuccessorVariationId to ProductRelations
        try {
            await sequelize.query(`
                ALTER TABLE ProductRelations
                ADD COLUMN SuccessorVariationId INTEGER NULL;
            `);
            console.log('Added SuccessorVariationId column successfully.');
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column SuccessorVariationId already exists.');
            } else {
                console.error('Error adding SuccessorVariationId column:', err);
            }
        }

        console.log('Migration v0.31.9 completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
