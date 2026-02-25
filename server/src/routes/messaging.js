const express = require('express');
const router = express.Router();
const { Email, Settings, User } = require('../models');
const { auth } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const { fetchEmailsForUser } = require('../services/messagingService');
const { getGlobalFooter } = require('../services/emailService');
const logger = require('../utils/logger');

// Helper: Get SMTP settings (Global Admin)
async function getSmtpSettings() {
    const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_sender_name', 'smtp_secure'];
    const settings = {};
    for (const key of keys) {
        const s = await Settings.findOne({ where: { key, UserId: null } });
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
        const search = req.query.search || '';

        const { Op } = require('sequelize');
        const where = { folder, UserId: null };

        if (search) {
            where[Op.or] = [
                { fromAddress: { [Op.like]: `%${search}%` } },
                { toAddress: { [Op.like]: `%${search}%` } },
                { subject: { [Op.like]: `%${search}%` } },
                { body: { [Op.like]: `%${search}%` } },
                { bodyText: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: emails } = await Email.findAndCountAll({
            where,
            order: [['date', 'DESC']],
            offset: page * limit,
            limit,
            attributes: ['id', 'messageId', 'folder', 'fromAddress', 'toAddress', 'cc', 'bcc', 'subject', 'isRead', 'date', 'inReplyTo', 'previousFolder', 'flag']
        });

        // Count unread per folder
        const unreadInbox = await Email.count({ where: { folder: 'inbox', isRead: false, UserId: null } });

        res.json({ emails, total: count, unreadInbox });
    } catch (err) {
        console.error('[Messaging GET /] Error:', err);
        res.status(500).json({ error: err.message });
    }
});


// BULK ACTIONS

// PUT /bulk/trash - Bulk move to trash
router.put('/bulk/trash', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs erforderlich' });

        const { Op } = require('sequelize');

        // Find them first to store current folder
        const emails = await Email.findAll({ where: { id: { [Op.in]: ids }, UserId: null } });

        for (const email of emails) {
            await email.update({
                previousFolder: email.folder,
                folder: 'trash'
            });
        }

        res.json({ success: true, count: emails.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /bulk/restore - Bulk restore from trash
router.put('/bulk/restore', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs erforderlich' });

        const { Op } = require('sequelize');
        const emails = await Email.findAll({ where: { id: { [Op.in]: ids }, UserId: null } });

        const smtp = await getSmtpSettings();

        for (const email of emails) {
            let targetFolder = email.previousFolder;
            if (!targetFolder) {
                const isOurs = email.fromAddress === smtp.smtpFrom || email.fromAddress === smtp.smtpUser;
                targetFolder = isOurs ? 'sent' : 'inbox';
            }
            await email.update({
                folder: targetFolder,
                previousFolder: null
            });
        }

        res.json({ success: true, count: emails.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /bulk/delete - Bulk permanent delete
router.post('/bulk/delete', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs erforderlich' });

        const { Op } = require('sequelize');
        const count = await Email.destroy({
            where: {
                id: { [Op.in]: ids },
                UserId: null
            }
        });

        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /bulk/read - Bulk mark as read
router.put('/bulk/read', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { ids } = req.body;
        const { Op } = require('sequelize');
        await Email.update({ isRead: true }, { where: { id: { [Op.in]: ids }, UserId: null } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /bulk/unread - Bulk mark as unread
router.put('/bulk/unread', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { ids } = req.body;
        const { Op } = require('sequelize');
        await Email.update({ isRead: false }, { where: { id: { [Op.in]: ids }, UserId: null } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SINGLE ACTIONS

// GET /:id - Get single email
router.get('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: null } });
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

        const smtp = await getSmtpSettings();
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

        const fromAddress = smtp.smtpSenderName ? { name: smtp.smtpSenderName, address: smtp.smtpFrom || smtp.smtpUser } : (smtp.smtpFrom || smtp.smtpUser);
        logger.logSystem('DEBUG', `[MessagingRoute] Preparing to send email to ${to} from:`, { fromAddress });

        const globalFooter = await getGlobalFooter();
        const baseHtml = body || '';
        const baseText = body ? body.replace(/<[^>]*>/g, '') : '';

        const finalHtml = baseHtml + globalFooter;
        const finalText = baseText + globalFooter.replace(/<[^>]*>/g, '');

        logger.logSystem('DEBUG', `[MessagingRoute] Sending email to ${to} with subject: "${subject}"`);
        const mailOptions = {
            from: fromAddress,
            to,
            cc,
            bcc,
            subject: subject || '',
            html: finalHtml,
            text: finalText
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
            fromAddress: fromAddress,
            toAddress: to,
            cc: cc || null,
            bcc: bcc || null,
            subject: subject || '',
            body: finalHtml,
            bodyText: finalText,
            isRead: true,
            date: new Date(),
            inReplyTo: inReplyTo || null,
            UserId: null
        });

        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        logger.logError('[Messaging send] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /fetch - Manually fetch emails via IMAP
router.post('/fetch', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const result = await fetchEmailsForUser(null);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json({ success: true, fetched: result.fetched, message: `${result.fetched} neue E-Mail(s) abgerufen` });
    } catch (err) {
        logger.logError('[Messaging fetch] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/read - Mark single as read
router.put('/:id/read', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        await Email.update({ isRead: true }, { where: { id: req.params.id, UserId: null } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/unread - Mark single as unread
router.put('/:id/unread', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        await Email.update({ isRead: false }, { where: { id: req.params.id, UserId: null } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/flag - Toggle/Cycle flag (none -> flagged -> completed -> none)
router.put('/:id/flag', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: null } });
        if (!email) return res.status(404).json({ error: 'Not found' });

        let nextFlag = 'none';
        if (email.flag === 'none') nextFlag = 'flagged';
        else if (email.flag === 'flagged') nextFlag = 'completed';
        else nextFlag = 'none';

        await email.update({ flag: nextFlag });
        res.json({ success: true, flag: nextFlag });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/trash - Move to trash
router.put('/:id/trash', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: null } });
        if (!email) return res.status(404).json({ error: 'Email nicht gefunden' });

        await email.update({
            previousFolder: email.folder,
            folder: 'trash'
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/restore - Restore from trash
router.put('/:id/restore', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: null } });
        if (!email) return res.status(404).json({ error: 'Email nicht gefunden' });

        // Restore to original folder based on whether we sent it, or use previousFolder
        let targetFolder = email.previousFolder;
        if (!targetFolder) {
            const smtp = await getSmtpSettings();
            const isOurs = email.fromAddress === smtp.smtpFrom || email.fromAddress === smtp.smtpUser;
            targetFolder = isOurs ? 'sent' : 'inbox';
        }

        await email.update({
            folder: targetFolder,
            previousFolder: null
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id - Permanent delete
router.delete('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const email = await Email.findOne({ where: { id: req.params.id, UserId: null } });
        if (!email) return res.status(404).json({ error: 'Email nicht gefunden' });

        await email.destroy();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
