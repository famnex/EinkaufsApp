const express = require('express');
const router = express.Router();
const newsletterService = require('../services/newsletterService');
const { Newsletter, NewsletterRecipient, User, Email } = require('../models');
const { auth } = require('../middleware/auth');
const { logError } = require('../utils/logger');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for mail image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../public/uploads/mail');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'mail-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nur Administratoren haben Zugriff.' });
    }
    next();
};

/**
 * Public Unsubscribe Endpoint (Frontend calls this)
 */
router.post('/unsubscribe', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Ungültiger Token.' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gabelguru-secret');
        if (decoded.action !== 'unsubscribe') {
            return res.status(400).json({ error: 'Ungültige Aktion.' });
        }

        const user = await User.findByPk(decoded.id);
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

        user.newsletterSignedUp = false;
        await user.save();

        res.json({ success: true, message: 'Erfolgreich abgemeldet.' });
    } catch (err) {
        console.error('[Newsletter] Unsubscribe Error:', err.message);
        res.status(400).json({ error: 'Der Link ist ungültig oder abgelaufen.' });
    }
});

/**
 * Upload an image for the editor
 */
router.post('/upload-image', auth, adminOnly, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
        }

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const basePath = process.env.BASE_PATH || '';

        // Construct the full URL to the uploaded image
        const imageUrl = `${protocol}://${host}${basePath}/uploads/mail/${req.file.filename}`;

        res.json({ url: imageUrl });
    } catch (error) {
        console.error('[Newsletter] Image Upload Error:', error);
        res.status(500).json({ error: 'Fehler beim Hochladen des Bildes.' });
    }
});

/**
 * Get all newsletters (for the Newsletter folder view)
 */
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const { Op } = require('sequelize');

        // Nur Newsletter zurückgeben, deren entsprechendes Email-Objekt sich noch im "newsletter" Ordner befindet
        const emails = await Email.findAll({
            where: {
                folder: 'newsletter',
                messageId: { [Op.like]: 'newsletter-%' },
                UserId: null
            },
            attributes: ['messageId']
        });

        // Extrahiere die Newsletter IDs aus den messageIds
        const validIds = emails
            .map(e => parseInt(e.messageId.replace('newsletter-', ''), 10))
            .filter(id => !isNaN(id));

        const newsletters = await Newsletter.findAll({
            where: { id: { [Op.in]: validIds } },
            order: [['createdAt', 'DESC']]
        });
        res.json(newsletters);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get current recipient count for newsletter
 */
router.get('/recipient-count', auth, adminOnly, async (req, res) => {
    try {
        const count = await User.count({ where: { newsletterSignedUp: true } });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Queue a new newsletter
 */
router.post('/send', auth, adminOnly, async (req, res) => {
    try {
        const { subject, body, batchSize, waitMinutes, footer } = req.body;

        if (!subject || !body) {
            return res.status(400).json({ error: 'Betreff und Inhalt sind erforderlich.' });
        }

        const newsletter = await newsletterService.queueNewsletter({
            subject,
            body,
            batchSize: parseInt(batchSize) || 50,
            waitMinutes: parseInt(waitMinutes) || 5,
            footer
        });

        // Start sending immediately
        await newsletterService.startSending(newsletter.id);

        res.json({ message: 'Newsletter wurde in die Warteschlange gestellt.', newsletter });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get details of a specific newsletter (including progress)
 */
router.get('/:id', auth, adminOnly, async (req, res) => {
    try {
        const newsletter = await Newsletter.findByPk(req.params.id);
        if (!newsletter) return res.status(404).json({ error: 'Newsletter nicht gefunden.' });
        res.json(newsletter);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Resume a newsletter
 */
router.post('/:id/resume', auth, adminOnly, async (req, res) => {
    try {
        const newsletter = await newsletterService.startSending(req.params.id);
        res.json({ message: 'Versand fortgesetzt.', newsletter });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete a newsletter
 */
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const newsletter = await Newsletter.findByPk(req.params.id);
        if (!newsletter) return res.status(404).json({ error: 'Newsletter nicht gefunden.' });

        await NewsletterRecipient.destroy({ where: { NewsletterId: req.params.id } });
        await newsletter.destroy();

        res.json({ message: 'Newsletter gelöscht.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Bulk move newsletters to trash
 */
router.put('/bulk/trash', auth, adminOnly, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs erforderlich' });

        const { Op } = require('sequelize');
        const messageIds = ids.map(id => `newsletter-${id}`);

        await Email.update(
            { previousFolder: 'newsletter', folder: 'trash' },
            { where: { messageId: { [Op.in]: messageIds }, UserId: null } }
        );

        res.json({ success: true, message: 'In den Papierkorb verschoben.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Move a newsletter to trash
 */
router.put('/:id/trash', auth, adminOnly, async (req, res) => {
    try {
        const email = await Email.findOne({
            where: { messageId: `newsletter-${req.params.id}`, UserId: null }
        });
        if (email) {
            await email.update({ previousFolder: 'newsletter', folder: 'trash' });
        }
        res.json({ success: true, message: 'In den Papierkorb verschoben.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
