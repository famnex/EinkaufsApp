const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Tag', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        color: {
            type: DataTypes.STRING,
            defaultValue: 'blue' // Default color for UI
        }
    });
};
