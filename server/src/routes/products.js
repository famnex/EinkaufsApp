const express = require('express');
const router = express.Router();
const { Product, Manufacturer, Store, ListItem, RecipeIngredient, sequelize, HiddenCleanup } = require('../models');
const { auth, admin } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    try {
        const products = await Product.findAll({
            where: { UserId: req.user.effectiveId },
            include: [
                { model: Manufacturer, where: { UserId: req.user.effectiveId }, required: false },
                { model: Store, where: { UserId: req.user.effectiveId }, required: false },
                { model: HiddenCleanup, where: { UserId: req.user.effectiveId }, required: false }
            ],
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
                UserId: req.user.effectiveId,
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
        const product = await Product.create({ ...req.body, UserId: req.user.effectiveId });
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findOne({ where: { id: req.params.id, UserId: req.user.effectiveId } });
        if (!product) return res.status(404).json({ error: 'Product not found or unauthorized' });
        await product.update(req.body);
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findOne({ where: { id: req.params.id, UserId: req.user.effectiveId } });
        if (!product) return res.status(404).json({ error: 'Product not found or unauthorized' });
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

        const source = await Product.findOne({ where: { id: sourceId, UserId: req.user.effectiveId }, transaction: t });
        const target = await Product.findOne({ where: { id: targetId, UserId: req.user.effectiveId }, transaction: t });

        if (!source || !target) {
            await t.rollback();
            return res.status(404).json({ error: 'Product not found or unauthorized' });
        }

        // 1. Update target name if provided
        if (newName && newName !== target.name) {
            await target.update({ name: newName }, { transaction: t });
        }

        // 1b. Merge Synonyms (Source Name + Source Synonyms -> Target Synonyms)
        // Parse synonyms safely (handle string/array mismatch if any)
        const parseSynonyms = (val) => {
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
                try { return JSON.parse(val || '[]'); } catch { return []; }
            }
            return [];
        };

        const targetSyns = new Set(parseSynonyms(target.synonyms));
        const sourceSyns = parseSynonyms(source.synonyms);

        // Add source name
        if (source.name && source.name !== target.name) {
            targetSyns.add(source.name);
        }
        // Add source synonyms
        sourceSyns.forEach(s => targetSyns.add(s));

        // Save updated synonyms
        await target.update({ synonyms: [...targetSyns] }, { transaction: t });

        // 2. Migrate Recipe Ingredients
        await RecipeIngredient.update(
            { ProductId: target.id },
            { where: { ProductId: source.id, UserId: req.user.effectiveId }, transaction: t }
        );

        // 3. Migrate Shopping List Items
        await ListItem.update(
            { ProductId: target.id },
            { where: { ProductId: source.id, UserId: req.user.effectiveId }, transaction: t }
        );

        // 4. Migrate Product Substitutions (both original and substitute references)
        const { ProductSubstitution } = require('../models');
        await ProductSubstitution.update(
            { originalProductId: target.id },
            { where: { originalProductId: source.id, UserId: req.user.effectiveId }, transaction: t }
        );
        await ProductSubstitution.update(
            { substituteProductId: target.id },
            { where: { substituteProductId: source.id, UserId: req.user.effectiveId }, transaction: t }
        );

        // 5. Delete Source
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
