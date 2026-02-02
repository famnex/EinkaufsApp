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
            allowNull: false
        },
        quantity: { type: DataTypes.FLOAT, allowNull: false },
        unit: { type: DataTypes.STRING }
    });
};
