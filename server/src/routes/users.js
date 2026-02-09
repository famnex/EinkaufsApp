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

        // Alexa Key from Settings
        const alexaSetting = await Settings.findOne({
            where: { key: 'alexa_key', UserId: user.id }
        });

        res.json({
            user,
            householdMembers,
            creditHistory,
            alexaKey: alexaSetting ? alexaSetting.value : null
        });
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

module.exports = router;
