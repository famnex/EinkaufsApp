const cron = require('node-cron');
const { User, Recipe, sequelize } = require('../models');
const { sendSystemEmail } = require('./emailService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Check for updates in followed cookbooks and send email nudges if updates are unread for > 2 days.
 */
async function checkFollowedCookbookUpdates() {
    logger.logSystem('INFO', '[NotificationService] Checking for unread cookbook updates...');

    try {
        // 1. Get all users who have notifications enabled
        const users = await User.findAll({
            where: { followNotificationsEnabled: true }
        });

        for (const user of users) {
            // 2. Get the users they follow
            const followedUsers = await user.getFollowedCookbooks({
                attributes: ['id']
            });

            if (followedUsers.length === 0) continue;

            const followedIds = followedUsers.map(f => f.id);
            const lastCheck = user.lastFollowedUpdatesCheck || new Date(0);

            // 3. Define the time window for nudges:
            // - At least 2 days (48h) old
            // - At most 4 days (96h) old (stop reminding after that)
            const twoDaysAgo = new Date();
            twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
            const fourDaysAgo = new Date();
            fourDaysAgo.setHours(fourDaysAgo.getHours() - 96);

            // 4. Find the newest recipe within this window that hasn't been seen yet
            const newestQualifyingRecipe = await Recipe.findOne({
                where: {
                    UserId: followedIds,
                    createdAt: {
                        [Op.gt]: lastCheck,
                        [Op.lt]: twoDaysAgo,
                        [Op.gt]: fourDaysAgo
                    }
                },
                order: [['createdAt', 'DESC']]
            });

            if (!newestQualifyingRecipe) continue;

            // 5. Check if we already sent a nudge for this (or a newer) update
            if (!user.lastFollowedUpdatesNudgeSent || user.lastFollowedUpdatesNudgeSent < newestQualifyingRecipe.createdAt) {

                logger.logSystem('INFO', `[NotificationService] Sending update nudge to ${user.username} (${user.email})`);

                const success = await sendSystemEmail({
                    to: user.email,
                    subject: '💡 Neue Rezepte in deinen gefolgten Kochbüchern!',
                    html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                                <div style="background-color: #14b8a6; padding: 24px; text-align: center;">
                                    <h1 style="color: white; margin: 0; font-size: 24px;">GabelGuru</h1>
                                </div>
                                <div style="padding: 24px; color: #374151;">
                                    <p>Hallo <b>${user.username}</b>,</p>
                                    <p>du hast neue Updates in den Kochbüchern, denen du folgst! Schau doch mal wieder rein, um keine Inspiration zu verpassen.</p>
                                    
                                    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #14b8a6;">
                                        <p style="margin: 0; font-style: italic;">"Es gibt neue Rezepte zu entdecken. Schau dir gleich das Rezept an..."</p>
                                    </div>

                                    <div style="text-align: center; margin-top: 30px;">
                                        <a href="https://gabelguru.de/community" style="background-color: #14b8a6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Jetzt Updates ansehen</a>
                                    </div>
                                </div>
                                <div style="background-color: #f3f4f6; padding: 16px; text-align: center; font-size: 12px; color: #6b7280;">
                                    Du erhältst diese E-Mail, weil du Benachrichtigungen für gefolgte Kochbücher aktiviert hast.
                                </div>
                            </div>
                        `
                });

                if (success) {
                    await user.update({ lastFollowedUpdatesNudgeSent: new Date() });
                }
            }
        }
    } catch (error) {
        logger.logError('[NotificationService] Error checking updates:', error);
    }
}

/**
 * Initialize the cron job
 */
function initNotificationCron() {
    // Run every 4 hours
    cron.schedule('0 */4 * * *', async () => {
        await checkFollowedCookbookUpdates();
    });

    // Also run once on startup (with a small delay to not interfere with boot)
    setTimeout(() => {
        checkFollowedCookbookUpdates().catch(err => logger.logError('Startup check failed', err));
    }, 10000);
}

module.exports = {
    initNotificationCron,
    checkFollowedCookbookUpdates
};
