const { sequelize, Settings } = require('../server/src/models');

async function setup() {
    try {
        await sequelize.authenticate();
        await Settings.destroy({ where: { key: 'alexa_key' } });
        await Settings.create({ key: 'alexa_key', value: 'TEST_KEY_123' });
        console.log('Set alexa_key to TEST_KEY_123');
    } catch (e) {
        console.error(e);
    }
}
setup();
