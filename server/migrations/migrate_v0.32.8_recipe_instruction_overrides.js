const { DataTypes } = require('sequelize');

module.exports = {
    up: async ({ context: sequelize }) => {
        const queryInterface = sequelize.getQueryInterface();
        await queryInterface.createTable('RecipeInstructionOverrides', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            instructions: {
                type: DataTypes.JSON,
                allowNull: false
            },
            RecipeId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Recipes',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            UserId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Users',
                    key: 'id'
                },
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
    },
    down: async ({ context: sequelize }) => {
        const queryInterface = sequelize.getQueryInterface();
        await queryInterface.dropTable('RecipeInstructionOverrides');
    }
};
