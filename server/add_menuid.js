const { sequelize } = require('./src/models');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('Adding MenuId column to ListItems...');
        await sequelize.query('ALTER TABLE ListItems ADD COLUMN MenuId INTEGER');
        console.log('Success.');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

run();
