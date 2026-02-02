const express = require('express');
const router = express.Router();
const { User } = require('../models');
const verifyToken = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

// Apply auth and admin check to all routes
router.use(verifyToken);
router.use(isAdmin);

// GET / - List all users
router.get('/', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'role', 'isLdap', 'createdAt']
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/role - Update user role
router.put('/:id/role', async (req, res) => {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Prevent deleting/demoting the last admin (optional safety, or self-demotion check)
        // For now, simple update
        user.role = role;
        await user.save();

        res.json({ message: 'User role updated', user });
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
