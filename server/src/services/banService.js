const cron = require('node-cron');
const { User } = require('../models');
const { sendEmail } = require('./messagingService');
const { Op } = require('sequelize');

const checkAndUnbanUsers = async () => {
    console.log('[BanService] Checking for expired bans...');
    try {
        const expiredBans = await User.findAll({
            where: {
                bannedAt: { [Op.ne]: null },
                isPermanentlyBanned: false,
                banExpiresAt: {
                    [Op.lt]: new Date()
                }
            }
        });

        if (expiredBans.length === 0) {
            return;
        }

        console.log(`[BanService] Found ${expiredBans.length} expired ban(s). Reactivating accounts...`);

        for (const user of expiredBans) {
            await user.update({
                bannedAt: null,
                banReason: null,
                banExpiresAt: null,
                isPermanentlyBanned: false
            });

            // Send notification email
            const html = `
                <h3>Konto reaktiviert</h3>
                <p>Hallo ${user.username},</p>
                <p>dein Konto wurde automatisch wieder freigeschaltet, da die Sperrfrist abgelaufen ist. Du kannst dich nun wieder anmelden.</p>
                <br>
                <p>Viel Spaß weiterhin mit GabelGuru!</p>
            `;
            await sendEmail(user.email, 'Dein Konto wurde wieder freigeschaltet', html);
            console.log(`[BanService] User ${user.username} (ID: ${user.id}) unbanned.`);
        }
    } catch (err) {
        console.error('[BanService] Error during auto-unban check:', err);
    }
};

const initBanCron = () => {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', checkAndUnbanUsers);

    // Also run once on startup
    checkAndUnbanUsers();
};

module.exports = {
    checkAndUnbanUsers,
    initBanCron
};
