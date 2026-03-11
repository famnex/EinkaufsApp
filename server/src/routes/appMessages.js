const express = require('express');
const router = express.Router();
const { AppMessage, UserAppMessageRead, User } = require('../models');
const { auth } = require('../middleware/auth');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// GET /unread - Holt alle ungelesenen App-Nachrichten für den aktuellen Benutzer,
// die nach seiner Registrierung erstellt wurden.
router.get('/unread', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

        // Finde alle Nachrichten, die:
        // 1. Nach der Registrierung des Nutzers (user.createdAt) erstellt wurden.
        // 2. Noch nicht von diesem Nutzer gelesen wurden (kein Eintrag in UserAppMessageRead).
        const allMessages = await AppMessage.findAll({
            where: {
                createdAt: {
                    [Op.gt]: user.createdAt
                }
            },
            include: [{
                model: User,
                where: { id: user.id },
                required: false // LEFT OUTER JOIN
            }],
            order: [['createdAt', 'DESC']]
        });

        // Filter auf Nachrichten, bei denen der User (im require: false Join) nicht existiert -> Ungelesen
        const unreadMessages = allMessages.filter(msg => msg.Users.length === 0);

        // Gebe die Nachrichten so zurück, dass das Frontend die Struktur erwartet
        const formatted = unreadMessages.map(msg => ({
            id: msg.id,
            title: msg.title,
            text: msg.text,
            createdAt: msg.createdAt
        }));

        res.json(formatted);
    } catch (error) {
        logger.logError('Laden der ungelesenen App-Nachrichten fehlgeschlagen:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /:id/read - Markiert eine bestimmte Nachricht als gelesen durch den aktuellen Benutzer
router.post('/:id/read', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const message = await AppMessage.findByPk(id);
        
        if (!message) {
            return res.status(404).json({ error: 'App-Nachricht nicht gefunden' });
        }

        // Trage in die Verknüpfungstabelle ein
        await UserAppMessageRead.findOrCreate({
            where: {
                AppMessageId: id,
                UserId: req.user.id
            }
        });

        res.json({ success: true });
    } catch (error) {
        logger.logError('Markieren der App-Nachricht als gelesen fehlgeschlagen:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /history (Admin) - Holt den Verlauf aller gesendeten App-Nachrichten inkl. Metriken
router.get('/history', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const history = await AppMessage.findAll({
            order: [['createdAt', 'DESC']],
            include: [{
                model: User,
                attributes: ['id']
            }]
        });

        const formatted = history.map(msg => ({
            id: msg.id,
            title: msg.title,
            text: msg.text,
            createdAt: msg.createdAt,
            recipientCount: msg.recipientCount,
            readCount: msg.Users.length
        }));

        res.json(formatted);
    } catch (error) {
        logger.logError('App-Nachrichten-Verlauf konnte nicht geladen werden:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST / (Admin) - Erstellt und "sendet" eine neue App-Nachricht an alle Nutzer
router.post('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { title, text } = req.body;
        
        if (!title || !text || text.length < 5) {
            return res.status(400).json({ error: 'Titel und ein Text (mind. 5 Zeichen) sind erforderlich.' });
        }

        // Ermittle die aktuelle Anzahl der registrierten Accounts
        const recipientCount = await User.count();

        const newMessage = await AppMessage.create({
            title,
            text,
            recipientCount
        });

        res.status(201).json({ success: true, message: newMessage });
    } catch (error) {
        logger.logError('Senden der App-Nachricht fehlgeschlagen:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /:id (Admin) - Löscht eine App-Nachricht
router.delete('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { id } = req.params;
        const message = await AppMessage.findByPk(id);

        if (!message) {
            return res.status(404).json({ error: 'App-Nachricht nicht gefunden' });
        }

        // The join table (UserAppMessageRead) entries should be cascade deleted 
        // depending on how the associations are set up, but Sequelize's default
        // behavior with belongsToMany might require explicit destruction or 
        // we just rely on DB constraints (or destroy it directly).
        // Since we didn't specify onDelete: 'CASCADE' explicitly in index.js,
        // let's manually clean up the join table just to be safe.
        await UserAppMessageRead.destroy({ where: { AppMessageId: id } });

        await message.destroy();

        res.json({ success: true });
    } catch (error) {
        logger.logError('Löschen der App-Nachricht fehlgeschlagen:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
