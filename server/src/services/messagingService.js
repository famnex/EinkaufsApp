const { Email, Settings, User } = require('../models');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { notifyAdmins, getGlobalFooter } = require('./emailService');

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

        // Apply Global Footer
        const globalFooter = await getGlobalFooter();
        const finalHtml = html ? (html + globalFooter) : '';

        const info = await transporter.sendMail({
            from: from,
            to: to,
            subject: subject,
            html: finalHtml,
        });

        console.log('Message sent: %s', info.messageId);

        // Log to DB if it's a system email
        try {
            await Email.create({
                messageId: info.messageId,
                folder: 'sent_system',
                fromAddress: from,
                toAddress: Array.isArray(to) ? to.join(', ') : to,
                subject: subject || '',
                body: html || '',
                bodyText: html ? html.replace(/<[^>]*>/g, '') : '',
                isRead: true,
                date: new Date(),
                UserId: null // Shared admin folder (All admins see the same)
            });
        } catch (logError) {
            console.error('Failed to log system email to DB:', logError.message);
        }

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
 * Fetch emails for a specific user (or global admin if userId is null)
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

        // 1. Retroactive Cleanup: Move existing MAILER-DAEMON emails from inbox to daemon
        try {
            const { Op } = require('sequelize');
            await Email.update({ folder: 'daemon' }, {
                where: {
                    UserId: userId,
                    folder: 'inbox',
                    fromAddress: { [Op.like]: '%MAILER-DAEMON%' }
                }
            });
        } catch (cleanupErr) {
            console.error(`[MessagingService] Cleanup error for user ${userId}:`, cleanupErr.message);
        }

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

                // Unique check
                const exists = await Email.findOne({ where: { messageId: msgId, UserId: userId } });
                if (exists) continue;

                try {
                    const parsed = await simpleParser(message.source);
                    const fromAddr = parsed.from?.text || message.envelope?.from?.[0]?.address || 'Unbekannt';

                    // 2. Auto-routing: Check for MAILER-DAEMON
                    const targetFolder = fromAddr.toUpperCase().includes('MAILER-DAEMON') ? 'daemon' : 'inbox';

                    await Email.create({
                        messageId: msgId,
                        folder: targetFolder,
                        fromAddress: fromAddr,
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

        if (fetched > 0) {
            notifyAdmins({
                subject: `📧 Neue Emails empfangen (${fetched})`,
                text: `Hallo Admin,\n\nes wurden ${fetched} neue E-Mails abgerufen.`,
                html: `
                    <div style="font-family: Arial, sans-serif; border: 1px solid #4f46e5; padding: 20px; border-radius: 10px;">
                        <h2 style="color: #4f46e5;">📧 Neue E-Mails abgerufen</h2>
                        <p>Hallo Admin,</p>
                        <p>der Hintergrund-Dienst hat soeben <b>${fetched} neue E-Mails</b> erfolgreich in die Datenbank importiert.</p>
                        <p>Alle Administratoren können diese nun in der Verwaltung unter "Messaging" einsehen.</p>
                    </div>
                `
            });
        }

        return { success: true, fetched };
    } catch (err) {
        console.error(`[MessagingService] Fetch error for user ${userId}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Initialize background fetch cron job (Global Admin only)
 */
function initEmailCron() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        console.log('[MessagingService] Running background email fetch (Global)...');
        try {
            // Since all admins share the same config, we just fetch once using the global SMTP/IMAP settings (UserId: null)
            const result = await fetchEmailsForUser(null);
            if (result.success && result.fetched > 0) {
                console.log(`[MessagingService] Fetched ${result.fetched} emails into shared admin folder`);
            }
        } catch (err) {
            console.error('[MessagingService] Cron error:', err.message);
        }
    });
}

function sendEmailHelper(to, subject, html) {
    return sendEmail(to, subject, html);
}

module.exports = {
    fetchEmailsForUser,
    initEmailCron,
    sendEmail
};
