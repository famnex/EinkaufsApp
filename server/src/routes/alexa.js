const express = require('express');
const router = express.Router();
const { List, ListItem, Product, Settings, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logAlexa } = require('../utils/logger');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Helper: Title Case (capitalize fitst letter of every word)
const toTitleCase = (str) => {
    if (!str) return str;
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

// Middleware to check Alexa Auth (Standard JWT or legacy API Key)
const checkAlexaAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logAlexa('WARN', 'AUTH', 'Missing or invalid Auth Header');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];

        // 1. Try JWT (OAuth2 / Handshake)
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id);
            if (user) {
                req.user = user;
                req.user.effectiveId = user.householdId || user.id;
                return next();
            }
        } catch (jwtErr) {
            // Not a valid JWT or expired, fall back to legacy key check
        }

        // 2. Try Legacy API Key (alexa_key)
        const setting = await Settings.findOne({ where: { key: 'alexa_key', value: token } });
        if (!setting) {
            logAlexa('WARN', 'AUTH', 'Invalid Token or API Key');
            return res.status(403).json({ error: 'Forbidden' });
        }

        const user = await User.findByPk(setting.UserId);
        if (!user) {
            logAlexa('WARN', 'AUTH', 'User associated with legacy key not found');
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        req.user.effectiveId = user.householdId || user.id;
        next();
    } catch (err) {
        logAlexa('ERROR', 'AUTH', 'Internal Auth Error', { error: err.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// --- OAuth2 Handshake Endpoints ---

// GET Authorize: Show Login Form
router.get('/authorize', (req, res) => {
    const { client_id, response_type, state, redirect_uri } = req.query;

    // Optional: Validate client_id against .env (e.g., ALEXA_CLIENT_ID)

    // Simple HTML Login Form
    res.send(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GabelGuru Alexa Verbindung</title>
            <style>
                body { font-family: sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); width: 100%; max-width: 400px; }
                h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #4f46e5; }
                input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; box-sizing: border-box; }
                button { width: 100%; padding: 0.75rem; background: #4f46e5; color: white; border: none; border-radius: 0.5rem; font-weight: bold; cursor: pointer; }
                p { font-size: 0.875rem; color: #6b7280; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Alexa verbinden</h1>
                <p>Melde dich an, um GabelGuru mit Alexa zu nutzen.</p>
                <form action="" method="POST">
                    <input type="hidden" name="state" value="${state || ''}">
                    <input type="hidden" name="redirect_uri" value="${redirect_uri || ''}">
                    <input type="text" name="email" placeholder="Email oder Benutzername" required autofocus>
                    <input type="password" name="password" placeholder="Passwort" required>
                    <button type="submit">Verbinden</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// POST Authorize: Handle Login and Redirect with code
router.post('/authorize', async (req, res) => {
    const { email, password, state, redirect_uri } = req.body;

    try {
        const user = await User.findOne({ where: { [Op.or]: [{ email }, { username: email }] } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.send('Ungültige Anmeldedaten. Bitte versuche es erneut.');
        }

        // Generate a temporary auth code
        const authCode = crypto.randomBytes(16).toString('hex');

        // Save auth code in Settings with expiration (e.g., 5 min)
        await Settings.create({
            key: `alexa_auth_code_${authCode}`,
            value: JSON.stringify({ userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 }),
            UserId: user.id
        });

        // Redirect back to Alexa with the code and original state
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.append('code', authCode);
        redirectUrl.searchParams.append('state', state);

        res.redirect(redirectUrl.toString());
    } catch (err) {
        console.error('Alexa Authorize Error:', err);
        res.status(500).send('Ein Fehler ist aufgetreten.');
    }
});

// POST Token: Exchange code for refresh/access tokens
router.post('/token', express.urlencoded({ extended: true }), async (req, res) => {
    const { grant_type, code, client_id, client_secret } = req.body;

    // Optional: Validate Client ID and Secret if configured in .env
    if (process.env.ALEXA_CLIENT_ID && client_id !== process.env.ALEXA_CLIENT_ID) {
        logAlexa('WARN', 'TOKEN', 'Invalid Client ID', { client_id });
        return res.status(401).json({ error: 'invalid_client' });
    }
    if (process.env.ALEXA_CLIENT_SECRET && client_secret !== process.env.ALEXA_CLIENT_SECRET) {
        logAlexa('WARN', 'TOKEN', 'Invalid Client Secret');
        return res.status(401).json({ error: 'invalid_client' });
    }

    try {
        if (grant_type === 'authorization_code') {
            const setting = await Settings.findOne({ where: { key: `alexa_auth_code_${code}` } });
            if (!setting) return res.status(400).json({ error: 'invalid_grant' });

            const data = JSON.parse(setting.value);
            if (Date.now() > data.expiresAt) {
                await setting.destroy();
                return res.status(400).json({ error: 'invalid_grant' });
            }

            const user = await User.findByPk(data.userId);
            // Cleanup code
            await setting.destroy();

            // Generate Access Token (JWT)
            const accessToken = jwt.sign(
                { id: user.id, role: user.role, version: user.tokenVersion },
                process.env.JWT_SECRET,
                { expiresIn: '180d' }
            );

            // Alexa expected response
            return res.json({
                access_token: accessToken,
                token_type: 'Bearer',
                expires_in: 15552000 // 180 days in seconds
            });
        }

        res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (err) {
        console.error('Alexa Token Error:', err);
        res.status(500).json({ error: 'server_error' });
    }
});

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
