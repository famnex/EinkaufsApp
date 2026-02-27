const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('RecipeInstructionOverride', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        instructions: {
            type: DataTypes.JSON,
            allowNull: false
        },
        RecipeId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        UserId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    });
};
