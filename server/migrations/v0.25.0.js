const { Sequelize } = require('sequelize');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: console.log
});

const migrate = async () => {
    try {
        const queryInterface = sequelize.getQueryInterface();

        // 1. ComplianceReports Table Check
        const complianceTableDesc = await queryInterface.describeTable('ComplianceReports');

        // Add accusedUserId if missing
        if (!complianceTableDesc.accusedUserId) {
            await queryInterface.addColumn('ComplianceReports', 'accusedUserId', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'Users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
            console.log('Added accusedUserId column to ComplianceReports.');
        } else {
            console.log('accusedUserId column already exists.');
        }

        // Add internalNote if missing
        if (!complianceTableDesc.internalNote) {
            await queryInterface.addColumn('ComplianceReports', 'internalNote', {
                type: Sequelize.TEXT,
                allowNull: true
            });
            console.log('Added internalNote column to ComplianceReports.');
        } else {
            console.log('internalNote column already exists.');
        }

        // 2. Users Table Check
        const userTableDesc = await queryInterface.describeTable('Users');

        // Add bannedAt if missing
        if (!userTableDesc.bannedAt) {
            await queryInterface.addColumn('Users', 'bannedAt', {
                type: Sequelize.DATE,
                allowNull: true
            });
            console.log('Added bannedAt column to Users.');
        } else {
            console.log('bannedAt column already exists.');
        }

        // Add newsletter fields if missing (safety check)
        if (!userTableDesc.newsletterSignedUp) {
            await queryInterface.addColumn('Users', 'newsletterSignedUp', {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            });
            console.log('Added newsletterSignedUp column to Users.');
        }

        if (!userTableDesc.newsletterSignupDate) {
            await queryInterface.addColumn('Users', 'newsletterSignupDate', {
                type: Sequelize.DATE,
                allowNull: true
            });
            console.log('Added newsletterSignupDate column to Users.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
};

migrate();
