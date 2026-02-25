const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: console.log
});

async function migrate() {
    try {
        console.log('Starting migration to add isCommunityVisible to Users table...');
        const queryInterface = sequelize.getQueryInterface();

        await queryInterface.addColumn('Users', 'isCommunityVisible', {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        });

        console.log('=> Added isCommunityVisible column.');

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
