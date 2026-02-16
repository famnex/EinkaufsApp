const { User, Settings, sequelize } = require('./src/models');
const { notifyAdmins } = require('./src/services/emailService');

async function testNotifications() {
    console.log('--- Admin Notification Verification Start ---');

    try {
        // 1. Ensure at least one admin exists
        let admin = await User.findOne({ where: { role: 'admin' } });
        if (!admin) {
            console.log('No admin found, creating a test admin...');
            admin = await User.create({
                username: 'testadmin',
                email: 'admin-test@example.com',
                password: 'password123',
                role: 'admin'
            });
        }
        console.log(`Found admin: ${admin.username} (${admin.email})`);

        // 2. Trigger notification
        console.log('Triggering a test notification to all admins...');
        await notifyAdmins({
            subject: '🔍 Test Benachrichtigung',
            text: 'Dies ist ein automatischer Test der Admin-Benachrichtigungen.',
            html: '<h3>Test</h3><p>Dies ist ein automatischer Test der Admin-Benachrichtigungen.</p>'
        });

        console.log('Verification script execution finished. Check console logs for "Notifying X admins" and SMTP output.');
    } catch (err) {
        console.error('Verification failed:', err);
    }

    console.log('--- Verification Complete ---');
    process.exit(0);
}

testNotifications().catch(err => {
    console.error(err);
    process.exit(1);
});
