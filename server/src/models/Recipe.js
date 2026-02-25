const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Recipe', {
        title: { type: DataTypes.STRING, allowNull: false },
        category: { type: DataTypes.STRING },
        image_url: { type: DataTypes.STRING },
        prep_time: { type: DataTypes.INTEGER }, // minutes
        duration: { type: DataTypes.INTEGER }, // minutes
        servings: { type: DataTypes.INTEGER, defaultValue: 1 },
        instructions: { type: DataTypes.JSON }, // Array of strings or rich text
        imageSource: {
            type: DataTypes.ENUM('upload', 'scraped', 'ai', 'none'),
            defaultValue: 'scraped'
        },
        bannedAt: { type: DataTypes.DATE, allowNull: true }
    });
};

