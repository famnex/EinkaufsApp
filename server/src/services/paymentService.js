const stripe = require('stripe');
const { Settings, User } = require('../models');

/**
 * Service to handle Stripe payments
 */
const paymentService = {
    /**
     * Get Stripe instance with secret key from settings
     */
    async getStripe() {
        const setting = await Settings.findOne({ where: { key: 'stripe_secret_key', UserId: null } });
        if (!setting || !setting.value) throw new Error('Stripe Secret Key not configured');
        return stripe(setting.value);
    },

    /**
         * Create a Stripe Checkout Session for subscription or upgrade
         */
    async createStripeSession(userId, tier, successUrl, cancelUrl) {
        const stripeInstance = await this.getStripe();
        const user = await User.findByPk(userId);

        const priceSilber = await Settings.findOne({ where: { key: 'stripe_price_silber', UserId: null } });
        const priceGold = await Settings.findOne({ where: { key: 'stripe_price_gold', UserId: null } });

        const prices = {
            'Silbergabel': priceSilber?.value,
            'Goldgabel': priceGold?.value
        };

        if (!prices[tier]) {
            throw new Error(`Stripe Price ID für "${tier}" ist nicht konfiguriert.`);
        }

        // --- LOGIK FÜR BESTEHENDES ABO (UPGRADE/DOWNGRADE) ---
        // Falls der User bereits ein Abo hat, nutzen wir die Subscription Update Logik
        if (user.stripeSubscriptionId) {
            try {
                const subscription = await stripeInstance.subscriptions.retrieve(user.stripeSubscriptionId);

                if (!subscription.items.data || subscription.items.data.length === 0) {
                    throw new Error('Keine Abo-Positionen in Stripe gefunden.');
                }

                await stripeInstance.subscriptions.update(user.stripeSubscriptionId, {
                    items: [{
                        id: subscription.items.data[0].id,
                        price: prices[tier], // Hier die neue Price-ID
                    }],
                    proration_behavior: 'always_invoice', // Berechnet Differenz sofort
                    payment_behavior: 'pending_if_incomplete',
                    metadata: { userId, tier }
                });

                // Wir geben hier ein spezielles Flag zurück, damit dein Controller weiß: 
                // "Kein Redirect zu Stripe nötig, Abo wurde im Hintergrund aktualisiert"
                return { url: successUrl, type: 'update' };
            } catch (err) {
                console.error("Stripe Upgrade Error:", err);
                throw new Error('Upgrade konnte nicht durchgeführt werden: ' + err.message);
            }
        }

        // --- LOGIK FÜR NEUES ABO (CHECKOUT) ---
        const session = await stripeInstance.checkout.sessions.create({
            customer: user.stripeCustomerId || undefined, // Bestehenden Kunden nutzen falls vorhanden
            customer_email: user.stripeCustomerId ? undefined : user.email,
            line_items: [{
                price: prices[tier],
                quantity: 1,
            }],
            mode: 'subscription',
            consent_collection: {
                terms_of_service: 'required',
            },
            custom_text: {
                submit: {
                    message: 'Ich stimme der sofortigen Ausführung des Vertrages zu und bestätige, dass mein Widerrufsrecht bei Beginn der Ausführung digitaler Inhalte erlischt.',
                },
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { userId, tier }
        });

        return session;
    },


    /**
     * Create a Stripe Customer Portal session
     */
    async createPortalSession(userId, returnUrl) {
        const stripeInstance = await this.getStripe();

        // Effective User check (Members use Owner's Billing)
        const currentUser = await User.findByPk(userId);
        const effectiveUserId = currentUser.householdId || userId;
        const user = await User.findByPk(effectiveUserId);

        let customerId = user.stripeCustomerId;

        // Fallback: Falls keine CustomerId existiert, aber eine SubscriptionId, lade die CustomerId von Stripe
        if (!customerId && user.stripeSubscriptionId) {
            try {
                const subscription = await stripeInstance.subscriptions.retrieve(user.stripeSubscriptionId);
                customerId = subscription.customer;
                if (customerId) {
                    await user.update({ stripeCustomerId: customerId });
                }
            } catch (err) {
                console.error("Failed to retrieve customer from subscription:", err);
            }
        }

        if (!customerId) {
            throw new Error('Kein Stripe-Kundenkonto gefunden. Bitte führen Sie erst eine Buchung durch.');
        }

        const session = await stripeInstance.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });

        return session;
    }
};

module.exports = paymentService;
