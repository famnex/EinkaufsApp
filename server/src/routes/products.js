const express = require('express');
const router = express.Router();
const { Product, Manufacturer, Store } = require('../models');
const { auth, admin } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    try {
        const products = await Product.findAll({ include: [Manufacturer, Store] });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', auth, admin, async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
