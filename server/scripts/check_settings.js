const { sequelize, Settings } = require('../src/models');

async function checkSettings() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected.');

        const settings = await Settings.findAll();
        console.log('--- Settings Table Content ---');
        console.log(JSON.stringify(settings, null, 2));
        console.log('------------------------------');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
}

checkSettings();
