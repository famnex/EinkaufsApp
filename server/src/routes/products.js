const express = require('express');
const router = express.Router();
const {
    Product, Store, ListItem, RecipeIngredient, sequelize, HiddenCleanup,
    ProductVariation, ProductVariant, Intolerance, ProductIntolerance,
    ProductSubstitution, RecipeSubstitution, ProductRelation, UserProductIntolerance,
    User, Recipe
} = require('../models');
const { auth, admin } = require('../middleware/auth');

// Get all user products (not global) - ADMIN ONLY
router.get('/inbox', auth, admin, async (req, res) => {
    try {
        const products = await Product.findAll({
            where: {
                UserId: { [sequelize.Sequelize.Op.ne]: null }
            },
            include: [
                { model: Intolerance, through: { attributes: ['probability'] } }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Globalize a specific product - ADMIN ONLY
router.post('/:id/globalize', auth, admin, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { variations, intoleranceIds, intolerances, ...productData } = req.body;
        const product = await Product.findByPk(req.params.id, { transaction: t });

        if (!product) {
            await t.rollback();
            return res.status(404).json({ error: 'Product not found' });
        }

        // Update with new data and set UserId to null
        await product.update({
            ...productData,
            UserId: null
        }, { transaction: t });

        // Handle variations
        if (variations && Array.isArray(variations)) {
            await ProductVariation.destroy({ where: { ProductId: product.id }, transaction: t });
            for (const v of variations) {
                await ProductVariation.create({
                    ...v,
                    ProductId: product.id,
                    UserId: null
                }, { transaction: t });
            }
        }

        // Handle intolerances
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

        // Create auto-exclusion for the AI Cleanup pipeline if not exists
        const existingHidden = await HiddenCleanup.findOne({
            where: { ProductId: product.id, context: 'pipeline', UserId: null },
            transaction: t
        });
        if (!existingHidden) {
            await HiddenCleanup.create({ 
                ProductId: product.id, 
                context: 'pipeline', 
                UserId: null // Global exclusion
            }, { transaction: t });
        }

        await t.commit();
        res.json({ message: 'Produkt erfolgreich globalisiert', product });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

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
                { 
                    model: HiddenCleanup, 
                    where: { 
                        [sequelize.Sequelize.Op.or]: [
                            { UserId: req.user.effectiveId },
                            { UserId: null }
                        ]
                    }, 
                    required: false 
                },
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
            await ProductVariation.destroy({ where: { ProductId: product.id, UserId: product.UserId }, transaction: t });
            for (const v of variations) {
                await ProductVariation.create({
                    ...v,
                    ProductId: product.id,
                    UserId: product.UserId
                }, { transaction: t });
            }
        } else if (variations === null) {
            // Null explicitly passed means delete all variations
            await ProductVariation.destroy({ where: { ProductId: product.id, UserId: product.UserId }, transaction: t });
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

        // Find products allowing global ones (UserId: null)
        const findOptions = (id) => ({
            where: {
                id,
                [sequelize.Sequelize.Op.or]: [
                    { UserId: req.user.effectiveId },
                    { UserId: null }
                ]
            },
            transaction: t
        });

        const source = await Product.findOne(findOptions(sourceId));
        const target = await Product.findOne(findOptions(targetId));

        if (!source || !target) {
            await t.rollback();
            return res.status(404).json({ error: 'Produkt nicht gefunden oder keine Berechtigung' });
        }

        const isAdmin = req.user.role === 'admin';
        const isSourceGlobal = source.UserId === null;
        const isTargetGlobal = target.UserId === null;

        // Restriction: Only admins can merge global products away (source)
        if (isSourceGlobal && !isAdmin) {
            await t.rollback();
            return res.status(403).json({ error: 'Nur Administratoren können globale Produkte als Quelle beim Zusammenführen verwenden' });
        }

        // Restriction: Only admins can merge into global products (target)
        if (isTargetGlobal && !isAdmin) {
            await t.rollback();
            return res.status(403).json({ error: 'Nur Administratoren können Produkte in globale Produkte umwandeln' });
        }

        // 1. Update target name and synonyms if permitted
        if (newName || (source.synonyms && source.synonyms.length > 0) || (source.name !== target.name)) {
            // Restriction: Only admins can change global target names/synonyms
            if (isTargetGlobal && !isAdmin) {
                // Non-admins can still merge THEIR data into it, but not change the global product itself
            } else {
                if (newName && newName !== target.name) {
                    await target.update({ name: newName }, { transaction: t });
                }

                const parseSynonyms = (val) => {
                    if (Array.isArray(val)) return val;
                    if (typeof val === 'string') {
                        try { return JSON.parse(val || '[]'); } catch { return []; }
                    }
                    return [];
                };

                const targetSyns = new Set(parseSynonyms(target.synonyms));
                const sourceSyns = parseSynonyms(source.synonyms);

                if (source.name && source.name !== target.name) {
                    targetSyns.add(source.name);
                }
                sourceSyns.forEach(s => targetSyns.add(s));

                await target.update({ synonyms: [...targetSyns] }, { transaction: t });
            }
        }

        // 2. Decide scope of migration
        // If source is global, we update for EVERYONE (admin only).
        // If source is private, we update ONLY for the current user/household.
        const refWhere = isSourceGlobal ? {} : { UserId: req.user.effectiveId };
        const mergeWhere = (field, id) => ({ ...refWhere, [field]: id });

        // 3. Migrate References
        // Recipe Ingredients
        await RecipeIngredient.update({ ProductId: target.id }, { where: mergeWhere('ProductId', source.id), transaction: t });

        // Shopping List Items
        await ListItem.update({ ProductId: target.id }, { where: mergeWhere('ProductId', source.id), transaction: t });

        // Product Substitutions (List based)
        await ProductSubstitution.update({ originalProductId: target.id }, { where: mergeWhere('originalProductId', source.id), transaction: t });
        await ProductSubstitution.update({ substituteProductId: target.id }, { where: mergeWhere('substituteProductId', source.id), transaction: t });

        // Recipe Substitutions (Persistent)
        await RecipeSubstitution.update({ originalProductId: target.id }, { where: mergeWhere('originalProductId', source.id), transaction: t });
        await RecipeSubstitution.update({ substituteProductId: target.id }, { where: mergeWhere('substituteProductId', source.id), transaction: t });

        // Variations (if user-owned, move them too)
        await ProductVariation.update({ ProductId: target.id }, { where: mergeWhere('ProductId', source.id), transaction: t });

        // Product Relations (Store order)
        await ProductRelation.update({ PredecessorId: target.id }, { where: mergeWhere('PredecessorId', source.id), transaction: t });
        await ProductRelation.update({ SuccessorId: target.id }, { where: mergeWhere('SuccessorId', source.id), transaction: t });

        // Personal Exclusions (UserProductIntolerance) - Ignore errors if target already excluded
        try {
            await UserProductIntolerance.update({ ProductId: target.id }, { where: mergeWhere('ProductId', source.id), transaction: t });
        } catch (e) { /* Likely unique constraint - skip */ }

        // 5. Delete Source
        await source.destroy({ transaction: t });

        // 6. Create auto-exclusion for AI Cleanup if target is global
        if (isTargetGlobal) {
            const existingHidden = await HiddenCleanup.findOne({
                where: { ProductId: target.id, context: 'pipeline', UserId: null },
                transaction: t
            });
            if (!existingHidden) {
                await HiddenCleanup.create({
                    ProductId: target.id,
                    context: 'pipeline',
                    UserId: null
                }, { transaction: t });
            }
        }

        await t.commit();
        res.json({ message: 'Zusammenführung erfolgreich', target });
    } catch (err) {
        if (t) await t.rollback();
        console.error('Merge Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get product usage in recipes
router.get('/:id/usage', auth, async (req, res) => {
    try {
        const targetProduct = await Product.findByPk(req.params.id);
        if (!targetProduct) return res.status(404).json({ error: 'Produkt nicht gefunden' });

        const usage = await RecipeIngredient.findAll({
            where: {
                ProductId: req.params.id,
                UserId: targetProduct.UserId || req.user.effectiveId
            },
            include: [{
                model: Recipe,
                attributes: ['id', 'title'],
                include: [{ 
                    model: User, 
                    attributes: ['username'] 
                }]
            }],
            attributes: ['originalName']
        });

        // Format: { usageCount: X, recipes: [{ id, title, owner, as: 'Original Name' }] }
        const recipes = usage.map(u => ({
            id: u.Recipe?.id,
            title: u.Recipe?.title,
            owner: u.Recipe?.User?.username,
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
