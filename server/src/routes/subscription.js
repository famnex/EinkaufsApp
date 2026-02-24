const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const creditService = require('../services/creditService');
const { User, CreditTransaction, SubscriptionLog, sequelize } = require('../models');

/**
 * GET /status - Get current subscription and credit status
 */
router.get('/status', auth, async (req, res) => {
    try {
        const effectiveUserId = req.user.householdId || req.user.id;
        const user = await User.findByPk(effectiveUserId, {
            attributes: ['tier', 'aiCredits', 'subscriptionStatus', 'subscriptionExpiresAt', 'cancelAtPeriodEnd']
        });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /stripe/create-session - Create Stripe checkout session
 */
router.post('/stripe/create-session', auth, async (req, res) => {
    try {
        const { tier, successUrl, cancelUrl } = req.body;
        if (!['Silbergabel', 'Goldgabel'].includes(tier)) {
            return res.status(400).json({ error: 'Ungültiger Tier.' });
        }

        const user = await User.findByPk(req.user.id);

        // Log checkout initiation
        await SubscriptionLog.create({
            UserId: req.user.id,
            username: user.username,
            event: 'checkout_initiated',
            tier,
            details: 'Stripe Checkout gestartet',
            ipHash: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        });

        const session = await paymentService.createStripeSession(req.user.id, tier, successUrl, cancelUrl);
        res.json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /stripe/create-portal-session - Create Stripe Customer Portal session
 */
router.post('/stripe/create-portal-session', auth, async (req, res) => {
    try {
        const { returnUrl } = req.body;
        const session = await paymentService.createPortalSession(req.user.id, returnUrl);
        res.json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /paypal/create-subscription - Create PayPal subscription (Placeholder)
 */
router.post('/paypal/create-subscription', auth, async (req, res) => {
    try {
        const { tier } = req.body;
        const user = await User.findByPk(req.user.id);

        // Log PayPal checkout attempt
        await SubscriptionLog.create({
            UserId: req.user.id,
            username: user.username,
            event: 'checkout_initiated',
            tier: tier || 'unknown',
            details: 'PayPal Checkout versucht (noch nicht verfügbar)',
            ipHash: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        });

        res.json({
            message: 'PayPal Integration in Vorbereitung.',
            tier
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /checkout/canceled - Log when user abandons checkout
 */
router.post('/checkout/canceled', auth, async (req, res) => {
    try {
        const { tier } = req.body;
        const user = await User.findByPk(req.user.id);

        await SubscriptionLog.create({
            UserId: req.user.id,
            username: user.username,
            event: 'checkout_canceled',
            tier: tier || 'unknown',
            details: 'Benutzer hat den Zahlvorgang abgebrochen',
            ipHash: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        });

        res.json({ message: 'Abbruch protokolliert.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /webhook/stripe - Stripe Webhook Endpoint
 * Note: Needs raw body for signature verification
 */
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const stripeInstance = await paymentService.getStripe();
        const webhookSecret = await (async () => {
            const { Settings } = require('../models');
            const s = await Settings.findOne({ where: { key: 'stripe_webhook_secret', UserId: null } });
            return s ? s.value : '';
        })();

        event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook Error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                const { userId, tier } = session.metadata;

                await User.update({
                    tier,
                    subscriptionStatus: 'active',
                    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    stripeSubscriptionId: session.subscription,
                    stripeCustomerId: session.customer,
                    cancelAtPeriodEnd: false,
                    pendingTier: 'none'
                }, { where: { id: userId } });

                // Log the event
                const checkoutUser = await User.findByPk(userId);
                await SubscriptionLog.create({
                    UserId: userId,
                    username: checkoutUser.username,
                    event: 'checkout_completed',
                    tier,
                    amount: session.amount_total / 100,
                    currency: session.currency.toUpperCase(),
                    details: JSON.stringify({ stripeSubscriptionId: session.subscription }),
                    ipHash: 'webhook',
                    userAgent: 'Stripe-Webhook'
                });

                // Add initial coins
                const initialCoins = tier === 'Goldgabel' ? 1500 : 600;
                await creditService.addCredits(userId, initialCoins, `Willkommens-Credits für ${tier}`);
                break;

            case 'customer.subscription.deleted':
                const subscription = event.data.object;
                const userInstance = await User.findOne({ where: { stripeSubscriptionId: subscription.id } });
                if (userInstance) {
                    await userInstance.update({
                        subscriptionStatus: 'none',
                        tier: userInstance.pendingTier !== 'none' ? userInstance.pendingTier : 'Plastikgabel',
                        cancelAtPeriodEnd: false,
                        pendingTier: 'none'
                    });

                    await SubscriptionLog.create({
                        UserId: userInstance.id,
                        username: userInstance.username,
                        event: 'subscription_deleted',
                        tier: userInstance.tier,
                        details: JSON.stringify({ stripeSubscriptionId: subscription.id }),
                        ipHash: 'webhook',
                        userAgent: 'Stripe-Webhook'
                    });
                }
                break;

            case 'customer.subscription.updated':
                const updatedSub = event.data.object;
                const subUser = await User.findOne({ where: { stripeSubscriptionId: updatedSub.id } });

                if (!subUser) break;

                const oldTier = subUser.tier;
                const newPriceId = updatedSub.items.data[0].price.id;

                // Load price IDs from admin settings to identify the new tier
                const { Settings } = require('../models');
                const priceSilber = await Settings.findOne({ where: { key: 'stripe_price_silber', UserId: null } });
                const priceGold = await Settings.findOne({ where: { key: 'stripe_price_gold', UserId: null } });

                let newTier = subUser.tier;
                if (newPriceId === priceSilber?.value) newTier = 'Silbergabel';
                if (newPriceId === priceGold?.value) newTier = 'Goldgabel';

                const updateData = {
                    cancelAtPeriodEnd: updatedSub.cancel_at_period_end,
                    subscriptionStatus: updatedSub.status === 'active' ? 'active' : 'canceled'
                };

                // Handle Tier Upgrade
                if (newTier !== oldTier && newTier === 'Goldgabel' && oldTier === 'Silbergabel') {
                    updateData.tier = newTier;
                    // Prorated Upgrade: Give the difference in monthly credits
                    // Gold (1500) - Silber (600) = 900
                    await creditService.addCredits(subUser.id, 900, `Upgrade-Bonus: Silber -> Gold`);

                    await SubscriptionLog.create({
                        UserId: subUser.id,
                        username: subUser.username,
                        event: 'subscription_upgraded',
                        tier: newTier,
                        details: `Upgrade von ${oldTier} auf ${newTier} via Stripe`,
                        ipHash: 'webhook',
                        userAgent: 'Stripe-Webhook'
                    });
                }

                await subUser.update(updateData);
                break;

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                // Skip the first invoice (handled by checkout.session.completed)
                if (invoice.billing_reason === 'subscription_cycle') {
                    const renewalUser = await User.findOne({ where: { stripeCustomerId: invoice.customer } });
                    if (renewalUser) {
                        // Extend subscription
                        await renewalUser.update({
                            subscriptionStatus: 'active',
                            subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                            cancelAtPeriodEnd: false
                        });

                        // Add monthly credits
                        const monthlyCoins = renewalUser.tier === 'Goldgabel' ? 1500 : 600;
                        await creditService.addCredits(renewalUser.id, monthlyCoins, `Monatliche Credits (${renewalUser.tier})`);

                        await SubscriptionLog.create({
                            UserId: renewalUser.id,
                            username: renewalUser.username,
                            event: 'subscription_renewed',
                            tier: renewalUser.tier,
                            amount: invoice.amount_paid / 100,
                            currency: (invoice.currency || 'EUR').toUpperCase(),
                            details: `Verlängerung + ${monthlyCoins} Credits gutgeschrieben`,
                            ipHash: 'webhook',
                            userAgent: 'Stripe-Webhook'
                        });

                        console.log(`[Subscription] Renewed for ${renewalUser.username}, +${monthlyCoins} credits`);
                    }
                }
                break;
            }

            case 'invoice.payment_failed': {
                const failedInvoice = event.data.object;
                const failedUser = await User.findOne({ where: { stripeCustomerId: failedInvoice.customer } });
                if (failedUser) {
                    await SubscriptionLog.create({
                        UserId: failedUser.id,
                        username: failedUser.username,
                        event: 'payment_failed',
                        tier: failedUser.tier,
                        amount: failedInvoice.amount_due / 100,
                        currency: (failedInvoice.currency || 'EUR').toUpperCase(),
                        details: `Zahlung fehlgeschlagen (Versuch ${failedInvoice.attempt_count || 1})`,
                        ipHash: 'webhook',
                        userAgent: 'Stripe-Webhook'
                    });

                    console.log(`[Subscription] Payment failed for ${failedUser.username}, attempt ${failedInvoice.attempt_count}`);
                }
                break;
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /cancel - Cancel subscription at period end
 */
router.post('/cancel', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user.stripeSubscriptionId) {
            return res.status(400).json({ error: 'Kein aktives Stripe-Abo gefunden.' });
        }

        const stripeInstance = await paymentService.getStripe();
        await stripeInstance.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true
        });

        await user.update({ cancelAtPeriodEnd: true, subscriptionStatus: 'canceled' });

        await SubscriptionLog.create({
            UserId: user.id,
            username: user.username,
            event: 'subscription_canceled_user',
            tier: user.tier,
            details: 'Self-service cancellation',
            ipHash: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        });
        res.json({ message: 'Abo zum Ende der Laufzeit gekündigt.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /downgrade - Downgrade subscription at period end
 */
router.post('/downgrade', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user.stripeSubscriptionId || user.tier !== 'Goldgabel') {
            return res.status(400).json({ error: 'Downgrade nur für Goldgabel-Abonnenten möglich.' });
        }

        const stripeInstance = await paymentService.getStripe();
        // Since the user wants "Gold until end, then Silber", we cancel Gold and note the pending Silber.
        // A full solution would use Stripe Subscription Schedules, but this is a pragmatic start.
        await stripeInstance.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true
        });

        await user.update({
            cancelAtPeriodEnd: true,
            subscriptionStatus: 'canceled',
            pendingTier: 'Silbergabel'
        });

        await SubscriptionLog.create({
            UserId: user.id,
            username: user.username,
            event: 'downgrade_scheduled',
            tier: user.tier,
            details: 'Scheduled downgrade to Silbergabel',
            ipHash: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        });
        res.json({ message: 'Abo wird zum Ende der Laufzeit auf Silber umgestellt.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /terminate - Immediately terminate subscription
 */
router.post('/terminate', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        // If there is a Stripe subscription, cancel it immediately in Stripe
        if (user.stripeSubscriptionId) {
            try {
                const stripeInstance = await paymentService.getStripe();
                await stripeInstance.subscriptions.cancel(user.stripeSubscriptionId);
            } catch (stripeErr) {
                console.error('Stripe cancel error (ignored during termination):', stripeErr);
                // We proceed even if Stripe fails, as we want to clear the local status
            }
        }

        // Reset user subscription status locally
        await user.update({
            tier: 'Plastikgabel',
            subscriptionStatus: 'none',
            stripeSubscriptionId: null,
            paypalSubscriptionId: null,
            cancelAtPeriodEnd: false,
            subscriptionExpiresAt: null,
            pendingTier: 'none'
        });

        await SubscriptionLog.create({
            UserId: user.id,
            username: user.username,
            event: 'subscription_terminated_immediate',
            tier: user.tier,
            details: 'Sofortige Beendigung für Haushaltsbeitritt',
            ipHash: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        });

        res.json({ message: 'Abo wurde sofort beendet. Du kannst nun einem Haushalt beitreten.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
