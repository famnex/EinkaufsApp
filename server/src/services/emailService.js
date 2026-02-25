const nodemailer = require('nodemailer');
const { logSystem, logError } = require('../utils/logger');
const { Settings, User, Email } = require('../models');

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
            logSystem('DEBUG', '[EmailService] No global Admin SMTP configuration found.');
            return null;
        }

        // Load other settings
        const keys = ['smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_sender_name', 'smtp_secure'];
        const settings = { smtp_host: smtphost.value };

        for (const key of keys) {
            const setting = await Settings.findOne({ where: { key, UserId: null } });
            settings[key] = setting ? setting.value : null;
        }

        // Construct config object with fallbacks
        const config = {
            host: settings.smtp_host,
            port: parseInt(settings.smtp_port) || 587,
            secure: settings.smtp_secure === 'true',
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_password
            },
            from: settings.smtp_from || settings.smtp_user,
            senderName: settings.smtp_sender_name || null
        };

        logSystem('DEBUG', '[EmailService] SMTP Config loaded:', {
            host: config.host,
            user: config.auth.user,
            from: config.from,
            senderName: config.senderName,
            secure: config.secure
        });

        if (!config.from) {
            logSystem('DEBUG', '[EmailService] SMTP From/User missing.');
            return null;
        }

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
        logError('[EmailService] Failed to load footer:', err);
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
            logSystem('ERROR', '[EmailService] Cannot send email: Configuration missing.');
            return false;
        }

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth
        });

        const fromAddress = config.senderName ? { name: config.senderName, address: config.from } : config.from;
        logSystem('DEBUG', `[EmailService] Preparing to send email to ${to} from:`, { fromAddress });

        // Apply Global Footer
        const globalFooter = await getGlobalFooter();
        // Do not use replace(/\n/g, '<br>') on HTML formatted text that already uses tags
        const finalHtml = html ? (html + globalFooter) : (text ? (text + globalFooter) : '');
        const finalText = text ? (text + globalFooter.replace(/<[^>]*>/g, '')) : (html ? html.replace(/<[^>]*>/g, '') : '');

        logSystem('DEBUG', `[EmailService] Sending email to ${to} with subject: "${subject}"`);
        const info = await transporter.sendMail({
            from: fromAddress,
            to,
            subject,
            text: finalText,
            html: finalHtml
        });

        logSystem('INFO', `System email sent to ${to}`, {
            subject,
            from: typeof fromAddress === 'object' ? `${fromAddress.name} <${fromAddress.address}>` : fromAddress,
            messageId: info.messageId
        });
        console.log('[EmailService] Email sent:', info.messageId);

        // Log to DB
        try {
            const senderString = typeof fromAddress === 'object' ? `"${fromAddress.name}" <${fromAddress.address}>` : fromAddress;
            await Email.create({
                messageId: info.messageId,
                folder: 'sent_system',
                fromAddress: senderString,
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
