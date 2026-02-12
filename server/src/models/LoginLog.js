const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const LoginLog = sequelize.define('LoginLog', {
        username: { type: DataTypes.STRING, allowNull: true }, // Store username even if login failed
        UserId: { type: DataTypes.INTEGER, allowNull: true },  // Null if login failed
        event: {
            type: DataTypes.ENUM('login_success', 'login_failed', 'password_reset'),
            allowNull: false
        },
        ipHash: { type: DataTypes.STRING, allowNull: false },
        userAgent: { type: DataTypes.STRING, allowNull: true }
    }, {
        updatedAt: false // We only care about creation time
    });

    return LoginLog;
};
