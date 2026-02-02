const { sequelize, User } = require('./src/models');

const username = process.argv[2];

if (!username) {
    console.error('Please provide a username: node make_admin.js <username>');
    process.exit(1);
}

sequelize.authenticate().then(async () => {
    // We don't need to sync, just use existing
    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            console.error(`User "${username}" not found.`);
            process.exit(1);
        }

        user.role = 'admin';
        await user.save();
        console.log(`Success! User "${username}" is now an Admin.`);
    } catch (err) {
        console.error('Error updating user:', err);
    } finally {
        await sequelize.close();
    }
}).catch(err => {
    console.error('Database connection failed:', err);
});
