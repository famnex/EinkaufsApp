const { sequelize, User } = require('./src/models');
async function check() {
    await sequelize.authenticate();
    const users = await User.findAll();
    console.log(JSON.stringify(users.map(u => ({ id: u.id, username: u.username, role: u.role })), null, 2));
    process.exit(0);
}
check();
