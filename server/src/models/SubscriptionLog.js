const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SubscriptionLog = sequelize.define('SubscriptionLog', {
        UserId: { type: DataTypes.INTEGER, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        event: { type: DataTypes.STRING, allowNull: false }, // subscription_created, canceled, expired, downgraded, etc.
        tier: { type: DataTypes.STRING, allowNull: true },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        currency: { type: DataTypes.STRING, defaultValue: 'EUR' },
        details: { type: DataTypes.TEXT, allowNull: true }, // Store JSON or error messages
        ipHash: { type: DataTypes.STRING, allowNull: true },
        userAgent: { type: DataTypes.STRING, allowNull: true }
    }, {
        updatedAt: false
    });

    return SubscriptionLog;
};
