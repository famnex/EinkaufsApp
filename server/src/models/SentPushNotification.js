const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SentPushNotification = sequelize.define('SentPushNotification', {
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        recipientCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        successCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        failureCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    });

    return SentPushNotification;
};
