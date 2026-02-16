const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, CreditTransaction, Settings } = require('../models');
const { auth: verifyToken } = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

// Apply auth and admin check to all routes
router.use(verifyToken);
router.use(isAdmin);

// GET / - List all users with household relationship
router.get('/', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'role', 'isLdap', 'householdId', 'createdAt', 'tier', 'aiCredits']
        });

        // Enhance with household owner names
        const usersWithHouseholdInfo = await Promise.all(users.map(async (u) => {
            const userJson = u.toJSON();
            if (userJson.householdId) {
                const owner = await User.findByPk(userJson.householdId, { attributes: ['username'] });
                userJson.householdOwnerName = owner ? owner.username : 'Unbekannt';
            }
            return userJson;
        }));

        res.json(usersWithHouseholdInfo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/role - Update user role (Legacy, but kept for compatibility)
router.put('/:id/role', async (req, res) => {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.role = role;
        await user.save();

        res.json({ message: 'User role updated', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /:id/detail - Fetch all info for the admin modal tabs
router.get('/:id/detail', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        const { Op } = require('sequelize');
        const { ComplianceReport } = require('../models');

        // Household members: If user has a householdId, they are a member. If not, they are the owner (householdId is their own ID for members).
        const hId = user.householdId || user.id;
        const householdMembers = await User.findAll({
            where: {
                [Op.or]: [
                    { householdId: hId },
                    { id: hId }
                ]
            },
            attributes: ['id', 'username', 'email', 'role', 'householdId']
        });

        // Credit history (last 50)
        const creditHistory = await CreditTransaction.findAll({
            where: { UserId: user.id },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        // Strikes / Compliance Reports (where user is accused and report is resolved)
        const strikes = await ComplianceReport.findAll({
            where: {
                accusedUserId: user.id,
                status: 'resolved' // Strikes are only counted if resolved (punished)
            },
            order: [['updatedAt', 'DESC']]
        });

        // Alexa Key from Settings
        const alexaSetting = await Settings.findOne({
            where: { key: 'alexa_key', UserId: user.id }
        });

        res.json({
            user,
            householdMembers,
            creditHistory,
            strikes,
            alexaKey: alexaSetting ? alexaSetting.value : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /:id/strikes - Get strikes for a specific user (User or Admin)
router.get('/:id/strikes', async (req, res) => {
    try {
        // Access Check: Admin or Self
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { ComplianceReport } = require('../models');
        const strikes = await ComplianceReport.findAll({
            where: {
                accusedUserId: req.params.id,
                status: 'resolved'
            },
            attributes: ['id', 'reasonCategory', 'resolutionNote', 'updatedAt', 'contentUrl', 'contentType'],
            order: [['updatedAt', 'DESC']]
        });

        res.json(strikes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/detail - Admin update for basic user data, tier, and role
router.put('/:id/detail', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { username, email, password, role, tier, cookbookTitle, cookbookImage } = req.body;

        if (username) user.username = username;
        if (email) user.email = email;
        if (role) user.role = role;
        if (tier) user.tier = tier;
        if (cookbookTitle !== undefined) user.cookbookTitle = cookbookTitle;
        if (cookbookImage !== undefined) user.cookbookImage = cookbookImage;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();
        res.json({ message: 'User updated successfully', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/book-credits - Booking +/- credits for a user
router.post('/:id/book-credits', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { amount, description } = req.body;
        const delta = parseFloat(amount);

        if (isNaN(delta)) return res.status(400).json({ error: 'Invalid amount' });

        // Update user balance
        const currentBalance = parseFloat(user.aiCredits || 0);
        const newBalance = (currentBalance + delta);

        if (newBalance < 0) {
            return res.status(400).json({ error: 'Guthaben darf nicht unter 0 fallen' });
        }

        user.aiCredits = newBalance.toFixed(2);
        await user.save();

        // Create transaction record
        await CreditTransaction.create({
            UserId: user.id,
            delta: delta,
            description: description || (delta > 0 ? 'Gutschrift durch Admin' : 'Umbuchung durch Admin'),
            type: 'booking'
        });

        res.json({ message: 'Credits booked successfully', newBalance: user.aiCredits });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id - Delete user
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Prevent self-deletion if desired, but frontend usually handles UI
        if (user.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        await user.destroy();
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/ban - Ban a user
router.post('/:id/ban', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot ban yourself' });

        const { reason, days, permanent } = req.body;

        let expiresAt = null;
        if (!permanent && days) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(days));
        }

        await user.update({
            bannedAt: new Date(),
            banReason: reason || 'Kein Grund angegeben',
            banExpiresAt: expiresAt,
            isPermanentlyBanned: !!permanent
        });

        // Send Email
        const { sendEmail } = require('../services/messagingService');
        const durationText = permanent ? 'unbefristet' : `bis zum ${expiresAt.toLocaleDateString('de-DE')}`;
        const html = `
            <h3>Konto gesperrt</h3>
            <p>Hallo ${user.username},</p>
            <p>dein Konto wurde vorübergehend gesperrt.</p>
            <p><b>Dauer:</b> ${durationText}</p>
            <p><b>Grund:</b> ${reason || 'Verstoß gegen die Richtlinien'}</p>
            <br>
            <p>Falls du Fragen dazu hast, antworte bitte auf diese Email.</p>
        `;
        await sendEmail(user.email, 'Dein Konto wurde gesperrt', html);

        res.json({ message: 'User banned successfully', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/unban - Unban a user
router.post('/:id/unban', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await user.update({
            bannedAt: null,
            banReason: null,
            banExpiresAt: null,
            isPermanentlyBanned: false
        });

        // Send Email
        const { sendEmail } = require('../services/messagingService');
        const html = `
            <h3>Konto reaktiviert</h3>
            <p>Hallo ${user.username},</p>
            <p>dein Konto wurde soeben wieder freigeschaltet. Du kannst dich nun wieder wie gewohnt anmelden.</p>
            <br>
            <p>Viel Spaß weiterhin mit GabelGuru!</p>
        `;
        await sendEmail(user.email, 'Dein Konto wurde wieder freigeschaltet', html);

        res.json({ message: 'User unbanned successfully', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
