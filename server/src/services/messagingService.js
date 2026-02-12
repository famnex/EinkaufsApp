const { Email, Settings, User } = require('../models');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const cron = require('node-cron');

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
    initEmailCron
};
