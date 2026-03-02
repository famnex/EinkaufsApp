const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('RecipeIngredient', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        RecipeId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: false
        },
        ProductId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        quantity: { type: DataTypes.FLOAT, allowNull: false },
        unit: { type: DataTypes.STRING },
        originalName: { type: DataTypes.STRING, allowNull: true },
        isOptional: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    });
};
