const { sequelize, Settings, User } = require('../src/models');

async function migrateEmailSettings() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected.');

        // 1. Find the first admin with SMTP settings
        const admins = await User.findAll({ where: { role: 'admin' } });
        let sourceUser = null;

        for (const admin of admins) {
            const host = await Settings.findOne({ where: { key: 'smtp_host', UserId: admin.id } });
            if (host && host.value) {
                sourceUser = admin.id;
                console.log(`Found source configuration from Admin ID: ${sourceUser}`);
                break;
            }
        }

        if (!sourceUser) {
            console.log('No existing SMTP configuration found to migrate.');
            return;
        }

        // 2. Access all relevant keys
        const keys = [
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_sender_name', 'smtp_secure',
            'imap_host', 'imap_port', 'imap_user', 'imap_password', 'imap_secure'
        ];

        console.log('Migrating settings to global (UserId: null)...');

        for (const key of keys) {
            // Get source value
            const setting = await Settings.findOne({ where: { key, UserId: sourceUser } });
            if (setting) {
                // Create or Update Global Setting
                const [globalSetting, created] = await Settings.findOrCreate({
                    where: { key, UserId: null },
                    defaults: { value: setting.value }
                });

                if (!created) {
                    await globalSetting.update({ value: setting.value });
                }
                console.log(`- Migrated ${key}`);
            }
        }

        console.log('Migration complete.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

migrateEmailSettings();
