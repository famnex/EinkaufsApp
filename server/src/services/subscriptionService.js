const { User, SubscriptionLog, sequelize } = require('../models');
const creditService = require('./creditService');
const { Op } = require('sequelize');

/**
 * Service for background subscription tasks
 */
const subscriptionService = {
    /**
     * Refill monthly credits for active subscriptions.
     * This is a safety net — the primary refill happens via invoice.payment_succeeded webhook.
     * This catches edge cases where the webhook might have been missed.
     */
    async processMonthlyRefills() {
        console.log('[Cron] Checking for monthly credit refills...');
        const activeUsers = await User.findAll({
            where: {
                subscriptionStatus: 'active',
                tier: { [Op.in]: ['Silbergabel', 'Goldgabel'] }
            }
        });

        for (const user of activeUsers) {
            const now = new Date();
            const lastRefill = user.lastRefillAt ? new Date(user.lastRefillAt) : new Date(0);

            // Check if 30 days have passed since last refill
            const diffDays = (now - lastRefill) / (1000 * 60 * 60 * 24);

            if (diffDays >= 30) {
                console.log(`[Cron] Refilling credits for user ${user.username} (${user.tier})`);
                const refillAmount = user.tier === 'Goldgabel' ? 1500 : 600;

                await creditService.addCredits(user.id, refillAmount, `Monatlicher Refill (${user.tier})`);
                await user.update({ lastRefillAt: now });

                await SubscriptionLog.create({
                    UserId: user.id,
                    username: user.username,
                    event: 'credits_refilled',
                    tier: user.tier,
                    details: `+${refillAmount} Credits (Cron-Sicherheitsnetz)`,
                    ipHash: 'system',
                    userAgent: 'Cron-Job'
                });
            }
        }
    },

    /**
     * Check for expired subscriptions and downgrade users
     */
    async checkExpirations() {
        console.log('[Cron] Checking for expired subscriptions...');
        const now = new Date();
        const expiredUsers = await User.findAll({
            where: {
                subscriptionStatus: { [Op.in]: ['active', 'canceled'] },
                subscriptionExpiresAt: { [Op.lt]: now }
            }
        });

        for (const user of expiredUsers) {
            const newTier = (user.pendingTier && user.pendingTier !== 'none')
                ? user.pendingTier
                : 'Plastikgabel';

            console.log(`[Cron] Downgrading user ${user.username}: ${user.tier} → ${newTier}`);

            const updateData = {
                subscriptionStatus: newTier === 'Plastikgabel' ? 'none' : 'active',
                tier: newTier,
                cancelAtPeriodEnd: false,
                pendingTier: 'none'
            };

            // If reverting to Plastikgabel: Reset credits and dissolve household
            let extraDetails = '';
            if (newTier === 'Plastikgabel') {
                updateData.aiCredits = 0;
                updateData.householdId = null;
                extraDetails = ' (Credits reset & Haushalt aufgelöst)';

                // Dissolve household (if this user was the owner)
                await User.update({ householdId: null }, {
                    where: { householdId: user.id }
                });

                console.log(`[Cron] Reset credits and dissolved household for user ${user.username}`);
            }

            await user.update(updateData);

            await SubscriptionLog.create({
                UserId: user.id,
                username: user.username,
                event: 'subscription_expired',
                tier: newTier,
                details: `Abo abgelaufen: ${user.tier} → ${newTier}${extraDetails}`,
                ipHash: 'system',
                userAgent: 'Cron-Job'
            });
        }
    },

    /**
     * Initialize cron jobs for subscriptions
     */
    initSubscriptionCron() {
        const cron = require('node-cron');
        // Run every day at 03:00 AM
        cron.schedule('0 3 * * *', () => {
            this.processMonthlyRefills().catch(err => console.error('[Cron] Monthly refill error:', err));
            this.checkExpirations().catch(err => console.error('[Cron] Expiry check error:', err));
        });
        console.log('[Cron] Subscription cron jobs initialized (daily at 03:00 AM)');
    }
};

module.exports = subscriptionService;
