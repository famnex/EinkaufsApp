const express = require('express');
const router = express.Router();
const { Email, Settings, User } = require('../models');
const { auth } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const { fetchEmailsForUser } = require('../services/messagingService');

// Helper: Get SMTP settings for user
async function getSmtpSettings(userId) {
    const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_secure'];
    const settings = {};
    for (const key of keys) {
        const s = await Settings.findOne({ where: { key, UserId: userId } });
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        settings[camelKey] = s ? s.value : '';
    }
    settings.smtpSecure = settings.smtpSecure === 'true';
    return settings;
}

// GET / - List emails by folder
router.get('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const folder = req.query.folder || 'inbox';
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 50;

        const { count, rows: emails } = await Email.findAndCountAll({
            where: { folder, UserId: req.user.id },
            order: [['date', 'DESC']],
            offset: page * limit,
            limit,
            attributes: ['id', 'messageId', 'folder', 'fromAddress', 'toAddress', 'cc', 'bcc', 'subject', 'isRead', 'date', 'inReplyTo']
        });

        // Count unread per folder
        const unreadInbox = await Email.count({ where: { folder: 'inbox', isRead: false, UserId: req.user.id } });

        res.json({ emails, total: count, unreadInbox });
    } catch (err) {
        console.error('[Messaging GET /] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /:id - Get single email
router.get('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: req.user.id } });
        if (!email) return res.status(404).json({ error: 'Email nicht gefunden' });

        // Mark as read
        if (!email.isRead) {
            await email.update({ isRead: true });
        }

        res.json(email);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /send - Send email via SMTP
router.post('/send', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { to, cc, bcc, subject, body, inReplyTo } = req.body;
        if (!to) return res.status(400).json({ error: 'Empfänger ist erforderlich' });

        const smtp = await getSmtpSettings(req.user.id);
        if (!smtp.smtpHost || !smtp.smtpPassword) {
            return res.status(400).json({ error: 'SMTP nicht konfiguriert. Bitte zuerst unter System > E-Mail einrichten.' });
        }

        const transporter = nodemailer.createTransport({
            host: smtp.smtpHost,
            port: parseInt(smtp.smtpPort) || 587,
            secure: smtp.smtpSecure,
            auth: {
                user: smtp.smtpUser,
                pass: smtp.smtpPassword
            }
        });

        const mailOptions = {
            from: smtp.smtpFrom || smtp.smtpUser,
            to,
            cc,
            bcc,
            subject: subject || '',
            html: body || '',
            text: body ? body.replace(/<[^>]*>/g, '') : ''
        };

        if (inReplyTo) {
            mailOptions.inReplyTo = inReplyTo;
            mailOptions.references = inReplyTo;
        }

        const info = await transporter.sendMail(mailOptions);

        // Save to sent folder
        await Email.create({
            messageId: info.messageId,
            folder: 'sent',
            fromAddress: smtp.smtpFrom || smtp.smtpUser,
            toAddress: to,
            cc: cc || null,
            bcc: bcc || null,
            subject: subject || '',
            body: body || '',
            bodyText: body ? body.replace(/<[^>]*>/g, '') : '',
            isRead: true,
            date: new Date(),
            inReplyTo: inReplyTo || null,
            UserId: req.user.id
        });

        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('[Messaging send] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /fetch - Manually fetch emails via IMAP
router.post('/fetch', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const result = await fetchEmailsForUser(req.user.id);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json({ success: true, fetched: result.fetched, message: `${result.fetched} neue E-Mail(s) abgerufen` });
    } catch (err) {
        console.error('[Messaging fetch] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/trash - Move to trash
router.put('/:id/trash', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: req.user.id } });
        if (!email) return res.status(404).json({ error: 'Email nicht gefunden' });

        await email.update({ folder: 'trash' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/restore - Restore from trash
router.put('/:id/restore', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: req.user.id } });
        if (!email) return res.status(404).json({ error: 'Email nicht gefunden' });

        // Restore to original folder based on whether we sent it
        const smtp = await getSmtpSettings(req.user.id);
        const isOurs = email.fromAddress === smtp.smtpFrom || email.fromAddress === smtp.smtpUser;
        await email.update({ folder: isOurs ? 'sent' : 'inbox' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id - Permanent delete
router.delete('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: req.user.id } });
        if (!email) return res.status(404).json({ error: 'Email nicht gefunden' });

        await email.destroy();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
