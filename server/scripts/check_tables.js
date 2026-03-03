const { sequelize } = require('../src/models');
const { Sequelize } = require('sequelize');

async function check() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const tables = await queryInterface.showAllTables();
        console.log('--- TABLES ---');
        console.log(JSON.stringify(tables, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
