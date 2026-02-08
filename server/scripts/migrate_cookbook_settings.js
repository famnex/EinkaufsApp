const { sequelize } = require('../src/models');

async function migrate() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('Users');

        if (!tableInfo.cookbookTitle) {
            console.log('Adding cookbookTitle column...');
            await queryInterface.addColumn('Users', 'cookbookTitle', {
                type: require('sequelize').DataTypes.STRING,
                defaultValue: 'MEIN KOCHBUCH'
            });
        }

        if (!tableInfo.cookbookImage) {
            console.log('Adding cookbookImage column...');
            await queryInterface.addColumn('Users', 'cookbookImage', {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            });
        }

        console.log('Migration successful!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
