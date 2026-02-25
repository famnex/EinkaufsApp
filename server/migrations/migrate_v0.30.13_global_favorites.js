const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../database.sqlite'),
    logging: console.log
});

async function migrate() {
    try {
        console.log('Starting migration to create FavoriteRecipes join table...');
        const queryInterface = sequelize.getQueryInterface();

        await queryInterface.createTable('FavoriteRecipes', {
            UserId: {
                type: DataTypes.INTEGER,
                references: { model: 'Users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                primaryKey: true
            },
            RecipeId: {
                type: DataTypes.INTEGER,
                references: { model: 'Recipes', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                primaryKey: true
            },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false }
        });
        console.log('=> Created FavoriteRecipes table.');

        console.log('=> Migrating existing favorites...');
        await sequelize.query(`
            INSERT INTO FavoriteRecipes (UserId, RecipeId, createdAt, updatedAt)
            SELECT UserId, id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM Recipes WHERE isFavorite = 1;
        `);
        console.log('=> Migrated existing favorites.');

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
