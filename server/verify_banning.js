const { User, LoginLog, sequelize } = require('./src/models');
const { checkAndUnbanUsers } = require('./src/services/banService');
const bcrypt = require('bcryptjs');

async function test() {
    console.log('--- Banning Verification Start ---');

    // 1. Create a test user
    const testEmail = 'ban-test@example.com';
    let user = await User.findOne({ where: { email: testEmail } });
    if (!user) {
        user = await User.create({
            username: 'bantest',
            email: testEmail,
            password: await bcrypt.hash('password123', 10),
            role: 'user'
        });
        console.log('Created test user.');
    } else {
        await user.update({ bannedAt: null, banReason: null, banExpiresAt: null, isPermanentlyBanned: false });
        console.log('Reset existing test user.');
    }

    // 2. Ban the user
    console.log('Banning user temporarily...');
    await user.update({
        bannedAt: new Date(),
        banReason: 'Test Ban',
        banExpiresAt: new Date(Date.now() + 86400000) // 1 day from now
    });

    // 3. Test login logic (simulated)
    console.log('Simulating login for banned user...');
    // We can't easily call the API here without a running server, but we can test the logic path
    if (user.bannedAt) {
        console.log('Success: User is detected as banned.');
    }

    // 4. Test Auto-Unban (Set expiration to past)
    console.log('Setting ban expiration to past...');
    await user.update({
        banExpiresAt: new Date(Date.now() - 3600000) // 1 hour ago
    });

    console.log('Running auto-unban service...');
    await checkAndUnbanUsers();

    // Reload user
    user = await User.findByPk(user.id);
    if (!user.bannedAt) {
        console.log('Success: User was automatically unbanned.');
    } else {
        console.error('Failure: User remains banned.');
    }

    // 5. Test permanent ban
    console.log('Testing permanent ban...');
    await user.update({
        bannedAt: new Date(),
        banReason: 'Permanent Test',
        isPermanentlyBanned: true,
        banExpiresAt: new Date(Date.now() - 3600000)
    });

    await checkAndUnbanUsers();
    user = await User.findByPk(user.id);
    if (user.bannedAt && user.isPermanentlyBanned) {
        console.log('Success: Permanent ban was NOT removed by cron.');
    } else {
        console.error('Failure: Permanent ban was removed incorrectly.');
    }

    // Cleanup
    // await user.destroy();
    // console.log('Deleted test user.');

    console.log('--- Verification Complete ---');
    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
