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
        const tableDescription = await queryInterface.describeTable('ComplianceReports');

        if (!tableDescription.accusedUserId) {
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
            console.log('Added accusedUserId column to ComplianceReports table.');
        } else {
            console.log('accusedUserId column already exists.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
};

migrate();
