const { sequelize, User } = require('../src/models');

async function checkUsers() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');
        const users = await User.findAll({
            attributes: ['id', 'username', 'role', 'email']
        });
        console.log('--- Users ---');
        console.table(users.map(u => u.toJSON()));
    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

checkUsers();
