const express = require('express');
const router = express.Router();
const { Intolerance } = require('../models');
const { auth } = require('../middleware/auth');

// Get all intolerances for the user
router.get('/', auth, async (req, res) => {
    try {
        const intolerances = await Intolerance.findAll({
            where: { UserId: req.user.effectiveId },
            order: [['name', 'ASC']]
        });
        res.json(intolerances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new intolerance
router.post('/', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const intolerance = await Intolerance.create({
            name,
            UserId: req.user.effectiveId
        });
        res.status(201).json(intolerance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an intolerance
router.put('/:id', auth, async (req, res) => {
    try {
        const { name } = req.body;
        const intolerance = await Intolerance.findOne({
            where: { id: req.params.id, UserId: req.user.effectiveId }
        });

        if (!intolerance) return res.status(404).json({ error: 'Intolerance not found' });

        await intolerance.update({ name });
        res.json(intolerance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete an intolerance
router.delete('/:id', auth, async (req, res) => {
    try {
        const intolerance = await Intolerance.findOne({
            where: { id: req.params.id, UserId: req.user.effectiveId }
        });

        if (!intolerance) return res.status(404).json({ error: 'Intolerance not found' });

        await intolerance.destroy();
        res.json({ message: 'Intolerance deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
