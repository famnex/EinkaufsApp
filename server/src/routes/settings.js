const express = require('express');
const router = express.Router();
const { Settings } = require('../models');
const { auth } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const { exec } = require('child_process');

// Get system version
router.get('/system/version', auth, (req, res) => {
    exec('git describe --tags --always', (error, stdout, stderr) => {
        if (error) {
            console.warn('Git describe failed:', error);
            return res.json({ version: require('../../package.json').version });
        }
        res.json({ version: stdout.trim() });
    });
});

// GET /logs - Admin only, paginated
router.get('/logs', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { limit = 50, offset = 0 } = req.query;
        const { LoginLog } = require('../models');

        const logs = await LoginLog.findAll({
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const total = await LoginLog.count();

        res.json({ logs, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /legal - Update legal texts (Admin only)
router.post('/legal', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { key, value } = req.body;
        // Allowed keys
        const allowed = ['legal_privacy', 'legal_imprint', 'legal_terms'];
        if (!allowed.includes(key)) return res.status(400).json({ error: 'Invalid legal text key' });

        const [setting] = await Settings.findOrCreate({
            where: { key, UserId: req.user.id }, // Bind to admin user or make global? 
            // Better: Bind to admin user who is editing it, OR make it global (UserId null).
            // Current Settings model enforces UserId. Let's use the admin's UserId.
            defaults: { value }
        });

        await setting.update({ value });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /legal/:type - Public endpoint for legal texts
router.get('/legal/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const allowed = ['legal_privacy', 'legal_imprint', 'legal_terms'];
        // Map param to key
        const keyMap = {
            'privacy': 'legal_privacy',
            'imprint': 'legal_imprint',
            'terms': 'legal_terms'
        };

        const dbKey = keyMap[type];
        if (!dbKey) return res.status(400).json({ error: 'Invalid type' });

        // Fetch from ANY admin user (assuming single tenant or main admin)
        // For simplicity, we fetch the most recently updated one or from the first admin found.
        // Actually, let's just find one.
        const setting = await Settings.findOne({
            where: { key: dbKey }
        });

        res.json({ value: setting ? setting.value : '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /email - Get email configuration (admin only)
router.get('/email', auth, async (req, res) => {
    console.log('[GET /email] Request received, user:', req.user?.id, 'role:', req.user?.role);
    if (req.user.role !== 'admin') {
        console.log('[GET /email] Access denied - not admin');
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const fields = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_from', 'smtp_sender_name', 'smtp_secure', 'imap_host', 'imap_port', 'imap_user', 'imap_secure'];
        const settings = {};

        for (const field of fields) {
            const setting = await Settings.findOne({ where: { key: field, UserId: req.user.id } });
            const camelKey = field.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
            settings[camelKey] = setting ? setting.value : '';
        }

        // Convert booleans
        settings.smtpSecure = settings.smtpSecure === 'true';
        settings.imapSecure = settings.imapSecure === 'true';

        console.log('[GET /email] Returning settings:', settings);
        // Never send password back
        res.json(settings);
    } catch (err) {
        console.error('[GET /email] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /email - Save email configuration (admin only)
router.post('/email', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom, smtpSenderName, smtpSecure, imapHost, imapPort, imapUser, imapPassword, imapSecure } = req.body;

        const fieldMap = {
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_user: smtpUser,
            smtp_from: smtpFrom,
            smtp_sender_name: smtpSenderName,
            smtp_secure: smtpSecure ? 'true' : 'false',
            imap_host: imapHost,
            imap_port: imapPort,
            imap_user: imapUser,
            imap_secure: imapSecure ? 'true' : 'false'
        };

        // Only save passwords if provided
        if (smtpPassword && smtpPassword.trim() !== '') {
            fieldMap.smtp_password = smtpPassword;
        }
        if (imapPassword && imapPassword.trim() !== '') {
            fieldMap.imap_password = imapPassword;
        }

        for (const [key, value] of Object.entries(fieldMap)) {
            const [setting] = await Settings.findOrCreate({
                where: { key, UserId: req.user.id },
                defaults: { value, UserId: req.user.id }
            });
            await setting.update({ value });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /email/test - Send test email (admin only)
router.post('/email/test', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { User } = require('../models');
        const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom, smtpSecure } = req.body;

        // Get admin email
        const admin = await User.findByPk(req.user.id);
        const recipientEmail = admin?.email || smtpFrom;
        if (!recipientEmail) {
            return res.status(400).json({ error: 'Keine Empfänger-E-Mail gefunden. Bitte hinterlege eine E-Mail in deinem Profil.' });
        }

        // Get stored password if not provided
        let password = smtpPassword;
        if (!password || password.trim() === '') {
            const storedPwd = await Settings.findOne({ where: { key: 'smtp_password', UserId: req.user.id } });
            password = storedPwd ? storedPwd.value : '';
        }

        if (!password) {
            return res.status(400).json({ error: 'SMTP Passwort nicht konfiguriert' });
        }

        // Create transporter
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: password
            }
        });

        // Send test email
        const fromAddress = req.body.smtpSenderName ? `"${req.body.smtpSenderName}" <${smtpFrom}>` : smtpFrom;
        await transporter.sendMail({
            from: fromAddress,
            to: recipientEmail,
            subject: 'Testmail von GabelGuru',
            text: 'Dies ist eine Testmail zur Überprüfung Ihrer E-Mail-Konfiguration.',
            html: '<p>Dies ist eine Testmail zur Überprüfung Ihrer E-Mail-Konfiguration.</p><p>Wenn Sie diese Nachricht erhalten, funktioniert die E-Mail-Konfiguration korrekt.</p>'
        });

        res.json({ message: 'Testmail erfolgreich an ' + recipientEmail + ' gesendet!' });
    } catch (err) {
        console.error('Email test error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get a setting by key
router.get('/:key', auth, async (req, res) => {
    try {
        const setting = await Settings.findOne({ where: { key: req.params.key, UserId: req.user.effectiveId } });
        res.json({ value: setting ? setting.value : '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save a setting
router.post('/', auth, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'Key is required' });

        const [setting, created] = await Settings.findOrCreate({
            where: { key, UserId: req.user.effectiveId },
            defaults: { value, UserId: req.user.effectiveId }
        });

        if (!created) {
            await setting.update({ value });
        }

        res.json(setting);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
