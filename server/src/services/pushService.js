const webpush = require('web-push');
const { PushSubscription, User } = require('../models');
const logger = require('../utils/logger');

const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

webpush.setVapidDetails(
    'mailto:admin@gabelguru.de', // Replace with actual email if needed
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

/**
 * Send a push notification to a specific user
 * @param {number} userId - The ID of the recipient user
 * @param {Object} payload - Notification payload { title, body, url }
 */
async function sendPushNotification(userId, payload) {
    try {
        const user = await User.findByPk(userId);
        if (!user || !user.followNotificationsEnabled) {
            logger.logSystem('DEBUG', `Push skipped for user ${userId}: User not found or notifications disabled.`);
            return;
        }

        const subscriptions = await PushSubscription.findAll({ where: { UserId: userId } });
        if (subscriptions.length === 0) {
            logger.logSystem('DEBUG', `Push skipped for user ${userId}: No active subscriptions.`);
            return;
        }

        const payloadString = JSON.stringify(payload);

        const sendPromises = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, payloadString);
            } catch (error) {
                if (error.statusCode === 404 || error.statusCode === 410) {
                    // Subscription has expired or is no longer valid
                    logger.logSystem('INFO', `Removing invalid push subscription: ${sub.id}`);
                    await sub.destroy();
                } else {
                    logger.logError(`Push notification failed for sub ${sub.id}:`, error);
                }
            }
        });

        await Promise.all(sendPromises);
    } catch (error) {
        logger.logError(`Push service error for user ${userId}:`, error);
    }
}

module.exports = {
    sendPushNotification,
    vapidKeys
};
