const { sequelize, User, Settings } = require('../src/models');

async function debugDb() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connected.');

        console.log('Syncing database (alter: false)...');
        await sequelize.sync({ alter: false });
        console.log('Database synced.');

        console.log('Checking User count...');
        const userCount = await User.count();
        console.log(`User count: ${userCount}`);

        console.log('Checking Settings...');
        try {
            const settings = await Settings.findAll();
            console.log(`Settings count: ${settings.length}`);
        } catch (err) {
            console.error('Failed to query Settings:', err.message);
        }

    } catch (error) {
        console.error('CRITICAL DB ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

debugDb();
