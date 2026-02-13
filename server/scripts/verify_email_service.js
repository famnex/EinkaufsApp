const { sendSystemEmail, loadSystemEmailConfig } = require('../src/services/emailService');
const { sequelize } = require('../src/models');

async function verifyEmail() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected.');

        console.log('Loading configuration...');
        const config = await loadSystemEmailConfig();
        if (config) {
            console.log('Configuration found:', {
                host: config.host,
                port: config.port,
                user: config.auth.user,
                // hide password
                from: config.from
            });
        } else {
            console.error('No configuration found. Please configure SMTP settings settings for an admin user.');
            return;
        }

        console.log('Sending test email...');
        const result = await sendSystemEmail({
            to: 'test@example.com', // Replace with a real email if you want to actually receive it
            subject: 'Test Report Confirmation',
            text: 'This is a test email from the verification script.',
            html: '<p>This is a <strong>test email</strong> from the verification script.</p>'
        });

        if (result) {
            console.log('SUCCESS: Email sent successfully (check logs for messageId).');
        } else {
            console.error('FAILURE: Email sending failed.');
        }

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await sequelize.close();
    }
}

verifyEmail();
