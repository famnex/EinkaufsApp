const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function checkColumnExists(tableName, columnName) {
    try {
        const result = await sequelize.query(
            `PRAGMA table_info(${tableName})`,
            { type: sequelize.QueryTypes.SELECT }
        );
        return result.some(col => col.name === columnName);
    } catch (err) {
        return false;
    }
}

async function checkTableExists(tableName) {
    try {
        const result = await sequelize.query(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
            { type: sequelize.QueryTypes.SELECT }
        );
        return result.length > 0;
    } catch (err) {
        return false;
    }
}

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();
    console.log('=== Migration v0.12.0 Starting ===\n');

    try {
        // 1. Add 'note' to Products
        if (!(await checkColumnExists('Products', 'note'))) {
            console.log('Adding column: Products.note...');
            await queryInterface.addColumn('Products', 'note', {
                type: DataTypes.TEXT,
                allowNull: true
            });
            console.log('✓ Added Products.note\n');
        } else {
            console.log('✓ Products.note already exists\n');
        }

        // 2. Create ProductSubstitutions table
        if (!(await checkTableExists('ProductSubstitutions'))) {
            console.log('Creating table: ProductSubstitutions...');
            await queryInterface.createTable('ProductSubstitutions', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                originalProductId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'Products', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                substituteProductId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'Products', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                ListId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: 'Lists', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                }
            });
            console.log('✓ Created ProductSubstitutions\n');
        } else {
            console.log('✓ ProductSubstitutions table already exists\n');
        }

        console.log('=== Migration v0.12.0 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
