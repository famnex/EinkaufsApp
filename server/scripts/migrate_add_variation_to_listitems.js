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
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
