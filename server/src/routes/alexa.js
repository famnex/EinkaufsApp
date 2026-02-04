const express = require('express');
const router = express.Router();
const { List, ListItem, Product, Settings, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logAlexa } = require('../utils/logger'); // Import Logger

// Helper: Title Case (capitalize fitst letter of every word)
const toTitleCase = (str) => {
    if (!str) return str;
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

// Middleware to check Alexa Auth
const checkAlexaAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logAlexa('WARN', 'AUTH', 'Missing or invalid Auth Header');
            console.warn('[Alexa] Missing or invalid Auth Header');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const setting = await Settings.findOne({ where: { key: 'alexa_key' } });

        if (!setting || !setting.value || setting.value !== token) {
            logAlexa('WARN', 'AUTH', 'Invalid API Key attempt', { providedToken: token.substring(0, 5) + '...' });
            console.warn('[Alexa] Invalid API Key attempt');
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    } catch (err) {
        logAlexa('ERROR', 'AUTH', 'Internal Auth Error', { error: err.message });
        console.error('[Alexa Auth Error]', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

router.post('/add', checkAlexaAuth, async (req, res) => {
    try {
        const { name, quantity, unit, mode, raw } = req.body;

        logAlexa('INFO', 'REQUEST', 'Received Add Request', req.body);

        const amount = req.body.menge !== undefined ? parseFloat(req.body.menge) : 1;
        let productNameQuery = name || raw || 'Unbekanntes Produkt';
        let unitName = req.body.einheit || null;

        if (!productNameQuery) {
            logAlexa('WARN', 'REQUEST', 'Product name missing');
            return res.status(400).json({ error: 'Product name required' });
        }

        // Apply Title Case
        productNameQuery = toTitleCase(productNameQuery);
        if (unitName) unitName = toTitleCase(unitName);

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
            targetList = await List.create({
                date: today,
                status: 'active',
                name: 'Alexa Liste'
            });
            console.log('[Alexa] Created new list for', today);
        } else if (lists.length === 1) {
            targetList = lists[0];
        } else {
            if (lists[0].date === today) {
                targetList = lists[1];
            } else {
                targetList = lists[0];
            }
        }

        console.log(`[Alexa] Adding "${productNameQuery}" to List ID ${targetList.id} (${targetList.date})`);

        // 2. Find or Create Product
        let product = await Product.findOne({
            where: sequelize.where(
                sequelize.fn('lower', sequelize.col('name')),
                sequelize.fn('lower', productNameQuery)
            )
        });

        if (!product) {
            console.log(`[Alexa] Creating new product: "${productNameQuery}"`);
            product = await Product.create({
                name: productNameQuery,
                unit: unitName || 'Stück',
                category: 'Uncategorized'
            });
            logAlexa('INFO', 'PRODUCT_CREATED', `Created new product: ${productNameQuery}`, { id: product.id });
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
            });
            logAlexa('INFO', 'ITEM_UPDATED', `Updated item "${productNameQuery}" on list ${targetList.date}`, {
                listId: targetList.id,
                newQuantity: existingItem.quantity
            });
        } else {
            await ListItem.create({
                ListId: targetList.id,
                ProductId: product.id,
                quantity: amount,
                unit: unitName || product.unit,
                is_bought: false
            });
            logAlexa('INFO', 'ITEM_ADDED', `Added item "${productNameQuery}" to list ${targetList.date}`, {
                listId: targetList.id,
                quantity: amount
            });
        }

        res.status(200).send('OK');

    } catch (err) {
        logAlexa('ERROR', 'EXECUTION', 'Error processing request', { error: err.message });
        console.error('[Alexa Add Error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
