const { User, Email } = require('../src/models');
const { Op } = require('sequelize');

async function migrate() {
    console.log('--- Migration v0.29.4: Fix Admin Emails ---');
    try {
        const admins = await User.findAll({ where: { role: 'admin' } });
        if (!admins.length) {
            console.log('No admins found, skipping.');
            return;
        }

        const adminIds = admins.map(a => a.id);
        const [updated] = await Email.update(
            { UserId: null },
            { where: { UserId: { [Op.in]: adminIds } } }
        );

        console.log(`Successfully moved ${updated} emails from specific admins to shared admin scope (UserId: null).`);
        console.log('---------------------------------------------');
    } catch (e) {
        console.error('Error during migration:', e);
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
} else {
    module.exports = migrate;
}
