const { Settings, User, Email } = require('../models');
const nodemailer = require('nodemailer');

/**
 * Loads the system email configuration from the database.
 * Prioritizes admin users' settings.
 * @returns {Promise<Object|null>} The transporter configuration or null if not found.
 */
async function loadSystemEmailConfig() {
    try {
        // Load global settings (UserId: null)
        const smtphost = await Settings.findOne({ where: { key: 'smtp_host', UserId: null } });

        if (!smtphost || !smtphost.value) {
            console.warn('[EmailService] No global Admin SMTP configuration found.');
            return null;
        }

        // Load other settings
        const keys = ['smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_sender_name', 'smtp_secure'];
        const settings = { smtp_host: smtphost.value };

        for (const key of keys) {
            const setting = await Settings.findOne({ where: { key, UserId: null } });
            settings[key] = setting ? setting.value : null;
        }

        // Construct config object
        const config = {
            host: settings.smtp_host,
            port: parseInt(settings.smtp_port) || 587,
            secure: settings.smtp_secure === 'true', // Note: 'true' string from DB
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_password
            },
            from: settings.smtp_from,
            senderName: settings.smtp_sender_name
        };

        return config;

    } catch (error) {
        console.error('[EmailService] Error loading configuration:', error);
        return null;
    }
}

/**
 * Loads the global email footer from settings.
 * @returns {Promise<string>} HTML formatted footer.
 */
async function getGlobalFooter() {
    try {
        const footer = await Settings.findOne({ where: { key: 'newsletter_footer', UserId: null } });
        if (footer && footer.value) {
            return `<div style="font-size: 12px; color: #666; margin-top: 30px;">${footer.value}</div>`;
        }
    } catch (err) {
        console.error('[EmailService] Failed to load footer:', err);
    }
    return '';
}

/**
 * Sends a system email using the configured SMTP settings.
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 * @returns {Promise<boolean>} True if sent successfully, false otherwise.
 */
async function sendSystemEmail({ to, subject, text, html }) {
    try {
        const config = await loadSystemEmailConfig();
        if (!config) {
            console.error('[EmailService] Cannot send email: Configuration missing.');
            return false;
        }

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth
        });

        const fromAddress = config.senderName ? `"${config.senderName}" <${config.from}>` : config.from;

        // Apply Global Footer
        const globalFooter = await getGlobalFooter();
        // Do not use replace(/\n/g, '<br>') on HTML formatted text that already uses tags
        const finalHtml = html ? (html + globalFooter) : (text ? (text + globalFooter) : '');
        const finalText = text ? (text + globalFooter.replace(/<[^>]*>/g, '')) : (html ? html.replace(/<[^>]*>/g, '') : '');

        const info = await transporter.sendMail({
            from: fromAddress,
            to,
            subject,
            text: finalText,
            html: finalHtml
        });

        console.log('[EmailService] Email sent:', info.messageId);

        // Log to DB
        try {
            await Email.create({
                messageId: info.messageId,
                folder: 'sent_system',
                fromAddress: fromAddress,
                toAddress: Array.isArray(to) ? to.join(', ') : to,
                subject: subject || '',
                body: html || text || '',
                bodyText: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
                isRead: true,
                date: new Date(),
                UserId: null // Shared admin folder
            });
        } catch (logError) {
            console.error('[EmailService] Failed to log to DB:', logError.message);
        }

        return true;

    } catch (error) {
        console.error('[EmailService] Error sending email:', error);
        return false;
    }
}

/**
 * Notifies all admins via system email.
 * @param {Object} options - Email options
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 */
async function notifyAdmins({ subject, text, html }) {
    try {
        const admins = await User.findAll({ where: { role: 'admin' } });
        if (admins.length === 0) {
            console.warn('[EmailService] No admin users found to notify.');
            return;
        }

        console.log(`[EmailService] Notifying ${admins.length} admins: ${subject}`);

        const promises = admins.map(admin =>
            sendSystemEmail({
                to: admin.email,
                subject,
                text,
                html
            })
        );

        await Promise.all(promises);
    } catch (error) {
        console.error('[EmailService] Error notifying admins:', error);
    }
}

module.exports = {
    sendSystemEmail,
    notifyAdmins,
    getGlobalFooter,
    loadSystemEmailConfig // Exported for testing/debugging if needed
};
