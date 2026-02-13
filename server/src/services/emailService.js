const nodemailer = require('nodemailer');
const { Settings, User } = require('../models');

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

        const info = await transporter.sendMail({
            from: fromAddress,
            to,
            subject,
            text,
            html
        });

        console.log('[EmailService] Email sent:', info.messageId);
        return true;

    } catch (error) {
        console.error('[EmailService] Error sending email:', error);
        return false;
    }
}

module.exports = {
    sendSystemEmail,
    loadSystemEmailConfig // Exported for testing/debugging if needed
};
