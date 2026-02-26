const express = require('express');
const router = express.Router();
const { ProductVariant } = require('../models');
const { auth } = require('../middleware/auth');

// Get all variants
router.get('/', auth, async (req, res) => {
    try {
        const variants = await ProductVariant.findAll({
            where: { UserId: req.user.effectiveId },
            order: [['title', 'ASC']]
        });
        res.json(variants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create variant
router.post('/', auth, async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const variant = await ProductVariant.create({
            title,
            UserId: req.user.effectiveId
        });
        res.status(201).json(variant);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update variant
router.put('/:id', auth, async (req, res) => {
    try {
        const { title } = req.body;
        const variant = await ProductVariant.findOne({
            where: { id: req.params.id, UserId: req.user.effectiveId }
        });

        if (!variant) return res.status(404).json({ error: 'Variant not found' });

        await variant.update({ title });
        res.json(variant);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete variant
router.delete('/:id', auth, async (req, res) => {
    try {
        const variant = await ProductVariant.findOne({
            where: { id: req.params.id, UserId: req.user.effectiveId }
        });

        if (!variant) return res.status(404).json({ error: 'Variant not found' });

        await variant.destroy();
        res.json({ message: 'Variant deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
