const { sequelize, User } = require('./src/models');
async function promote() {
    await sequelize.authenticate();
    await User.update({ role: 'admin' }, { where: { username: 'admin' } });
    console.log('User admin promoted to admin role');
    process.exit(0);
}
promote();
