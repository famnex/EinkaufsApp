const { Settings } = require('./src/models');

async function checkSettings() {
    try {
        const settings = await Settings.findAll({
            where: {
                key: {
                    [require('sequelize').Op.like]: 'smtp%'
                }
            }
        });
        console.log('--- SMTP SETTINGS ---');
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
