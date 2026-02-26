const express = require('express');
const router = express.Router();
const { Intolerance, User, sequelize } = require('../models');
const { Op } = require('sequelize');
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

// PERSONAL PRODUCT INTOLERANCES

// GET /intolerances/personal-products - Get products current user is intolerant to
router.get('/personal-products', auth, async (req, res) => {
    try {
        const userId = req.user.effectiveId;
        const { Product } = require('../models');
        const user = await User.findByPk(userId, {
            include: [{
                model: Product,
                as: 'IntolerantProducts',
                through: { attributes: [] }
            }]
        });

        res.json(user?.IntolerantProducts || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /intolerances/personal-products - Add a product to intolerance list
router.post('/personal-products', auth, async (req, res) => {
    try {
        const userId = req.user.effectiveId;
        const { productId } = req.body;
        const { Product } = require('../models');

        if (!productId) return res.status(400).json({ error: 'ProductId required' });

        const user = await User.findByPk(userId);
        const product = await Product.findByPk(productId);

        if (!product) return res.status(404).json({ error: 'Product not found' });

        await user.addIntolerantProduct(product);
        res.status(201).json({ message: 'Added to personal intolerances' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /intolerances/personal-products/:productId - Remove a product from personal intolerances
router.delete('/personal-products/:productId', auth, async (req, res) => {
    try {
        const userId = req.user.effectiveId;
        const { productId } = req.params;
        const { Product } = require('../models');

        const user = await User.findByPk(userId);
        const product = await Product.findByPk(productId);

        if (!product) return res.status(404).json({ error: 'Product not found' });

        await user.removeIntolerantProduct(product);
        res.json({ message: 'Removed from personal intolerances' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /intolerances/check - Check a list of products against household intolerances
router.post('/check', auth, async (req, res) => {
    try {
        const { productIds } = req.body;
        if (!productIds || !Array.isArray(productIds)) {
            return res.status(400).json({ error: 'productIds array required' });
        }

        const userId = req.user.effectiveId;
        const currentUser = await User.findByPk(userId);

        // Find all household members
        const householdMembers = await User.findAll({
            where: {
                [Op.or]: [ // Changed from sequelize.Sequelize.Op.or to Op.or
                    { id: currentUser.householdId || userId }, // The owner/householdId itself
                    { householdId: currentUser.householdId || userId } // Everyone else
                ]
            },
            attributes: ['id', 'username']
        });

        const { Product, Intolerance } = require('../models');

        // Fetch products with their global intolerances
        const products = await Product.findAll({
            where: { id: productIds },
            include: [{ model: Intolerance, through: { attributes: [] } }]
        });

        const conflicts = [];

        for (const user of householdMembers) {
            // Get user's global intolerances and personal exclusions
            const userWithData = await User.findByPk(user.id, {
                include: [
                    { model: Intolerance, through: { attributes: [] } },
                    { model: Product, as: 'IntolerantProducts', through: { attributes: [] } }
                ]
            });

            const userGlobalIntoleranceIds = new Set(userWithData.Intolerances.map(i => i.id));
            const userPersonalExclusionIds = new Set(userWithData.IntolerantProducts.map(p => p.id));

            for (const product of products) {
                const productConflicts = [];

                // 1. Check Personal Exclusions
                if (userPersonalExclusionIds.has(product.id)) {
                    productConflicts.push({
                        type: 'personal',
                        message: `Persönlicher Ausschluss`
                    });
                }

                // 2. Check Global Allergens
                for (const productIntol of product.Intolerances) {
                    if (userGlobalIntoleranceIds.has(productIntol.id)) {
                        productConflicts.push({
                            type: 'global',
                            intoleranceId: productIntol.id,
                            intoleranceName: productIntol.name,
                            warningText: productIntol.warningText,
                            message: productIntol.warningText || productIntol.name
                        });
                    }
                }

                if (productConflicts.length > 0) {
                    conflicts.push({
                        productId: product.id,
                        productName: product.name,
                        userId: user.id,
                        username: user.username,
                        warnings: productConflicts
                    });
                }
            }
        }

        res.json(conflicts);
    } catch (err) {
        console.error('Intolerance check error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
