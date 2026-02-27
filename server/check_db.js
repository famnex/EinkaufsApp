const { sequelize } = require('./src/models');

async function checkSchema() {
    try {
        const [results] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table';");
        console.log('--- TABLES ---');
        console.log(results.map(r => r.name).sort().join('\n'));
        console.log('--------------');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
