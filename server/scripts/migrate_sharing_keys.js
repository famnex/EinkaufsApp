
const { sequelize, User } = require('../src/models');
const crypto = require('crypto');

async function migrateSharingKeys() {
    try {
        console.log('Ensuring sharingKey column exists...');
        // SQLite doesn't allow adding UNIQUE columns via ALTER TABLE.
        // We add it as a regular column first, then we can add the index later or just rely on model enforcement.
        await sequelize.query('ALTER TABLE Users ADD COLUMN sharingKey VARCHAR(255);').catch(e => {
            console.log('Column likely exists or another error:', e.message);
        });

        console.log('Generating sharing keys for all users...');
        const users = await User.findAll();

        for (const user of users) {
            if (!user.sharingKey) {
                const key = crypto.randomBytes(8).toString('hex');
                await user.update({ sharingKey: key });
                console.log(`User ${user.username} (ID: ${user.id}) -> sharingKey: ${key}`);
            } else {
                console.log(`User ${user.username} already has key: ${user.sharingKey}`);
            }
        }

        console.log('Sharing key migration completed.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrateSharingKeys();
