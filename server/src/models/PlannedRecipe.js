const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('PlannedRecipe', {
        servings: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        settings: {
            type: DataTypes.JSON, // Stores which ingredients are selected and their preferred units
            allowNull: true
        },
        hiddenIngredients: {
            type: DataTypes.JSON, // List of ProductIds to temporarily hide
            allowNull: true
        }
    });
};
