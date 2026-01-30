const express = require('express');
const router = express.Router();
const { List, ListItem, Product } = require('../models');
const { auth } = require('../middleware/auth');

// Get all lists
router.get('/', auth, async (req, res) => {
    try {
        const lists = await List.findAll({ order: [['date', 'DESC']] });
        res.json(lists);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new list
router.post('/', auth, async (req, res) => {
    try {
        const list = await List.create(req.body);
        res.status(201).json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get list details
router.get('/:id', auth, async (req, res) => {
    try {
        const list = await List.findByPk(req.params.id, {
            include: [{ model: ListItem, include: [Product] }]
        });
        if (!list) return res.status(404).json({ error: 'List not found' });
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
