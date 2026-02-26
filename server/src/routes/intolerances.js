const express = require('express');
const router = express.Router();
const { Intolerance, User } = require('../models');
const { auth } = require('../middleware/auth');

// GET /intolerances - Get all global intolerances with "selected" status for the current user
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.effectiveId;
        const allIntolerances = await Intolerance.findAll({
            order: [['name', 'ASC']]
        });

        const user = await User.findByPk(userId, {
            include: [{ model: Intolerance, through: { attributes: [] } }]
        });

        const selectedIds = new Set((user?.Intolerances || []).map(i => i.id));

        const result = allIntolerances.map(intol => ({
            id: intol.id,
            name: intol.name,
            warningText: intol.warningText,
            selected: selectedIds.has(intol.id)
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /intolerances/:id/toggle - Toggle selection for current user
router.post('/:id/toggle', auth, async (req, res) => {
    try {
        const userId = req.user.effectiveId;
        const intoleranceId = req.params.id;

        const user = await User.findByPk(userId);
        const intolerance = await Intolerance.findByPk(intoleranceId);

        if (!intolerance) return res.status(404).json({ error: 'Intolerance not found' });

        if (await user.hasIntolerance(intolerance)) {
            await user.removeIntolerance(intolerance);
            res.json({ selected: false });
        } else {
            await user.addIntolerance(intolerance);
            res.json({ selected: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN ROUTES

// POST /intolerances - Create new global intolerance (Admin only)
router.post('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { name, warningText } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });

        const intol = await Intolerance.create({ name, warningText });
        res.status(201).json(intol);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /intolerances/:id - Update (Admin only)
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { name, warningText } = req.body;
        const intol = await Intolerance.findByPk(req.params.id);
        if (!intol) return res.status(404).json({ error: 'Not found' });

        await intol.update({ name, warningText });
        res.json(intol);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /intolerances/:id - Delete global (Admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const intol = await Intolerance.findByPk(req.params.id);
        if (!intol) return res.status(404).json({ error: 'Not found' });

        await intol.destroy();
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
