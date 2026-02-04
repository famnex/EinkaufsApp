const express = require('express');
const router = express.Router();
const { List, ListItem, Product, Settings, sequelize } = require('../models');
const { Op } = require('sequelize');

// Middleware to check Alexa Auth
const checkAlexaAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('[Alexa] Missing or invalid Auth Header');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const setting = await Settings.findOne({ where: { key: 'alexa_key' } });

        if (!setting || !setting.value || setting.value !== token) {
            console.warn('[Alexa] Invalid API Key attempt');
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    } catch (err) {
        console.error('[Alexa Auth Error]', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

router.post('/add', checkAlexaAuth, async (req, res) => {
    try {
        const { name, quantity, unit, mode, raw } = req.body;
        // Accept "menge" as well as "quantity" manually if needed, but spec said "menge" in body.
        // Let's support both to be safe or strictly follow spec.
        // Spec says: "menge" (number).

        const amount = req.body.menge !== undefined ? parseFloat(req.body.menge) : 1;
        const productNameQuery = name || raw || 'Unbekanntes Produkt';
        const unitName = req.body.einheit || null; // Can be null

        if (!productNameQuery) {
            return res.status(400).json({ error: 'Product name required' });
        }

        // 1. Find Target List
        const today = new Date().toISOString().split('T')[0];

        const lists = await List.findAll({
            where: {
                date: { [Op.gte]: today },
                status: 'active'
            },
            order: [['date', 'ASC']],
            limit: 2
        });

        let targetList;

        if (lists.length === 0) {
            // Create new list for today
            targetList = await List.create({
                date: today,
                status: 'active',
                name: 'Alexa Liste'
            });
            console.log('[Alexa] Created new list for', today);
        } else if (lists.length === 1) {
            // Only one list exists (today or future). Use it.
            targetList = lists[0];
            // If it's today's list, we use it. Even if spec says "next list", if there IS no next list, we must fallback.
        } else {
            // Two lists found. 
            // If first is today, take second.
            if (lists[0].date === today) {
                targetList = lists[1];
            } else {
                // Both are future? Take first future one.
                targetList = lists[0];
            }
        }

        console.log(`[Alexa] Adding "${productNameQuery}" to List ID ${targetList.id} (${targetList.date})`);

        // 2. Find or Create Product
        // Case-insensitive search
        let product = await Product.findOne({
            where: sequelize.where(
                sequelize.fn('lower', sequelize.col('name')),
                sequelize.fn('lower', productNameQuery)
            )
        });

        if (!product) {
            console.log(`[Alexa] Creating new product: "${productNameQuery}"`);
            product = await Product.create({
                name: productNameQuery, // Utilize proper casing from input if possible
                unit: unitName || 'Stück', // Default to Stück if unknown
                category: 'Uncategorized'
            });
        }

        // 3. Add to List
        const existingItem = await ListItem.findOne({
            where: {
                ListId: targetList.id,
                ProductId: product.id
            }
        });

        if (existingItem) {
            await existingItem.update({
                quantity: existingItem.quantity + amount
                // Keep existing unit to avoid confusion, or update? Usually keep.
            });
        } else {
            await ListItem.create({
                ListId: targetList.id,
                ProductId: product.id,
                quantity: amount,
                unit: unitName || product.unit, // Use input unit if given, else product default
                is_bought: false
            });
        }

        res.status(200).send('OK');

    } catch (err) {
        console.error('[Alexa Add Error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
