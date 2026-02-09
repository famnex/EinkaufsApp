const express = require('express');
const router = express.Router();
const { List, ListItem, Product, Settings, User, sequelize } = require('../models');
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
        const setting = await Settings.findOne({ where: { key: 'alexa_key', value: token } });

        if (!setting) {
            logAlexa('WARN', 'AUTH', 'Invalid API Key attempt', { providedToken: token.substring(0, 5) + '...' });
            console.warn('[Alexa] Invalid API Key attempt');
            return res.status(403).json({ error: 'Forbidden' });
        }

        const user = await User.findByPk(setting.UserId);
        if (!user) {
            logAlexa('WARN', 'AUTH', 'User associated with key not found');
            return res.status(401).json({ error: 'User not found' });
        }

        // Attach user info for subsequent queries
        req.user = user;
        req.user.effectiveId = user.householdId || user.id;

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
                status: 'active',
                UserId: req.user.effectiveId
            },
            order: [['date', 'ASC']],
            limit: 2
        });

        let targetList;

        if (lists.length === 0) {
            targetList = await List.create({
                date: today,
                status: 'active',
                name: 'Alexa Liste',
                UserId: req.user.effectiveId
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

        const { normalizeGermanProduct } = require('../utils/normalization');

        // ... (existing imports)

        // ... inside the route handler ...

        // 2. Find or Create Product (Robust Search)
        // Try exact match first
        let product = await Product.findOne({
            where: {
                [Op.and]: [
                    sequelize.where(
                        sequelize.fn('lower', sequelize.col('name')),
                        sequelize.fn('lower', productNameQuery)
                    ),
                    { UserId: req.user.effectiveId }
                ]
            }
        });

        // If not found, try normalized variations
        if (!product) {
            const variations = normalizeGermanProduct(productNameQuery);
            // Search for any matching variation
            for (const variant of variations) {
                const p = await Product.findOne({
                    where: {
                        [Op.and]: [
                            sequelize.where(
                                sequelize.fn('lower', sequelize.col('name')),
                                sequelize.fn('lower', variant)
                            ),
                            { UserId: req.user.effectiveId }
                        ]
                    }
                });
                if (p) {
                    product = p;
                    console.log(`[Alexa] Fuzzy match: "${productNameQuery}" -> "${p.name}"`);
                    break;
                }
            }
        }

        // 3. Try Synonyms (JSON search)
        if (!product) {
            // Broad search for specific term in JSON string
            const candidates = await Product.findAll({
                where: {
                    synonyms: {
                        [Op.like]: `%${productNameQuery}%` // Simple string partial match first
                    },
                    UserId: req.user.effectiveId
                }
            });

            // Verify exact match in the array
            const lowerQuery = productNameQuery.toLowerCase();
            for (const cand of candidates) {
                let syns = [];
                try {
                    syns = (typeof cand.synonyms === 'string') ? JSON.parse(cand.synonyms) : cand.synonyms;
                } catch (e) { syns = []; }

                if (Array.isArray(syns) && syns.some(s => s.toLowerCase() === lowerQuery)) {
                    product = cand;
                    console.log(`[Alexa] Synonym match: "${productNameQuery}" -> "${cand.name}"`);
                    break;
                }
            }
        }

        if (!product) {
            console.log(`[Alexa] Creating new product: "${productNameQuery}"`);
            product = await Product.create({
                name: productNameQuery,
                unit: unitName || 'Stück',
                category: 'Uncategorized',
                isNew: true,
                source: 'alexa',
                UserId: req.user.effectiveId
            });
            logAlexa('INFO', 'PRODUCT_CREATED', `Created new product: ${productNameQuery}`, { id: product.id });
        }

        // 3. Add to List
        const existingItem = await ListItem.findOne({
            where: {
                ListId: targetList.id,
                ProductId: product.id,
                UserId: req.user.effectiveId
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
                is_bought: false,
                UserId: req.user.effectiveId
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

        // 1. Resolve Date(s)
        let dates = [];
        let dateLabel = ''; // For output "Am Wochenende", "Heute", etc.
        const now = new Date();
        const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

        const getNextDayOfWeek = (date, dayOfWeek) => {
            const resultDate = new Date(date.getTime());
            resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
            // If today is the day, it returns today. If we want next week:
            // But we handle "This" vs "Next" logic manually below.
            return resultDate;
        };

        if (tag.toLowerCase() === 'heute') {
            dates.push(now.toISOString().split('T')[0]);
            dateLabel = 'Heute';
        } else if (tag.toLowerCase() === 'morgen') {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dates.push(tomorrow.toISOString().split('T')[0]);
            dateLabel = 'Morgen';
        } else if (tag.toLowerCase().includes('wochenende')) {
            // "Am Wochenende" logic
            // If Mon-Thu (1-4): Next Weekend
            // If Fri-Sun (5,6,0): This Weekend

            let saturday = new Date(now);
            let sunday = new Date(now);

            if (currentDay >= 1 && currentDay <= 4) {
                // Next weekend
                // Distance to next Saturday: 6 - currentDay + (if current > 6 ? 0 : 0) -> simple:
                // Saturday is day 6.
                const daysUntilSat = 6 - currentDay;
                saturday.setDate(now.getDate() + daysUntilSat);
                sunday.setDate(now.getDate() + daysUntilSat + 1);
            } else {
                // This weekend (Fri, Sat, Sun)
                if (currentDay === 5) { // Friday
                    saturday.setDate(now.getDate() + 1);
                    sunday.setDate(now.getDate() + 2);
                } else if (currentDay === 6) { // Saturday
                    // Today is Sat
                    saturday = now;
                    sunday.setDate(now.getDate() + 1);
                } else { // Sunday
                    // "Weekend" on Sunday usually means "This weekend" -> yesterday and today? 
                    // Or just today? Or next weekend?
                    // User requirement: "am aktuell laufenden wochenende wenn wochenende ist"
                    // If it is Sunday, "Current Weekend" implies Sat & Sun.
                    saturday.setDate(now.getDate() - 1);
                    sunday = now;
                }
            }
            dates.push(saturday.toISOString().split('T')[0]);
            dates.push(sunday.toISOString().split('T')[0]);
            dateLabel = 'Am Wochenende';

        } else if (/^\d{4}-\d{2}-\d{2}$/.test(tag)) {
            dates.push(tag);
            dateLabel = `Am ${tag}`;
        } else {
            logAlexa('WARN', 'EXECUTION', `Invalid date format: ${tag}`);
            return res.status(400).json({ error: 'Invalid date format' });
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
        const { Menu, Recipe } = require('../models');

        const responses = [];

        for (const dateQuery of dates) {
            // Determine friendly date name for this specific iteration
            let dayLabel = dateLabel;
            // If we are in "Weekend" mode (multiple dates), we want specific day names
            if (dates.length > 1) {
                const d = new Date(dateQuery);
                const dayName = d.toLocaleDateString('de-DE', { weekday: 'long' });
                dayLabel = `Am ${dayName}`;
            }

            if (mealType) {
                // --- Specific Meal Query ---
                const menuEntry = await Menu.findOne({
                    where: {
                        date: dateQuery,
                        meal_type: mealType,
                        [Op.or]: [
                            { is_eating_out: false },
                            { is_eating_out: null }
                        ],
                        UserId: req.user.effectiveId
                    },
                    include: [Recipe]
                });

                if (!menuEntry) {
                    const artDisplay = art ? art.replace(/^\w/, c => c.toUpperCase()) : 'dieser Mahlzeit';
                    responses.push(`${dayLabel} ist zum ${artDisplay} nichts geplant.`);
                } else {
                    let dishName = menuEntry.Recipe ? menuEntry.Recipe.title : (menuEntry.description || "etwas ohne Namen");
                    responses.push(`${dayLabel} gibt es ${dishName}.`);
                }

            } else {
                // --- Full Day Query ---
                const menuEntries = await Menu.findAll({
                    where: {
                        date: dateQuery,
                        [Op.or]: [
                            { is_eating_out: false },
                            { is_eating_out: null }
                        ],
                        UserId: req.user.effectiveId
                    },
                    include: [Recipe],
                    order: [['meal_type', 'ASC']]
                });

                if (menuEntries.length === 0) {
                    responses.push(`${dayLabel} ist nichts geplant.`);
                } else {
                    const getGermanMealName = (type) => {
                        switch (type) {
                            case 'breakfast': return 'Frühstück';
                            case 'lunch': return 'Mittagessen';
                            case 'dinner': return 'Abendessen';
                            case 'snack': return 'Snack';
                            default: return type;
                        }
                    };

                    const parts = [];
                    const order = ['breakfast', 'lunch', 'dinner', 'snack'];

                    for (const type of order) {
                        const entry = menuEntries.find(e => e.meal_type === type);
                        if (entry) {
                            let dishName = entry.Recipe ? entry.Recipe.title : (entry.description || "");
                            if (!dishName) continue;
                            const mealName = getGermanMealName(type);
                            const preposition = type === 'snack' ? 'als' : 'zum';
                            parts.push(`${dishName} ${preposition} ${mealName}`);
                        }
                    }

                    if (parts.length === 0) {
                        responses.push(`${dayLabel} ist nichts geplant.`);
                    } else {
                        let dailySummary = '';
                        if (parts.length === 1) {
                            dailySummary = `${dayLabel} gibt es ${parts[0]}.`;
                        } else {
                            const last = parts.pop();
                            dailySummary = `${dayLabel} gibt es ${parts.join(', ')} und ${last}.`;
                        }
                        responses.push(dailySummary);
                    }
                }
            }
        }

        // Combine all responses
        const finalSummary = responses.join(' ');

        logAlexa('INFO', 'RESPONSE', `Menu answer: ${finalSummary}`, { dates, type: mealType });
        return res.json({ text: finalSummary, card: 'Wochenplan' });

    } catch (err) {
        logAlexa('ERROR', 'EXECUTION', 'Menu query failed', { error: err.message });
        console.error('[Alexa Menu Error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
