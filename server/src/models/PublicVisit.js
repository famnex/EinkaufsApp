const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('PublicVisit', {
        identifierHash: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'SHA-256 hash of IP + daily salt for anonymity'
        },
        targetType: {
            type: DataTypes.ENUM('cookbook', 'recipe'),
            allowNull: false
        },
        targetId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        lastVisitAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        indexes: [
            {
                unique: true, // Throttling: only one record per hash+target combo per window logic
                fields: ['identifierHash', 'targetType', 'targetId']
            }
        ]
    });
};
