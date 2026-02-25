const { Newsletter, NewsletterRecipient, User, Email, sequelize, Settings } = require('../models');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

/**
 * Service to handle newsletter related logic
 */
class NewsletterService {
    constructor() {
        this.isProcessing = false;
    }

    /**
     * Start the background processing if not already running
     */
    async startProcessing() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        console.log('[NewsletterService] Background worker started.');
        this._runCycle();
    }

    /**
     * Main processing loop
     */
    async _runCycle() {
        try {
            // Find a newsletter that is 'sending'
            let newsletter = await Newsletter.findOne({
                where: { status: 'sending' },
                order: [['createdAt', 'ASC']]
            });

            // If none sending, check for 'draft' that should start (this might be triggered by route)
            // For now, we assume the route sets it to 'sending'

            if (!newsletter) {
                this.isProcessing = false;
                console.log('[NewsletterService] No newsletters to send. Worker going to sleep.');
                return;
            }

            // Process a batch
            await this._processNewsletterBatch(newsletter);

            // Re-fetch to check progress
            await newsletter.reload();

            if (newsletter.sentCount + newsletter.failedCount >= newsletter.recipientsCount) {
                newsletter.status = 'completed';
                await newsletter.save();
                console.log(`[NewsletterService] Newsletter "${newsletter.subject}" completed.`);

                // Continue with next newsletter if any (no wait time between different newsletters)
                return this._runCycle();
            } else {
                // Wait for Y minutes before the NEXT batch
                const waitMs = (newsletter.waitMinutes || 5) * 60 * 1000;
                console.log(`[NewsletterService] Batch finished for "${newsletter.subject}". Waiting ${newsletter.waitMinutes} minutes until next batch...`);
                setTimeout(() => this._runCycle(), waitMs);
            }

        } catch (error) {
            console.error('[NewsletterService] Error in processing cycle:', error);
            this.isProcessing = false;
        }
    }

    /**
     * Process a single batch for a newsletter
     */
    async _processNewsletterBatch(newsletter) {
        const recipients = await NewsletterRecipient.findAll({
            where: {
                NewsletterId: newsletter.id,
                status: 'pending'
            },
            include: [{ model: User, attributes: ['id', 'username', 'email', 'newsletterSignupDate'] }],
            limit: newsletter.batchSize || 50
        });

        if (recipients.length === 0) return;

        console.log(`[NewsletterService] Sending batch of ${recipients.length} for "${newsletter.subject}"`);

        const smtpConfig = await this._getGlobalSmtpConfig();
        if (!smtpConfig) {
            console.error('[NewsletterService] SMTP config missing. Batch failed.');
            return;
        }

        const transporter = nodemailer.createTransport(smtpConfig);
        const fromAddress = smtpConfig.senderName ? `\"${smtpConfig.senderName}\" <${smtpConfig.from}>` : smtpConfig.from;

        for (const recipient of recipients) {
            try {
                // Generate Unsubscribe Link
                const token = jwt.sign({ id: recipient.User.id, action: 'unsubscribe' }, process.env.JWT_SECRET || 'gabelguru-secret', { expiresIn: '30d' });
                const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'; // Fallback
                const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${token}`;

                // Format Signup Date
                const signupDate = recipient.User.newsletterSignupDate ? new Date(recipient.User.newsletterSignupDate).toLocaleDateString('de-DE') : 'unbekanntem Datum';

                // Personalized Body & Mandatory Footer
                let personalizedBody = newsletter.body
                    .replace(/{benutzername}/g, recipient.User.username)
                    .replace(/{abmeldelink}/g, unsubscribeUrl);

                const mandatoryFooter = `
<br><br>
<hr>
<p style="font-size: 8px; color: #666;">
    Du erhältst diesen Newsletter, weil du am ${signupDate} unseren Newsletter abonniert hast.<br>
    Du möchtest keine Newsletter mehr von uns erhalten? Dann klick <a href="${unsubscribeUrl}">auf diesen Link</a>.
</p>`;

                const fullBody = personalizedBody + (newsletter.footer ? `<div style="margin-top: 30px;">${newsletter.footer}</div>` : '') + mandatoryFooter;

                await transporter.sendMail({
                    from: fromAddress,
                    to: recipient.User.email,
                    subject: newsletter.subject,
                    html: fullBody
                });

                recipient.status = 'sent';
                recipient.sentAt = new Date();
                await recipient.save();

                newsletter.sentCount += 1;
            } catch (err) {
                console.error(`[NewsletterService] Failed to send to ${recipient.User.email}:`, err.message);
                recipient.status = 'failed';
                recipient.error = err.message;
                await recipient.save();

                newsletter.failedCount += 1;
            }
        }

        await newsletter.save();
    }

    /**
     * Helper to load global SMTP settings
     */
    async _getGlobalSmtpConfig() {
        const settings = await Settings.findAll({
            where: { UserId: null, key: { [Op.like]: 'smtp_%' } }
        });

        const config = {};
        settings.forEach(s => {
            const key = s.key.replace('smtp_', '');
            config[key] = s.value;
        });

        if (!config.host || !config.user || !config.password) {
            console.error('[NewsletterService] Missing basic SMTP configuration (host, user, or password).');
            return null;
        }

        return {
            host: config.host,
            port: parseInt(config.port) || 587,
            secure: config.secure === 'true' || config.port === '465',
            auth: {
                user: config.user,
                pass: config.password
            },
            from: config.from || config.user,
            senderName: config.sender_name
        };
    }

    /**
     * Queue a new newsletter
     */
    async queueNewsletter({ subject, body, batchSize, waitMinutes, footer }) {
        // 1. Create Newsletter record
        const newsletter = await Newsletter.create({
            subject,
            body,
            status: 'draft',
            batchSize: batchSize || 50,
            waitMinutes: waitMinutes || 5,
            footer
        });

        // 2. Find all subscribed users
        const users = await User.findAll({
            where: { newsletterSignedUp: true }
        });

        newsletter.recipientsCount = users.length;
        await newsletter.save();

        // 3. Create NewsletterRecipient records
        const recipientRecords = users.map(user => ({
            NewsletterId: newsletter.id,
            UserId: user.id,
            status: 'pending'
        }));

        await NewsletterRecipient.bulkCreate(recipientRecords);

        // 4. Log one representative email to 'newsletter' folder for documentation
        // (Just one entry for the whole newsletter campaign as requested)
        try {
            await Email.create({
                folder: 'newsletter',
                fromAddress: 'System',
                toAddress: `${users.length} Empfänger`,
                subject: subject,
                body: body,
                bodyText: body.replace(/<[^>]*>/g, ''),
                date: new Date(),
                isRead: true,
                UserId: null, // Shared admin folder
                messageId: `newsletter-${newsletter.id}` // Link to our internal ID
            });
        } catch (logErr) {
            console.error('[NewsletterService] Failed to log to Email folder:', logErr.message);
        }

        return newsletter;
    }

    /**
     * Start/Resume sending a newsletter
     */
    async startSending(newsletterId) {
        const newsletter = await Newsletter.findByPk(newsletterId);
        if (!newsletter) throw new Error('Newsletter not found');

        newsletter.status = 'sending';
        await newsletter.save();

        this.startProcessing();
        return newsletter;
    }
}

module.exports = new NewsletterService();
