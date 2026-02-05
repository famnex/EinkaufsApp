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

// Menu Query Endpoint
router.post('/menu', checkAlexaAuth, async (req, res) => {
    try {
        const { tag, art } = req.body;
        logAlexa('INFO', 'REQUEST_MENU', 'Received Menu Request', { tag, art });

        if (!tag) {
            return res.status(400).json({ error: 'Missing tag' });
        }

        // 1. Resolve Date
        let dateQuery;
        const now = new Date();
        // Remove time part to avoid TZ issues, working with local dates conceptually
        // Assuming server local time is relevant or simple UTC date string

        if (tag.toLowerCase() === 'heute') {
            dateQuery = now.toISOString().split('T')[0];
        } else if (tag.toLowerCase() === 'morgen') {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateQuery = tomorrow.toISOString().split('T')[0];
        } else {
            // Try parse YYYY-MM-DD
            // If regex matches YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(tag)) {
                dateQuery = tag;
            } else {
                // Fallback attempt or error
                logAlexa('WARN', 'EXECUTION', `Invalid date format: ${tag}`);
                // return res.json({ text: "Das Datum habe ich nicht verstanden." });
                // Better: try to be lenient or fail?
                // Let's assume validation failure 
                return res.status(400).json({ error: 'Invalid date format' });
            }
        }

        // 2. Resolve Meal Type
        // 2. Resolve Meal Type
        const map = {
            'frühstück': 'breakfast',
            'mittag': 'lunch',
            'mittagessen': 'lunch',
            'abend': 'dinner',
            'abendbrot': 'dinner',
            'abendessen': 'dinner',
            'snack': 'snack'
        };

        const mealType = art ? map[art.toLowerCase()] : null;

        // If art is provided but unknown, we treat it as "unspecified/all" effectively, 
        // OR we could stick to the original logic of erroring. 
        // User request: "wenn die 'art' nicht erkannt wird ... dann soll der komplette tag wiedergegeben werden"
        // So if mealType is null (either no art provided OR art not in map), we fetch the whole day.

        const { Menu, Recipe } = require('../models');

        if (mealType) {
            // --- Specific Meal Query (Existing Logic) ---
            const menuEntry = await Menu.findOne({
                where: {
                    date: dateQuery,
                    meal_type: mealType
                },
                include: [Recipe]
            });

            if (!menuEntry) {
                const dateStr = tag.toLowerCase() === 'heute' ? 'heute' : (tag.toLowerCase() === 'morgen' ? 'morgen' : `am ${tag}`);
                // Capitalize first letter for output
                const artDisplay = art ? art.replace(/^\w/, c => c.toUpperCase()) : 'dieser Mahlzeit';
                return res.json({
                    text: `Für ${dateStr} ist zum ${artDisplay} nichts geplant.`
                });
            }

            let dishName = '';
            if (menuEntry.Recipe) {
                dishName = menuEntry.Recipe.title;
            } else if (menuEntry.description) {
                dishName = menuEntry.description;
            } else {
                dishName = "etwas ohne Namen";
            }

            const responseText = `Es gibt ${dishName}.`;
            logAlexa('INFO', 'RESPONSE', `Menu answer: ${responseText}`, { date: dateQuery, type: mealType });
            return res.json({ text: responseText, card: dishName });

        } else {
            // --- Full Day Query (New Logic) ---
            const menuEntries = await Menu.findAll({
                where: {
                    date: dateQuery
                },
                include: [Recipe],
                order: [['meal_type', 'ASC']] // Sort might not be semantic, we'll map manually
            });

            const dateStr = tag.toLowerCase() === 'heute' ? 'Heute' : (tag.toLowerCase() === 'morgen' ? 'Morgen' : `Am ${tag}`);

            if (menuEntries.length === 0) {
                return res.json({
                    text: `${dateStr} ist nichts geplant.`
                });
            }

            // Helper to get nice text for a meal type
            const getGermanMealName = (type) => {
                switch (type) {
                    case 'breakfast': return 'Frühstück';
                    case 'lunch': return 'Mittagessen';
                    case 'dinner': return 'Abendessen';
                    case 'snack': return 'Snack';
                    default: return type;
                }
            };

            // Build list of parts: "Schnitzel zum Abendessen", "Chips als Snack"
            const parts = [];

            // Define order of meals for natural flow
            const order = ['breakfast', 'lunch', 'dinner', 'snack'];

            // Group entries by type (just in case multiple entries per type, though usually 1)
            // But model seems to allow multiple? usually 1 per type/date.

            for (const type of order) {
                const entry = menuEntries.find(e => e.meal_type === type);
                if (entry) {
                    let dishName = '';
                    if (entry.Recipe) {
                        dishName = entry.Recipe.title;
                    } else if (entry.description) {
                        dishName = entry.description;
                    } else {
                        continue; // Skip valid entries with no name? or say "etwas"
                    }

                    const mealName = getGermanMealName(type);
                    const preposition = type === 'snack' ? 'als' : 'zum'; // "als Snack", "zum Mittagessen"

                    parts.push(`${dishName} ${preposition} ${mealName}`);
                }
            }

            if (parts.length === 0) {
                return res.json({
                    text: `${dateStr} ist nichts geplant.`
                });
            }

            let summary = '';
            if (parts.length === 1) {
                summary = `${dateStr} gibt es ${parts[0]}.`;
            } else if (parts.length === 2) {
                summary = `${dateStr} gibt es ${parts[0]} und ${parts[1]}.`;
            } else {
                // Join all but last with commas
                const last = parts.pop();
                summary = `${dateStr} gibt es ${parts.join(', ')} und ${last}.`;
            }

            logAlexa('INFO', 'RESPONSE', `Full day answer: ${summary}`, { date: dateQuery });
            return res.json({ text: summary, card: 'Tagesübersicht' });
        }

    } catch (err) {
        logAlexa('ERROR', 'EXECUTION', 'Menu query failed', { error: err.message });
        console.error('[Alexa Menu Error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
