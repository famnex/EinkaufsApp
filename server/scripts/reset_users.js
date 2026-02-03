const { sequelize, User } = require('../src/models');

async function resetUsers() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const count = await User.count();
        console.log(`Found ${count} users.`);

        await User.destroy({ where: {}, truncate: true });
        console.log('All users deleted.');

    } catch (error) {
        console.error('Error resetting users:', error);
    } finally {
        await sequelize.close();
    }
}

resetUsers();
