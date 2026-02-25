const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Newsletter', {
        subject: {
            type: DataTypes.STRING,
            allowNull: false
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('draft', 'sending', 'completed', 'failed'),
            defaultValue: 'draft'
        },
        recipientsCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        sentCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        failedCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        batchSize: {
            type: DataTypes.INTEGER,
            defaultValue: 50
        },
        waitMinutes: {
            type: DataTypes.INTEGER,
            defaultValue: 5
        },
        footer: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        timestamps: true
    });
};
