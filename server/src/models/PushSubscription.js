const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PushSubscription = sequelize.define('PushSubscription', {
        endpoint: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: true
        },
        p256dh: {
            type: DataTypes.STRING,
            allowNull: false
        },
        auth: {
            type: DataTypes.STRING,
            allowNull: false
        }
    });

    return PushSubscription;
};
