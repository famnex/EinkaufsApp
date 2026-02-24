const stripe = require('stripe');
const paypal = require('@paypal/checkout-server-sdk');
const { Settings, User } = require('../models');

/**
 * Service to handle Stripe and PayPal payments
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
     * Get PayPal environment and client
     */
    async getPayPalClient() {
        const clientIdSetting = await Settings.findOne({ where: { key: 'paypal_client_id', UserId: null } });
        const clientSecretSetting = await Settings.findOne({ where: { key: 'paypal_client_secret', UserId: null } });

        if (!clientIdSetting || !clientSecretSetting) throw new Error('PayPal credentials not configured');

        // Note: In production you'd use LiveEnvironment
        const environment = new paypal.core.SandboxEnvironment(
            clientIdSetting.value,
            clientSecretSetting.value
        );
        return new paypal.core.PayPalHttpClient(environment);
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
            const subscription = await stripeInstance.subscriptions.retrieve(user.stripeSubscriptionId);

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
        }

        // --- LOGIK FÜR NEUES ABO (CHECKOUT) ---
        const session = await stripeInstance.checkout.sessions.create({
            customer: user.stripeCustomerId || undefined, // Bestehenden Kunden nutzen falls vorhanden
            customer_email: user.stripeCustomerId ? undefined : user.email,
            payment_method_types: ['card', 'sepa_debit', 'link'],
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
     * Handle Stripe Webhook
     */
    async handleStripeWebhook(event) {
        // Logic for subscription.updated, customer.subscription.deleted, etc.
        // This will be expanded in subscription.js route
    },

    /**
     * Create a Stripe Customer Portal session
     */
    async createPortalSession(userId, returnUrl) {
        const stripeInstance = await this.getStripe();
        const user = await User.findByPk(userId);

        if (!user.stripeCustomerId) {
            throw new Error('Kein Stripe-Kundenkonto gefunden.');
        }

        const session = await stripeInstance.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: returnUrl,
        });

        return session;
    },

    /**
     * Handle Stripe Webhook
     */
    async handleStripeWebhook(event) {
        // Logic for subscription.updated, customer.subscription.deleted, etc.
        // This is primarily handled in subscription.js route for now.
    }
};

module.exports = paymentService;
