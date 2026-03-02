const express = require('express');
const router = express.Router();
const { Product, Store, ListItem, RecipeIngredient, sequelize, HiddenCleanup, ProductVariation, ProductVariant, Intolerance, ProductIntolerance } = require('../models');
const { auth, admin } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    try {
        const { search, limit } = req.query;
        let where = {
            [sequelize.Sequelize.Op.and]: [
                {
                    [sequelize.Sequelize.Op.or]: [
                        { UserId: req.user.effectiveId },
                        { UserId: null }
                    ]
                }
            ]
        };

        if (search) {
            where[sequelize.Sequelize.Op.and].push({
                [sequelize.Sequelize.Op.or]: [
                    { name: { [sequelize.Sequelize.Op.like]: `%${search}%` } },
                    { category: { [sequelize.Sequelize.Op.like]: `%${search}%` } }
                ]
            });
        }

        const products = await Product.findAll({
            where,
            include: [
                { model: Store, where: { UserId: req.user.effectiveId }, required: false },
                { model: HiddenCleanup, where: { UserId: req.user.effectiveId }, required: false },
                {
                    model: ProductVariation,
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            { UserId: req.user.effectiveId },
                            { UserId: null }
                        ]
                    },
                    required: false,
                    include: [{ model: ProductVariant }]
                },
                { model: Intolerance, through: { attributes: ['probability'] } }
            ],
            order: [[sequelize.fn('lower', sequelize.col('Product.name')), 'ASC']],
            limit: limit ? parseInt(limit) : undefined
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
                [sequelize.Sequelize.Op.or]: [
                    { UserId: req.user.effectiveId },
                    { UserId: null }
                ],
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
    const t = await sequelize.transaction();
    try {
        const { variations, intoleranceIds, intolerances, ...productData } = req.body;
        const product = await Product.create({ ...productData, UserId: req.user.effectiveId }, { transaction: t });

        if (variations && Array.isArray(variations)) {
            for (const v of variations) {
                await ProductVariation.create({
                    ...v,
                    ProductId: product.id,
                    UserId: product.UserId
                }, { transaction: t });
            }
        }

        if (intolerances && Array.isArray(intolerances)) {
            for (const i of intolerances) {
                await ProductIntolerance.create({
                    ProductId: product.id,
                    IntoleranceId: i.id,
                    probability: i.probability
                }, { transaction: t });
            }
        } else if (intoleranceIds && Array.isArray(intoleranceIds)) {
            await product.setIntolerances(intoleranceIds, { transaction: t });
        }

        await t.commit();
        res.status(201).json(product);
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { variations, intoleranceIds, intolerances, ...productData } = req.body;
        const product = await Product.findOne({
            where: {
                id: req.params.id,
                [sequelize.Sequelize.Op.or]: [
                    { UserId: req.user.effectiveId },
                    { UserId: null }
                ]
            }
        });

        if (!product) {
            await t.rollback();
            return res.status(404).json({ error: 'Product not found or unauthorized' });
        }

        // Permission check: if global (UserId null), only admin can edit
        if (product.UserId === null && req.user.role !== 'admin') {
            await t.rollback();
            return res.status(403).json({ error: 'Nur Administratoren können globale Produkte bearbeiten' });
        }

        await product.update(productData, { transaction: t });

        if (variations && Array.isArray(variations)) {
            // Simple sync: delete existing and recreat (can be optimized but safe for small lists)
            await ProductVariation.destroy({ where: { ProductId: product.id, UserId: req.user.effectiveId }, transaction: t });
            for (const v of variations) {
                await ProductVariation.create({
                    ...v,
                    ProductId: product.id,
                    UserId: product.UserId
                }, { transaction: t });
            }
        } else if (variations === null) {
            // Null explicitly passed means delete all variations
            await ProductVariation.destroy({ where: { ProductId: product.id, UserId: req.user.effectiveId }, transaction: t });
        }

        if (intolerances && Array.isArray(intolerances)) {
            await ProductIntolerance.destroy({ where: { ProductId: product.id }, transaction: t });
            for (const i of intolerances) {
                await ProductIntolerance.create({
                    ProductId: product.id,
                    IntoleranceId: i.id,
                    probability: i.probability !== undefined ? i.probability : 100
                }, { transaction: t });
            }
        } else if (intoleranceIds !== undefined) {
            await product.setIntolerances(intoleranceIds || [], { transaction: t });
        }

        await t.commit();
        res.json(product);
    } catch (err) {
        await t.rollback();
        console.error('PUT Product Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findOne({
            where: {
                id: req.params.id,
                [sequelize.Sequelize.Op.or]: [
                    { UserId: req.user.effectiveId },
                    { UserId: null }
                ]
            }
        });

        if (!product) return res.status(404).json({ error: 'Product not found or unauthorized' });

        // Permission check: if global (UserId null), only admin can delete
        if (product.UserId === null && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nur Administratoren können globale Produkte löschen' });
        }
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

// Get product usage in recipes
router.get('/:id/usage', auth, async (req, res) => {
    try {
        const { Recipe, RecipeIngredient } = require('../models');

        const usage = await RecipeIngredient.findAll({
            where: {
                ProductId: req.params.id,
                UserId: req.user.effectiveId
            },
            include: [{
                model: Recipe,
                attributes: ['id', 'title']
            }],
            attributes: ['originalName'] // If we have this field (from AI imports)
        });

        // Format: { usageCount: X, recipes: [{ id, title, as: 'Original Name' }] }
        const recipes = usage.map(u => ({
            id: u.Recipe?.id,
            title: u.Recipe?.title,
            as: u.originalName
        })).filter(r => r.id);

        res.json({
            usageCount: recipes.length,
            recipes
        });
    } catch (err) {
        console.error('Product Usage Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin command: Globalize own products
router.post('/bulk-globalize', auth, admin, async (req, res) => {
    try {
        const userId = req.user.id;

        // Use transaction for safety
        await sequelize.transaction(async (t) => {
            // 1. Globalize products
            await Product.update(
                { UserId: null },
                { where: { UserId: userId }, transaction: t }
            );

            // 2. Globalize variations
            await ProductVariation.update(
                { UserId: null },
                { where: { UserId: userId }, transaction: t }
            );

            // 3. Optional: Globalize Store specific associations if needed
            // But usually User stores are distinct. 
        });

        res.json({ message: 'Alle Ihre Produkte wurden erfolgreich globalisiert.' });
    } catch (err) {
        console.error('Globalize Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
