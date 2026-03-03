const express = require('express');
const router = express.Router();
const { PushSubscription, User, SentPushNotification } = require('../models');
const { auth } = require('../middleware/auth');
const webpush = require('web-push');
const logger = require('../utils/logger');

// Setup web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:admin@gabelguru.de',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    logger.logSystem('WARNING', 'Web-Push VAPID keys are missing. Push notifications will not work.');
}

// GET /vapid-public-key - Get the public VAPID key
router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /subscribe - Save a new push subscription
router.post('/subscribe', auth, async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }

        const [subscription, created] = await PushSubscription.findOrCreate({
            where: { endpoint },
            defaults: {
                p256dh: keys.p256dh,
                auth: keys.auth,
                UserId: req.user.id
            }
        });

        if (!created) {
            // Update existing subscription's UserId and keys just in case
            await subscription.update({
                UserId: req.user.id,
                p256dh: keys.p256dh,
                auth: keys.auth
            });
        }

        res.status(201).json({ success: true });
    } catch (error) {
        logger.logError('Push subscription failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /unsubscribe - Remove a push subscription
router.post('/unsubscribe', auth, async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'Endpoint is required' });

        await PushSubscription.destroy({
            where: {
                endpoint,
                UserId: req.user.id
            }
        });

        res.json({ success: true });
    } catch (error) {
        logger.logError('Push unsubscription failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /toggle - Update pushEnabled status
router.post('/toggle', auth, async (req, res) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Enabled status must be a boolean' });

        await User.update(
            { followNotificationsEnabled: enabled },
            { where: { id: req.user.id } }
        );

        res.json({ success: true, pushEnabled: enabled });
    } catch (error) {
        logger.logError('Push toggle failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /admin/history - Get push history
router.get('/admin/history', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const history = await SentPushNotification.findAll({
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        res.json(history);
    } catch (error) {
        logger.logError('Failed to fetch push history:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /admin/send-broadcast - Send broadcast push
router.post('/admin/send-broadcast', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { message } = req.body;
        if (!message || message.length < 10) {
            return res.status(400).json({ error: 'Nachricht muss mindestens 10 Zeichen lang sein' });
        }

        const subscriptions = await PushSubscription.findAll();

        const payload = JSON.stringify({
            title: 'GabelGuru',
            body: message,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: {
                url: '/'
            }
        });

        let successCount = 0;
        let failureCount = 0;

        const results = await Promise.allSettled(subscriptions.map(sub => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.auth,
                    p256dh: sub.p256dh
                }
            };
            return webpush.sendNotification(pushConfig, payload);
        }));

        for (const result of results) {
            if (result.status === 'fulfilled') {
                successCount++;
            } else {
                failureCount++;
                // If 404 or 410, subscription is no longer valid
                if (result.reason?.statusCode === 404 || result.reason?.statusCode === 410) {
                    await PushSubscription.destroy({ where: { endpoint: result.reason.endpoint } }).catch(() => { });
                }
            }
        }

        const sentReport = await SentPushNotification.create({
            message,
            recipientCount: subscriptions.length,
            successCount,
            failureCount
        });

        res.json({ success: true, report: sentReport });
    } catch (error) {
        logger.logError('Broadcast push failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /timer-expired - Send push notification when a cooking timer expires
router.post('/timer-expired', auth, async (req, res) => {
    try {
        const { label } = req.body;
        const displayLabel = label || 'Timer';

        const subscriptions = await PushSubscription.findAll({
            where: { UserId: req.user.id }
        });

        if (subscriptions.length === 0) {
            return res.json({ success: true, message: 'No subscriptions found' });
        }

        const payload = JSON.stringify({
            title: 'GabelGuru',
            body: `⏰ Timer "${displayLabel}" ist abgelaufen!`,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: {
                url: '/recipes' // Redirect to recipes/cooking mode if possible
            },
            tag: `timer-${req.user.id}-${Date.now()}`, // Unique tag to avoid collapsing if multiple timers end
            renotify: true,
            vibrate: [200, 100, 200]
        });

        const pushOptions = {
            TTL: 10, // Expire after 10 seconds as requested
            urgency: 'high' // Deliver immediately
        };

        const results = await Promise.allSettled(subscriptions.map(sub => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.auth,
                    p256dh: sub.p256dh
                }
            };
            return webpush.sendNotification(pushConfig, payload, pushOptions);
        }));

        // Cleanup invalid subscriptions
        for (const result of results) {
            if (result.status === 'rejected') {
                if (result.reason?.statusCode === 404 || result.reason?.statusCode === 410) {
                    await PushSubscription.destroy({ where: { endpoint: result.reason.endpoint } }).catch(() => { });
                }
            }
        }

        res.json({ success: true, sentTo: subscriptions.length });
    } catch (error) {
        logger.logError('Timer push failed:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
