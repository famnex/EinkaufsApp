const { Email, Settings, User } = require('../models');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

/**
 * Helper: Get SMTP settings
 */
async function getSmtpSettings(userId) {
    const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_secure', 'smtp_from', 'smtp_sender_name'];
    const settings = {};
    for (const key of keys) {
        const s = await Settings.findOne({ where: { key, UserId: userId } });
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        settings[camelKey] = s ? s.value : '';
    }
    return settings;
}

/**
 * Send Email
 */
async function sendEmail(to, subject, html) {
    try {
        // Try Global First
        let settingsUser = null;

        // Check if global settings exist
        const globalHost = await Settings.findOne({ where: { key: 'smtp_host', UserId: null } });
        if (globalHost) {
            settingsUser = null;
        } else {
            // Fallback to first admin
            const admin = await User.findOne({ where: { role: 'admin' } });
            if (admin) settingsUser = admin.id;
        }

        const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, smtpFrom, smtpSenderName } = await getSmtpSettings(settingsUser);

        if (!smtpHost || !smtpUser || !smtpPassword) {
            console.log('SMTP Config missing. Would send:', { to, subject });
            return { success: false, error: 'SMTP Configuration missing' };
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort) || 587,
            secure: smtpSecure === 'true',
            auth: { user: smtpUser, pass: smtpPassword },
        });

        const from = smtpSenderName ? `"${smtpSenderName}" <${smtpFrom}>` : smtpFrom || process.env.SMTP_FROM || 'noreply@gabelguru.local';

        const info = await transporter.sendMail({
            from: from,
            to: to,
            subject: subject,
            html: html,
        });

        console.log('Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Helper: Get IMAP settings for a user
 */
async function getImapSettings(userId) {
    const keys = ['imap_host', 'imap_port', 'imap_user', 'imap_password', 'imap_secure'];
    const settings = {};
    for (const key of keys) {
        const s = await Settings.findOne({ where: { key, UserId: userId } });
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        settings[camelKey] = s ? s.value : '';
    }
    settings.imapSecure = settings.imapSecure === 'true';
    return settings;
}

/**
 * Fetch emails for a specific user
 */
async function fetchEmailsForUser(userId) {
    const imap = await getImapSettings(userId);
    if (!imap.imapHost || !imap.imapPassword) {
        return { success: false, error: 'IMAP not configured' };
    }

    const client = new ImapFlow({
        host: imap.imapHost,
        port: parseInt(imap.imapPort) || 993,
        secure: imap.imapSecure,
        auth: {
            user: imap.imapUser,
            pass: imap.imapPassword
        },
        logger: false
    });

    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        let fetched = 0;

        try {
            // Fetch last 100 messages
            const totalMessages = client.mailbox.exists;
            const startSeq = Math.max(1, totalMessages - 99);

            for await (const message of client.fetch(`${startSeq}:*`, {
                envelope: true,
                source: true
            })) {
                const msgId = message.envelope?.messageId;
                if (!msgId) continue;

                // Unique check (MessageId is unique in DB now, so findOne is fast)
                const exists = await Email.findOne({ where: { messageId: msgId, UserId: userId } });
                if (exists) continue;

                try {
                    const parsed = await simpleParser(message.source);

                    await Email.create({
                        messageId: msgId,
                        folder: 'inbox',
                        fromAddress: parsed.from?.text || message.envelope?.from?.[0]?.address || 'Unbekannt',
                        toAddress: parsed.to?.text || message.envelope?.to?.[0]?.address || '',
                        cc: parsed.cc?.text || null,
                        bcc: parsed.bcc?.text || null,
                        subject: parsed.subject || message.envelope?.subject || '(Kein Betreff)',
                        body: parsed.html || `<pre>${parsed.text || ''}</pre>`,
                        bodyText: parsed.text || '',
                        isRead: false,
                        date: parsed.date || message.envelope?.date || new Date(),
                        inReplyTo: parsed.inReplyTo || null,
                        UserId: userId
                    });
                    fetched++;
                } catch (parseErr) {
                    console.error(`[MessagingService] Parse error for user ${userId}:`, parseErr.message);
                }
            }
        } finally {
            lock.release();
        }
        await client.logout();
        return { success: true, fetched };
    } catch (err) {
        console.error(`[MessagingService] Fetch error for user ${userId}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Initialize background fetch cron job
 */
function initEmailCron() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        console.log('[MessagingService] Running background email fetch...');
        try {
            // Find all admin users
            const admins = await User.findAll({ where: { role: 'admin' } });
            for (const admin of admins) {
                const result = await fetchEmailsForUser(admin.id);
                if (result.success && result.fetched > 0) {
                    console.log(`[MessagingService] Fetched ${result.fetched} emails for admin ${admin.username}`);
                }
            }
        } catch (err) {
            console.error('[MessagingService] Cron error:', err.message);
        }
    });
}

module.exports = {
    fetchEmailsForUser,
    fetchEmailsForUser,
    initEmailCron,
    sendEmail
};
