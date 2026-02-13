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

        if (!tableDescription.internalNote) {
            await queryInterface.addColumn('ComplianceReports', 'internalNote', {
                type: Sequelize.TEXT,
                allowNull: true
            });
            console.log('Added internalNote column to ComplianceReports table.');
        } else {
            console.log('internalNote column already exists.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
};

migrate();
