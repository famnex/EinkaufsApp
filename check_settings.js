const { Settings } = require('./server/src/models');
const { Op } = require('sequelize');

async function checkSettings() {
    try {
        const settings = await Settings.findAll();
        console.log('--- ALL SETTINGS ---');
        settings.forEach(s => {
            console.log(`[User: ${s.UserId}] ${s.key}: "${s.value}"`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSettings();
