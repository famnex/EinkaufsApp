const express = require('express');
const router = express.Router();
const { Product, Manufacturer, Store, ListItem, RecipeIngredient, sequelize, HiddenCleanup } = require('../models');
const { auth, admin } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    try {
        const products = await Product.findAll({
            include: [Manufacturer, Store, HiddenCleanup],
            order: [[sequelize.fn('lower', sequelize.col('Product.name')), 'ASC']]
        });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all unique units used in products
router.get('/units', auth, async (req, res) => {
    try {
        const products = await Product.findAll({
            attributes: ['unit'],
            where: {
                unit: { [sequelize.Sequelize.Op.ne]: null }
            }
        });

        // Extract unique units
        const units = [...new Set(products.map(p => p.unit).filter(u => u && u.trim()))];
        res.json(units.sort());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        await product.update(req.body);
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        await product.destroy();
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Merge Products
router.post('/merge', auth, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { sourceId, targetId, newName } = req.body;

        const source = await Product.findByPk(sourceId, { transaction: t });
        const target = await Product.findByPk(targetId, { transaction: t });

        if (!source || !target) {
            await t.rollback();
            return res.status(404).json({ error: 'Product not found' });
        }

        // 1. Update target name if provided
        if (newName && newName !== target.name) {
            await target.update({ name: newName }, { transaction: t });
        }

        // 2. Migrate Recipe Ingredients
        await RecipeIngredient.update(
            { ProductId: target.id },
            { where: { ProductId: source.id }, transaction: t }
        );

        // 3. Migrate Shopping List Items
        await ListItem.update(
            { ProductId: target.id },
            { where: { ProductId: source.id }, transaction: t }
        );

        // 4. Delete Source
        await source.destroy({ transaction: t });

        await t.commit();
        res.json({ message: 'Merge successful', target });
    } catch (err) {
        await t.rollback();
        console.error('Merge Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
