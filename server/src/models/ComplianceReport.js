module.exports = (sequelize) => {
    const { DataTypes } = require('sequelize');

    const ComplianceReport = sequelize.define('ComplianceReport', {
        reporterName: { type: DataTypes.STRING, allowNull: false },
        reporterEmail: { type: DataTypes.STRING, allowNull: false },
        reporterRole: {
            type: DataTypes.ENUM('Urheber', 'Vertreter', 'Nutzer'),
            allowNull: false
        },
        contentUrl: { type: DataTypes.STRING, allowNull: false },
        contentType: {
            type: DataTypes.ENUM('Text', 'Foto', 'Video', 'Nutzername', 'Sonstiges'),
            allowNull: false
        },
        reasonCategory: {
            type: DataTypes.ENUM(
                'Urheberrechtsverletzung',
                'Persönlichkeitsrechtsverletzung',
                'Beleidigung / Hassrede',
                'Gefährliche Inhalte',
                'Spam / Werbung',
                'Sonstiges'
            ),
            allowNull: false
        },
        reasonDescription: { type: DataTypes.TEXT, allowNull: false },
        originalSourceUrl: { type: DataTypes.STRING, allowNull: true },
        status: {
            type: DataTypes.ENUM('open', 'investigating', 'resolved', 'dismissed'),
            defaultValue: 'open'
        },
        resolutionNote: { type: DataTypes.TEXT, allowNull: true },
        internalNote: { type: DataTypes.TEXT, allowNull: true },
        screenshotPath: { type: DataTypes.STRING, allowNull: true },
        accusedUserId: { type: DataTypes.INTEGER, allowNull: true }
    });

    ComplianceReport.associate = (models) => {
        ComplianceReport.belongsTo(models.User, { as: 'AccusedUser', foreignKey: 'accusedUserId' });
    };

    return ComplianceReport;
};
