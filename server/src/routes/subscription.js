const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const creditService = require('../services/creditService');
const { sendEmail } = require('../services/messagingService');
const { User, CreditTransaction, SubscriptionLog, sequelize } = require('../models');

/**
 * GET /status - Get current subscription and credit status
 */
router.get('/status', auth, async (req, res) => {
    try {
        const effectiveUserId = req.user.householdId || req.user.id;
        const user = await User.findByPk(effectiveUserId, {
            attributes: ['id', 'tier', 'aiCredits', 'subscriptionStatus', 'subscriptionExpiresAt', 'cancelAtPeriodEnd', 'stripeSubscriptionId', 'stripeCustomerId']
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
            case 'checkout.session.completed': {
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

                // Set initial coins to target
                const targetCoins = tier === 'Goldgabel' ? 1500 : 600;
                await creditService.setCreditsToTarget(userId, targetCoins, `Willkommens-Credits für ${tier}`);

                // Send Upgrade Email
                if (checkoutUser.email) {
                    const benefits = tier === 'Goldgabel'
                        ? 'Unbegrenzter KI-Text-Assistent, bevorzugte Bildgenerierung zum Sparpreis und monatlich 1.500 Coins'
                        : 'Alle KI-Funktionen freigeschaltet und monatlich 600 Coins für deine kulinarischen Abenteuer';

                    const html = `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                            <h2 style="color: #4f46e5;">Dein Gabelguru-Upgrade!</h2>
                            <p>Hallo <strong>${checkoutUser.username}</strong>,</p>
                            <p>vielen Dank für deine Bestellung! Dein Upgrade auf das <strong>${tier}</strong> Abo war erfolgreich.</p>
                            <p>Dir stehen ab sofort folgende Vorteile zur Verfügung:</p>
                            <ul style="color: #475569;"><li>${benefits}</li></ul>
                            <p>Dein Stand wurde soeben auf <strong>${targetCoins} Coins</strong> aufgefüllt.</p>
                            <p>Viel Spaß beim Kochen mit KI-Unterstützung!</p>
                        </div>
                    `;
                    sendEmail(checkoutUser.email, `Dein Upgrade auf ${tier}`, html).catch(err => console.error('Failed to send checkout email:', err));
                }
                break;
            }

            case 'customer.subscription.deleted': {
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

                    if (userInstance.email) {
                        const newTier = userInstance.pendingTier !== 'none' ? userInstance.pendingTier : 'Plastikgabel';
                        const householdWarning = newTier === 'Plastikgabel'
                            ? `<p style="color: #b91c1c; font-weight: bold;">Wichtiger Hinweis: Da dein Account auf Plastikgabel umgestellt wurde, wird dein geteilter Haushalt aufgelöst. Alle eingeladenen Mitglieder (außer dir als Besitzer) haben nun leere Konten und keinen Zugriff mehr auf gemeinsame Daten.</p>`
                            : '';

                        const html = `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                                <h2 style="color: #4f46e5;">Dein Abo ist abgelaufen</h2>
                                <p>Hallo <strong>${userInstance.username}</strong>,</p>
                                <p>dein bisheriges Abo ist nun offiziell beendet. Dein Account wurde auf <strong>${newTier}</strong> umgestellt.</p>
                                ${householdWarning}
                                <p>Wir bedanken uns für die gemeinsame Zeit am Herd. Falls du es dir anders überlegst, kannst du jederzeit wieder bei uns einsteigen!</p>
                            </div>
                        `;
                        sendEmail(userInstance.email, 'Dein Abo ist abgelaufen', html).catch(err => console.error('Failed to send subscription deleted email:', err));
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
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
                    cancelAtPeriodEnd: updatedSub.cancel_at_period_end || !!updatedSub.cancel_at,
                    subscriptionStatus: updatedSub.status === 'active' ? 'active' : 'canceled',
                    subscriptionExpiresAt: updatedSub.cancel_at
                        ? new Date(updatedSub.cancel_at * 1000)
                        : (updatedSub.current_period_end ? new Date(updatedSub.current_period_end * 1000) : subUser.subscriptionExpiresAt)
                };

                // Handle Tier Upgrade
                if (newTier !== oldTier && newTier === 'Goldgabel' && oldTier === 'Silbergabel') {
                    updateData.tier = newTier;
                    // Upgrade: Set to target
                    await creditService.setCreditsToTarget(subUser.id, 1500, `Upgrade-Bonus: Silber -> Gold`);

                    await SubscriptionLog.create({
                        UserId: subUser.id,
                        username: subUser.username,
                        event: 'subscription_upgraded',
                        tier: newTier,
                        details: `Upgrade von ${oldTier} auf ${newTier} via Stripe`,
                        ipHash: 'webhook',
                        userAgent: 'Stripe-Webhook'
                    });

                    // Send Upgrade Email
                    if (subUser.email) {
                        const benefits = newTier === 'Goldgabel'
                            ? 'Unbegrenzter KI-Text-Assistent, bevorzugte Bildgenerierung zum Sparpreis und monatlich 1.500 Coins'
                            : 'Alle KI-Funktionen freigeschaltet und monatlich 600 Coins';

                        const html = `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                                <h2 style="color: #4f46e5;">Abo-Upgrade erfolgreich!</h2>
                                <p>Hallo <strong>${subUser.username}</strong>,</p>
                                <p>dein Wechsel von ${oldTier} auf <strong>${newTier}</strong> wurde erfolgreich durchgeführt.</p>
                                <p>Deine neuen Vorteile:</p>
                                <ul style="color: #475569;"><li>${benefits}</li></ul>
                                <p>Dein Coin-Stand wurde an dein neues Abo angepasst und auf <strong>1500 Coins</strong> aufgefüllt.</p>
                            </div>
                        `;
                        sendEmail(subUser.email, `Upgrade auf ${newTier} bestätigt`, html).catch(err => console.error('Failed to send upgrade email:', err));
                    }
                }

                // Handle Cancellation (active until period end)
                const justCanceled = (!subUser.cancelAtPeriodEnd && updateData.cancelAtPeriodEnd);
                if (justCanceled) {
                    await SubscriptionLog.create({
                        UserId: subUser.id,
                        username: subUser.username,
                        event: 'subscription_canceled',
                        tier: subUser.tier,
                        details: `Kündigung eingegangen. Läuft ab am: ${updateData.subscriptionExpiresAt.toLocaleDateString('de-DE')}`,
                        ipHash: 'webhook',
                        userAgent: 'Stripe-Webhook'
                    });

                    if (subUser.email) {
                        const expiryDate = updateData.subscriptionExpiresAt.toLocaleDateString('de-DE');
                        const targetTier = subUser.pendingTier !== 'none' ? subUser.pendingTier : 'Plastikgabel';
                        const householdWarning = targetTier === 'Plastikgabel'
                            ? `<p style="color: #b91c1c;"><strong>Achtung:</strong> Da du auf die kostenlose Plastikgabel zurückwechselst, wird dein Haushalt nach Ablauf des Abos aufgelöst. Alle Mitglieder (außer dir als Besitzer) bekommen dann wieder eigene, leere Konten und verlieren den Zugriff auf geteilte Daten.</p>`
                            : '';

                        const html = `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                                <h2 style="color: #4f46e5;">Kündigung eingegangen</h2>
                                <p>Hallo <strong>${subUser.username}</strong>,</p>
                                <p>wir bedauern sehr, dass du dein <strong>${subUser.tier}</strong> Abo gekündigt hast.</p>
                                <p>Dein Abo läuft noch bis zum <strong>${expiryDate}</strong> und wird danach nicht mehr automatisch verlängert.</p>
                                ${householdWarning}
                                <p>Bis zum Ablaufdatum kannst du alle Funktionen wie gewohnt weiter nutzen.</p>
                                <p>Wir würden uns freuen, dich irgendwann wieder bei Gabelguru begrüßen zu dürfen!</p>
                            </div>
                        `;
                        sendEmail(subUser.email, 'Kündigung bestätigt', html).catch(err => console.error('Failed to send cancelation email:', err));
                    }
                }

                // Handle un-cancellation (reactivation)
                const justReactivated = (subUser.cancelAtPeriodEnd && !updateData.cancelAtPeriodEnd);
                if (justReactivated) {
                    await SubscriptionLog.create({
                        UserId: subUser.id,
                        username: subUser.username,
                        event: 'subscription_reactivated',
                        tier: subUser.tier,
                        details: `Kündigung wurde widerrufen. Abo läuft normal weiter.`,
                        ipHash: 'webhook',
                        userAgent: 'Stripe-Webhook'
                    });

                    if (subUser.email) {
                        const html = `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                                <h2 style="color: #4f46e5;">Willkommen zurück!</h2>
                                <p>Hallo <strong>${subUser.username}</strong>,</p>
                                <p>wir freuen uns sehr, dass du deine Kündigung widerrufen hast!</p>
                                <p>Dein <strong>${subUser.tier}</strong> Abo bleibt bestehen und verlängert sich automatisch weiter. Wir wünschen dir weiterhin viel Spaß beim Kochen.</p>
                            </div>
                        `;
                        sendEmail(subUser.email, 'Kündigung widerrufen', html).catch(err => console.error('Failed to send reactivation email:', err));
                    }
                }

                await subUser.update(updateData);
                break;
            }

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

                        // Refill monthly credits
                        const targetCoins = renewalUser.tier === 'Goldgabel' ? 1500 : 600;
                        const creditResult = await creditService.setCreditsToTarget(renewalUser.id, targetCoins, `Monatliche Auffüllung (${renewalUser.tier})`);

                        await SubscriptionLog.create({
                            UserId: renewalUser.id,
                            username: renewalUser.username,
                            event: 'subscription_renewed',
                            tier: renewalUser.tier,
                            amount: invoice.amount_paid / 100,
                            currency: (invoice.currency || 'EUR').toUpperCase(),
                            details: `Verlängerung. Coins auf ${targetCoins} aufgefüllt. Delta: ${creditResult.delta}`,
                            ipHash: 'webhook',
                            userAgent: 'Stripe-Webhook'
                        });

                        console.log(`[Subscription] Renewed for ${renewalUser.username}, refilled to ${targetCoins} credits`);

                        // Send Renewal Email
                        if (renewalUser.email) {
                            const html = `
                                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                                    <h2 style="color: #4f46e5;">Dein Abo wurde verlängert!</h2>
                                    <p>Hallo <strong>${renewalUser.username}</strong>,</p>
                                    <p>dein <strong>${renewalUser.tier}</strong> Abo wurde erfolgreich um einen weiteren Monat verlängert. Vielen Dank für deine Treue!</p>
                                    <p>Dein monatlicher Coin-Stand wurde soeben wieder aufgefüllt. Dein aktueller Stand beträgt nun: <strong>${targetCoins} Coins</strong>.</p>
                                    <p>Viel Spaß beim Kochen!</p>
                                </div>
                            `;
                            sendEmail(renewalUser.email, 'Abo verlängert & Coins erhalten', html).catch(err => console.error('Failed to send renewal email:', err));
                        }
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

        // Send Cancellation Email
        if (user.email) {
            const expiryDate = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString('de-DE') : 'Ende der Laufzeit';
            const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fecaca; border-radius: 12px; background-color: #fef2f2;">
                    <h2 style="color: #dc2626;">Kündigungsbestätigung</h2>
                    <p>Hallo <strong>${user.username}</strong>,</p>
                    <p>hiermit bestätigen wir deine Kündigung für das <strong>${user.tier}</strong> Abo.</p>
                    <p>Deine Premium-Funktionen (wie KI-Kochassistent, automatische Resteverwertung und erweiterte Statistik) stehen dir noch bis zum <strong>${expiryDate}</strong> zur Verfügung.</p>
                    <p><strong>Wichtiger Hinweis:</strong> Eventuelle Restcoins verfallen zum Ende der Laufzeit am ${expiryDate}.</p>
                    <p>Wir hoffen, dich bald wieder als Abonnenten begrüßen zu dürfen!</p>                    
                </div>
            `;
            sendEmail(user.email, 'Bestätigung deiner Kündigung', html).catch(err => console.error('Failed to send cancel email:', err));
        }

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
 * POST /reactivate - Reactivate subscription (cancel the cancellation) at period end
 */
router.post('/reactivate', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user.stripeSubscriptionId || !user.cancelAtPeriodEnd) {
            return res.status(400).json({ error: 'Keine aktive Kündigung zum Widerrufen gefunden.' });
        }

        const stripeInstance = await paymentService.getStripe();
        await stripeInstance.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: false
        });

        await user.update({
            cancelAtPeriodEnd: false,
            subscriptionStatus: 'active',
            pendingTier: 'none'
        });

        await SubscriptionLog.create({
            UserId: user.id,
            username: user.username,
            event: 'subscription_reactivated_user',
            tier: user.tier,
            details: 'Self-service reactivation (canceled the cancellation)',
            ipHash: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        });

        res.json({ message: 'Deine Kündigung wurde erfolgreich zurückgenommen. Dein Abo läuft weiter.' });
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
