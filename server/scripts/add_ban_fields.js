const { sequelize } = require('../src/models');

async function migrate() {
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('Users');

    const columnsToAdd = [
        { name: 'banReason', type: 'TEXT' },
        { name: 'banExpiresAt', type: 'DATETIME' },
        { name: 'isPermanentlyBanned', type: 'BOOLEAN', defaultValue: false }
    ];

    for (const col of columnsToAdd) {
        if (!tableInfo[col.name]) {
            console.log(`Adding column ${col.name}...`);
            await queryInterface.addColumn('Users', col.name, {
                type: col.type === 'TEXT' ? require('sequelize').DataTypes.TEXT :
                    col.type === 'DATETIME' ? require('sequelize').DataTypes.DATE :
                        require('sequelize').DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: col.defaultValue !== undefined ? col.defaultValue : null
            });
        } else {
            console.log(`Column ${col.name} already exists.`);
        }
    }

    console.log('Migration completed.');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
