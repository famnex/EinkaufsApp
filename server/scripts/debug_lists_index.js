const { sequelize, List } = require('../src/models');

async function debugListsIndex() {
    try {
        console.log('Authenticating...');
        await sequelize.authenticate();
        console.log('Auth OK.');

        console.log('Fetching all lists (mirroring GET / route)...');
        const lists = await List.findAll({
            order: [['date', 'DESC']]
        });

        console.log(`Success! Found ${lists.length} lists.`);
        if (lists.length > 0) {
            console.log('First list:', lists[0].toJSON());
        }

    } catch (err) {
        console.error('CRITICAL ERROR in List.findAll:', err);
        console.error('Stack:', err.stack);
    } finally {
        await sequelize.close();
    }
}

debugListsIndex();
