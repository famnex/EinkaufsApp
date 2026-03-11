const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || path.join(__dirname, '../database.sqlite'),
    logging: false
});

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // For SQLite, modifying ENUMs is not strictly checked or is handled gracefully by Sequelize.
        // The models have been updated. 
        console.log('Checking database...');

        // Let's ensure the table is updated if needed. Wait, in SQLite Enum constraints are check constraints.
        // It's usually easier to let Sequelize handle it or manually recreate the constraint if we really need to,
        // but for now, testing if queryInterface can do it.
        const queryInterface = sequelize.getQueryInterface();
        await queryInterface.changeColumn('HiddenCleanups', 'context', {
            type: DataTypes.ENUM('category', 'unit', 'pipeline'),
            allowNull: false,
        });

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
