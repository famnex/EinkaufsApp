const express = require('express');
const router = express.Router();
const { Manufacturer } = require('../models');
const { auth, admin } = require('../middleware/auth');

// Get all manufacturers
router.get('/', auth, async (req, res) => {
    try {
        const manufacturers = await Manufacturer.findAll({
            where: { UserId: req.user.id },
            order: [['name', 'ASC']]
        });
        res.json(manufacturers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new manufacturer (Admin)
router.post('/', auth, async (req, res) => {
    try {
        const manufacturer = await Manufacturer.create({ ...req.body, UserId: req.user.id });
        res.status(201).json(manufacturer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update manufacturer (Admin)
router.put('/:id', auth, async (req, res) => {
    try {
        const manufacturer = await Manufacturer.findOne({ where: { id: req.params.id, UserId: req.user.id } });
        if (!manufacturer) return res.status(404).json({ error: 'Manufacturer not found or unauthorized' });
        await manufacturer.update(req.body);
        res.json(manufacturer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete manufacturer (Admin)
router.delete('/:id', auth, async (req, res) => {
    try {
        const manufacturer = await Manufacturer.findOne({ where: { id: req.params.id, UserId: req.user.id } });
        if (!manufacturer) return res.status(404).json({ error: 'Manufacturer not found or unauthorized' });
        await manufacturer.destroy();
        res.json({ message: 'Manufacturer deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
