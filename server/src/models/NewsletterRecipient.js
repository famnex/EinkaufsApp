const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('NewsletterRecipient', {
        status: {
            type: DataTypes.ENUM('pending', 'sent', 'failed'),
            defaultValue: 'pending'
        },
        error: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        sentAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        timestamps: true
    });
};
