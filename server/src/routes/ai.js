const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const { Settings, Recipe, Product, Tag, HiddenCleanup, User } = require('../models');
const { auth } = require('../middleware/auth');
const isAdmin = require('../middleware/admin');
const creditService = require('../services/creditService');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { optimizeImage } = require('../utils/imageOptimizer');

// Configure multer for AI image analysis (temporary storage)
const aiStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userId = req.user ? req.user.effectiveId : 'unknown';
        const uploadDir = path.join(__dirname, `../../public/uploads/users/${userId}/ai-vision`);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'vision-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: aiStorage });

// In-Memory Fair Use Tracking for free AI endpoints (Plastikgabel)
const fairUseLog = new Map();

function checkFairUse(userId) {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    let userLog = fairUseLog.get(userId) || [];
    userLog = userLog.filter(ts => (now - ts) < windowMs);
    if (userLog.length >= 10) {
        fairUseLog.set(userId, userLog);
        return false;
    }
    userLog.push(now);
    fairUseLog.set(userId, userLog);
    return true;
}

router.post('/cleanup/toggle-hidden', auth, async (req, res) => {
    try {
        const { productId, context } = req.body;
        if (!productId || !context) {
            return res.status(400).json({ error: 'ProductId and Context required' });
        }

        const existing = await HiddenCleanup.findOne({
            where: { ProductId: productId, context, UserId: req.user.effectiveId }
        });

        if (existing) {
            await existing.destroy();
            res.json({ isHidden: false });
        } else {
            await HiddenCleanup.create({ ProductId: productId, context, UserId: req.user.effectiveId });
            res.json({ isHidden: true });
        }
    } catch (err) {
        console.error('Toggle Hidden Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/cleanup/hidden', auth, async (req, res) => {
    try {
        const { context } = req.body;
        if (!context) {
            return res.status(400).json({ error: 'Context required' });
        }

        const deletedCount = await HiddenCleanup.destroy({
            where: { context, UserId: req.user.effectiveId }
        });

        res.json({ message: 'Success', deletedCount });
    } catch (err) {
        console.error('Bulk Unhide Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/parse', auth, upload.single('image'), async (req, res) => {
    try {
        let { input } = req.body;
        const imageFile = req.file;

        if (!input && !imageFile) {
            return res.status(400).json({ error: 'Input text or image is required' });
        }

        // Get API Key
        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured in Settings' });
        }

        // Fetch existing categories and tags to guide the AI
        const existingCategories = await Recipe.findAll({
            attributes: ['category'],
            group: ['category'],
            where: { UserId: req.user.effectiveId },
            raw: true
        });
        const categoryList = existingCategories
            .map(c => c.category)
            .filter(c => c)
            .join(', ');

        const existingTags = await Tag.findAll({
            where: { UserId: req.user.effectiveId },
            attributes: ['name'],
            raw: true
        });
        const tagList = existingTags.map(t => t.name).join(', ');

        const openai = new OpenAI({ apiKey: setting.value });

        let messages = [
            {
                role: "system",
                content: "You are a professional recipe parser. You extract structured data from text or images of recipes. Return strictly valid JSON in German."
            }
        ];

        let userContent = [
            {
                type: "text",
                text: `
                Analyze the recipe data provided. It may be raw text, a JSON-LD object, or an image of a recipe (cookbook, handwriting).
                Extract structured recipe data.
                
                Existing Categories in Database: [${categoryList}]
                Existing Tags in Database: [${tagList}]
                
                ${input ? `TEXT DATA: "${input.substring(0, 15000)}"` : ""}
                
                Return a JSON object with this EXACT structure:
                {
                    "title": "Recipe Title",
                    "description": "Short description (max 200 chars)",
                    "category": "Suggested Category (Pick from existing if fits, or suggest new)",
                    "tags": ["Tag1", "Tag2"], // Max 5 tags.
                    "image_url": "URL found in text data (return null if image provided as file/vision)",
                    "servings": 4, // integer.
                    "prep_time": 20, // integer (minutes).
                    "total_time": 60, // integer (minutes).
                    "ingredients": [
                        {
                            "amount": 2,    // number.
                            "unit": "Stück", // Standardized German unit
                            "name": "Eier", // Standardized German ingredient name
                            "alternative_names": ["Ei", "Eier", "Hühnerei"]
                        }
                    ],
                    "steps": [
                        "Step 1...",
                        "Step 2..."
                    ]
                }
                
                IMPORTANT:
                - Output strictly valid JSON.
                - Translate all text to GERMAN.
                - Ensure "amount" is a JSON Number.
                - "prep_time" and "total_time" must be in MINUTES (integer).
                `
            }
        ];

        if (imageFile) {
            const base64Image = fs.readFileSync(imageFile.path, { encoding: 'base64' });
            userContent.push({
                type: "image_url",
                image_url: {
                    url: `data:${imageFile.mimetype};base64,${base64Image}`
                }
            });
        }

        messages.push({ role: "user", content: userContent });

        const completion = await openai.chat.completions.create({
            messages,
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Deduct Credits
        const creditType = imageFile ? 'IMAGE_TO_TEXT' : 'TEXT';
        await creditService.deductCredits(req.user.effectiveId, creditType, 'Rezept parsen (Vision)');

        // Cleanup temporary image file
        if (imageFile && fs.existsSync(imageFile.path)) {
            fs.unlinkSync(imageFile.path);
        }

        res.json(result);

    } catch (err) {
        console.error('AI Parse Error:', err);
        // Ensure cleanup on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: err.message });
    }
});

// Cleanup Endpoint
router.post('/cleanup', auth, async (req, res) => {
    try {
        const { type, products } = req.body; // products = [{ id, name, ... }]
        if (!type || !products || !products.length) {
            return res.status(400).json({ error: 'Type and products are required' });
        }

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        const openai = new OpenAI({ apiKey: setting.value });

        let prompt = "";
        const productNames = products.map(p => p.name).join('; ');

        if (type === 'category') {
            // Get existing categories
            const existingCategories = await Product.findAll({
                attributes: ['category'],
                group: ['category'],
                where: {
                    category: { [require('sequelize').Op.ne]: null },
                    [require('sequelize').Op.or]: [
                        { UserId: req.user.effectiveId },
                        { UserId: null }
                    ]
                },
                raw: true
            });
            const categoryList = existingCategories.map(c => c.category).filter(Boolean).join(', ');

            prompt = `
            You are a grocery store manager. I have a list of products that are missing categories.
            
            Existing Categories: [${categoryList}]
            
            Products to categorize:
            [${productNames}]

            For each product, assign the best fitting category from the existing list. 
            If no existing category fits well, suggest a new, sensible German category name (e.g. "Milchprodukte", "Obst & Gemüse", "Konserven").
            
            Return a JSON object:
            {
                "results": [
                    { "name": "Product Name", "category": "Assigned Category" }
                ]
            }
            `;

        } else if (type === 'unit') {
            prompt = `
            You are a grocery expert. I have a list of products that need standardized sales units.
            
            Products:
            [${productNames}]

            For each product, suggest the most common sales unit (e.g. Stück, Packung, Flasche, Dose, Becher, Kopf, Bund, kg, g, Liter).
            Also suggest a strictly numeric amount if typical (e.g. for "1 Liter Milk" -> amount: 1, unit: Liter). If variable, just default to amount 1 and the unit (e.g. 1 Stück).
            
            Return a JSON object:
            {
                "results": [
                    { "name": "Product Name", "unit": "Suggested Unit", "amount": 1 }
                ]
            }
            `;
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant that outputs strictly JSON." },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Map back to IDs if possible, but for now we rely on name matching or pure index if order preserved (OpenAI usually preserves order but name matching is safer)
        const mappedResults = result.results.map(r => {
            const original = products.find(p => p.name === r.name);

            // Fix: Ensure unit does not contain leading numbers (e.g. "1 Packung" -> "Packung")
            if (type === 'unit' && r.unit) {
                r.unit = r.unit.replace(/^\d+\s+/, '').replace(/^\d+/, '');
            }

            return {
                id: original ? original.id : null,
                ...r
            };
        });

        // Deduct Credits on Success
        await creditService.deductCredits(req.user.effectiveId, 'TEXT', `KI Cleanup: ${type}`);

        res.json(mappedResults);

    } catch (err) {
        console.error('AI Cleanup Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Generic Credit Deduction Endpoint
router.post('/deduct', auth, async (req, res) => {
    try {
        const { type, description } = req.body;
        if (!type) return res.status(400).json({ error: 'Type is required' });

        await creditService.deductCredits(req.user.effectiveId, type, description || `KI Nutzung: ${type}`);
        res.json({ success: true });
    } catch (err) {
        console.error('AI Deduction Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Product Substitution Suggestions
router.post('/suggest-substitute', auth, async (req, res) => {
    try {
        const { productName, context } = req.body;

        if (!productName) {
            return res.status(400).json({ error: 'Product name required' });
        }

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        // Fair-Use Rate Limit for Plastikgabel
        if (req.user.tier === 'Plastikgabel') {
            if (!checkFairUse(req.user.effectiveId)) {
                return res.status(429).json({ error: 'Fair-Use Limit erreicht: Bitte warte ein wenig, bevor du diese kostenlose Funktion erneut nutzt (Maximal 10 Anfragen pro Stunde).' });
            }
        }

        const openai = new OpenAI({ apiKey: setting.value });

        // Fetch household intolerances to avoid suggesting forbidden items
        const { Intolerance, User: UserModel, Product: ProductModel } = require('../models');
        const { Op } = require('sequelize');

        const currentUser = await UserModel.findByPk(req.user.effectiveId);
        const householdMembers = await UserModel.findAll({
            where: {
                [Op.or]: [
                    { id: currentUser.householdId || req.user.effectiveId },
                    { householdId: currentUser.householdId || req.user.effectiveId }
                ]
            },
            include: [
                { model: Intolerance, through: { attributes: [] } },
                { model: ProductModel, as: 'IntolerantProducts', through: { attributes: [] } }
            ]
        });

        const forbiddenItems = new Set();
        householdMembers.forEach(m => {
            m.Intolerances?.forEach(i => {
                // Use warningText if available, it's more specific (e.g., "Enthält Ei")
                forbiddenItems.add(i.warningText || i.name);
            });
            m.IntolerantProducts?.forEach(p => forbiddenItems.add(p.name));
        });

        const forbiddenList = Array.from(forbiddenItems).join(', ');

        const prompt = `
Du bist ein Experte für deutsche Lebensmittel und Zutaten.
Ich brauche einen Ersatz für "${productName}" ${context ? `für ${context}` : ''}.

${forbiddenList ? `WICHTIG: Schlage KEINE Produkte vor, die folgende Inhaltsstoffe enthalten oder damit verwandt sind oder gegen diese Regeln verstoßen (Unverträglichkeiten im Haushalt): [${forbiddenList}]` : ''}

Gib mir 5 gute Alternativen, die:
- In deutschen Supermärkten verfügbar sind
- Ähnliche Eigenschaften haben
- Praktisch austauschbar sind
- Sicher für jemanden mit den oben genannten Unverträglichkeiten sind
- Einzelprodukte sind und keine Produktgruppen

WICHTIG: Antworte nur mit gültigem JSON in diesem exakten Format:
{
  "suggestions": [
    {
      "name": "Produktname",
      "reason": "Kurze Begründung (max 50 Zeichen)",
      "confidence": 0.9
    }
  ]
}

Sortiere nach confidence (höchste zuerst).
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        res.json(result);

    } catch (err) {
        console.error('AI Substitute Suggestion Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Recipe-Aware Product Substitution Suggestions
router.post('/suggest-recipe-substitute', auth, async (req, res) => {
    try {
        const { productName, recipeId, originalAmount, originalUnit } = req.body;

        if (!productName || !recipeId) {
            return res.status(400).json({ error: 'Product name and Recipe ID required' });
        }

        const recipe = await Recipe.findByPk(recipeId);
        if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        // ... (Fair-Use check remains same)
        if (req.user.tier === 'Plastikgabel') {
            if (!checkFairUse(req.user.effectiveId)) {
                return res.status(429).json({ error: 'Fair-Use Limit erreicht: Bitte warte ein wenig, bevor du diese kostenlose Funktion erneut nutzt.' });
            }
        }

        const openai = new OpenAI({ apiKey: setting.value });

        // Fetch household intolerances
        const { Intolerance, User: UserModel, Product: ProductModel } = require('../models');
        const { Op } = require('sequelize');

        const currentUser = await UserModel.findByPk(req.user.effectiveId);
        const householdMembers = await UserModel.findAll({
            where: {
                [Op.or]: [
                    { id: currentUser.householdId || req.user.effectiveId },
                    { householdId: currentUser.householdId || req.user.effectiveId }
                ]
            },
            include: [
                { model: Intolerance, through: { attributes: [] } },
                { model: ProductModel, as: 'IntolerantProducts', through: { attributes: [] } }
            ]
        });

        const forbiddenItems = new Set();
        householdMembers.forEach(m => {
            m.Intolerances?.forEach(i => forbiddenItems.add(i.warningText || i.name));
            m.IntolerantProducts?.forEach(p => forbiddenItems.add(p.name));
        });

        const forbiddenList = Array.from(forbiddenItems).join(', ');

        const prompt = `
Du bist ein kulinarischer Experte. Ich brauche einen Ersatz für "${productName}" (Menge im Rezept: ${originalAmount || '?'} ${originalUnit || ''}) in dem Rezept "${recipe.title}".
Das Rezept hat folgende Zubereitungsschritte: ${JSON.stringify(recipe.instructions || [])}.

${forbiddenList ? `WICHTIG: Schlage KEINE Produkte vor, die gegen diese Haushalts-Unverträglichkeiten verstoßen: [${forbiddenList}]` : ''}

Der Ersatz MUSS:
1. Kulinarisch perfekt zum Rezept "${recipe.title}" passen (Konsistenz, Geschmack, Garverhalten).
2. Sicher für die genannten Unverträglichkeiten sein.
3. In deutschen Supermärkten als Einzelprodukt (keine Gruppen) verfügbar sein.
4. EINE EMPFOHLENE MENGE angeben, die die ursprüngliche Menge (${originalAmount} ${originalUnit}) ersetzt. 
   WICHTIG: Berücksichtige die physikalischen Eigenschaften. (Beispiel: Wenn 4 Eier ersetzt werden, braucht man vielleicht 200g Seitan oder 2 EL Leinsamenmehl+Wasser. Gib realistische Mengen an!)

Gib mir 5 gute Alternativen als JSON:
{
  "suggestions": [
    {
      "name": "Produktname",
      "substituteQuantity": 200, // Empfohlene Menge als Zahl
      "substituteUnit": "g", // Empfohlene Einheit (z.B. g, ml, Stück, EL)
      "reason": "Kurze kulinarische Begründung warum es passt und warum diese Menge (max 80 Zeichen)",
      "confidence": 0.95
    }
  ]
}
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Deduct credits
        await creditService.deductCredits(req.user.effectiveId, 'TEXT', `KI Rezept-Ersatz: ${productName} in ${recipe.title}`);

        res.json(result);

    } catch (err) {
        console.error('AI Recipe Substitute Suggestion Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// AI Duplicate Product Detection
router.post('/find-duplicates', auth, async (req, res) => {
    try {
        const { products } = req.body;
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'Products array is required' });
        }

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key ist nicht konfiguriert' });
        }

        const openai = new OpenAI({ apiKey: setting.value });

        // Create prompt for duplicate detection
        const prompt = `Analysiere diese Liste deutscher Lebensmittelprodukte und identifiziere ECHTE DUPLIKATE - also Produkte, die das GLEICHE Produkt bezeichnen, aber unterschiedlich geschrieben sind.

WICHTIG - NUR DUPLIKATE, KEINE SUBSTITUTIONEN:
- ✅ RICHTIG: "Gemüsebrühe" und "Gemüsebouillon" (gleiches Produkt, verschiedene Namen)
- ✅ RICHTIG: "Tomaaten" und "Tomaten" (Tippfehler)
- ✅ RICHTIG: "Milch" und "Vollmilch 3,5%" (gleiches Produkt, unterschiedlich spezifisch)
- ✅ RICHTIG: "Äpfel" und "Aepfel" (gleiche Schreibweise, nur Umlaut-Unterschied)
- ❌ FALSCH: "Mango" und "Apfel" (verschiedene Produkte, auch wenn beide süß sind)
- ❌ FALSCH: "Butter" und "Margarine" (Substitution, aber verschiedene Produkte)
- ❌ FALSCH: "Rinderhackfleisch" und "Schweinehackfleisch" (verschiedene Produkte)

Gebe ein JSON-Objekt zurück mit einem Array "suggestions", wobei jeder Eintrag folgendes Format hat:
{
  "sourceId": <ID des zu löschenden Produkts>,
  "targetId": <ID des beizubehaltenden Produkts>,
  "reason": "<kurze deutsche Begründung warum das DUPLIKATE sind>",
  "confidence": <Konfidenz-Score 0-100>
}

KRITERIEN:
- Sei SEHR konservativ - schlage nur Zusammenführungen vor, bei denen du zu 95%+ sicher bist, dass es DASSELBE Produkt ist
- Das "source" Produkt wird gelöscht und als Synonym zum "target" hinzugefügt
- Berücksichtige: Singular/Plural, Abkürzungen, Tippfehler, unterschiedliche Schreibweisen, Umlaute
- Ignoriere Groß-/Kleinschreibung
- Maximal 20 Vorschläge
- NUR echte Duplikate, KEINE Substitutionen oder ähnliche Produkte

Produkte: ${JSON.stringify(products)}

Beispiel Output:
{
  "suggestions": [
    {"sourceId": 5, "targetId": 12, "reason": "Beide bezeichnen dasselbe Produkt: Gemüsebrühe", "confidence": 97},
    {"sourceId": 23, "targetId": 8, "reason": "Tippfehler: Tomaaten ist identisch mit Tomaten", "confidence": 99}
  ]
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3, // Lower temperature for more consistent results
            max_tokens: 2000,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Validate and filter results
        const suggestions = (result.suggestions || [])
            .filter(s => s.sourceId && s.targetId && s.confidence >= 90)
            .slice(0, 20); // Limit to 20 suggestions

        // Deduct Credits on Success
        await creditService.deductCredits(req.user.effectiveId, 'TEXT', 'KI Duplikatsuche');

        res.json({ suggestions });

    } catch (err) {
        console.error('AI Duplicate Detection Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Instagram Post Generation (Admin Only)
router.post('/insta-post', auth, isAdmin, async (req, res) => {
    try {
        const { title, ingredients, instructions } = req.body;
        if (!title || !ingredients || !instructions) {
            return res.status(400).json({ error: 'Title, ingredients and instructions are required' });
        }

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        const openai = new OpenAI({ apiKey: setting.value });

        const prompt = `
Du bist ein Social Media Experte für Instagram. Generiere einen Instagram Post für folgendes Rezept:
Titel: ${title}
Zutaten: ${ingredients}
Zubereitung: ${instructions}

Format des Posts:
${title}
[Kurzer Einleitungstext warum wir das gerne Kochen, oder wieso uns das gefällt.]

Zutaten
[Auflistung der Zutaten mit Mengen und vor jeder Zutat ein passendes Emoji - Keine Änderungen am Rezept!!!]

Zubereitung
[Aufzählende Schritte - OHNE ÄNDERUNGEN]

5 Hashtags

WICHTIG: Nutze KEINE Markdown-Formatierung wie fettgedruckten Text (**), Kursivschrift (*) oder Überschriften (#). Nutze keinen Bindestrich oder "deppenstrich" in Sätzen. Gib nur reinen Text zurück.
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        });

        const post = completion.choices[0].message.content;
        res.json({ post });

    } catch (err) {
        console.error('Insta Post Generation Error:', err);
        res.status(500).json({ error: err.message });
    }
});

const Jimp = require('jimp');

// Image Generation Endpoint
router.post('/generate-image', auth, async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        const openai = new OpenAI({ apiKey: setting.value });

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `A professional, appetizing food photography shot of: ${title}. High resolution, natural lighting, culinary magazine style.`,
            n: 1,
            size: "1792x1024", // Landscape
            quality: "hd",
        });

        const imageUrl = response.data[0].url;

        // Deduct Credits AFTER successful API response, before image processing/download
        await creditService.deductCredits(req.user.effectiveId, 'IMAGE', 'KI Bild generieren');

        // Download and Optimize
        const imageResponse = await axios({
            url: imageUrl,
            responseType: 'arraybuffer'
        });

        const uploadDir = path.join(__dirname, `../../public/uploads/users/${req.user.effectiveId}/recipes`);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + '.jpg';
        const filepath = path.join(uploadDir, filename);

        // Save raw buffer first so optimizer can read it
        fs.writeFileSync(filepath, Buffer.from(imageResponse.data));

        try {
            const { path: optimizedPath } = await optimizeImage(filepath);
            const finalFilename = path.basename(optimizedPath);
            console.log('Processed AI Image optimized saved to:', optimizedPath);
            // Return local URL (relative)
            res.json({ url: `uploads/users/${req.user.effectiveId}/recipes/${finalFilename}` });
        } catch (optimizeError) {
            console.error('Optimization failed, saving raw:', optimizeError);
            fs.writeFileSync(filepath, Buffer.from(imageResponse.data));
            res.json({ url: `uploads/users/${req.user.effectiveId}/recipes/${filename}` });
        }

    } catch (err) {
        console.error('Image Generation Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Regenerate Image (GPT-Image-1-Mini Variation)
router.post('/regenerate-image', auth, async (req, res) => {
    try {
        const { imageUrl, title } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'Image URL is required' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        console.log('Regenerating image via GPT-Image-1-Mini from:', imageUrl);

        // 1. Download original image or read from disk
        let sourceBuffer;

        // Check if it's a local file (relative path or contains /uploads/)
        const isLocal = !imageUrl.startsWith('http') || imageUrl.includes('/uploads/');

        if (isLocal) {
            try {
                // Construct standard local path
                // Remove protocol/domain if present in case of full URL to self
                let relativePath = imageUrl;
                if (imageUrl.startsWith('http')) {
                    const urlObj = new URL(imageUrl);
                    relativePath = urlObj.pathname;
                }

                // Remove leading slash for join
                if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);

                // If path points to uploads/ make sure we look in public/uploads/
                // Our standard structure is public/uploads/...
                // If relativePath is "uploads/recipes/foo.jpg", we need path.join(__dirname, '../../public', relativePath)

                // Adjust relative path if it includes "GabelGuru" (subpath case)
                relativePath = relativePath.replace(/^\/?GabelGuru\//, '');

                // Strategy 1: Relative to __dirname (src/routes/ai.js -> ../../public)
                let localPath = path.join(__dirname, '../../public', relativePath);

                console.log('DEBUG: Strategy 1 Path:', localPath);

                if (!fs.existsSync(localPath)) {
                    // Strategy 2: Relative to process.cwd() (server root -> public)
                    const rootPath = path.join(process.cwd(), 'public', relativePath);
                    console.log('DEBUG: Strategy 2 Path (CWD):', rootPath);
                    if (fs.existsSync(rootPath)) {
                        localPath = rootPath;
                    } else {
                        // Strategy 3: Try looking in 'server/public' from CWD if we are in project root
                        const serverPublicPath = path.join(process.cwd(), 'server/public', relativePath);
                        console.log('DEBUG: Strategy 3 Path (server/public):', serverPublicPath);
                        if (fs.existsSync(serverPublicPath)) {
                            localPath = serverPublicPath;
                        }
                    }
                }

                console.log('Final attempt to read local file at:', localPath);

                if (fs.existsSync(localPath)) {
                    sourceBuffer = fs.readFileSync(localPath);
                    console.log('Successfully read local file.');
                } else {
                    console.log('Local file not found in any expected location. Falling back to HTTP.');
                }
            } catch (localErr) {
                console.error('Error reading local file:', localErr);
            }
        }

        if (!sourceBuffer) {
            let targetUrl = imageUrl;
            if (!imageUrl.startsWith('http')) {
                if (req.headers.host) {
                    const protocol = req.secure ? 'https' : 'http';
                    targetUrl = `${protocol}://${req.headers.host}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                }
            }

            console.log('Fetching source image via HTTP:', targetUrl);
            const sourceResponse = await axios({
                url: targetUrl,
                responseType: 'arraybuffer'
            });
            sourceBuffer = sourceResponse.data;
        }

        // 2. Prepare for GPT (Valid PNG/JPG < 4MB)
        // Using Jimp to ensure format and optimize size if needed
        const image = await Jimp.read(sourceBuffer);

        // Ensure max size is reasonable (e.g. max 2048 to stay well under 50MB and process fast)
        // No cropping needed for GPT-Image-1-Mini input, it handles it.
        if (image.bitmap.width > 2048 || image.bitmap.height > 2048) {
            image.scaleToFit(2048, 2048);
        }

        const tempFilePath = path.join(__dirname, `temp_edit_${Date.now()}.png`);
        await image.writeAsync(tempFilePath);

        // 3. Call OpenAI "Edits" Endpoint Manual (via fetch/axios+form-data)
        // Note: Using fetch if available (Node 18+) or 'form-data' package
        try {
            const recipeTitle = title || "Gericht";
            const prompt = `Erstelle eine fotorealistische Variante dieses Fotos: ${recipeTitle}. Gleiche Speise, aber aus einer anderen Perspektive (leicht schräg von oben), anderes Geschirr, andere Deko-Objekte rundherum, natürliches Fensterlicht, Stil: hochwertiges Kochbuchfoto.`;

            // Node 18+ Global Fetch & FormData check
            if (typeof fetch !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') {
                throw new Error("Node versions < 18 not supported for this specific feature implementation yet.");
            }

            const buf = fs.readFileSync(tempFilePath);
            const blob = new Blob([buf], { type: 'image/png' });

            const form = new FormData();
            form.append("model", "gpt-image-1");
            form.append("prompt", prompt);
            form.append("size", "1536x1024"); // Landscape requested
            form.append("output_format", "jpeg"); // JPEG requested
            form.append("n", "1");
            form.append("image", blob, "input.png");

            console.log('Sending request to OpenAI images/edits...');
            const apiRes = await fetch("https://api.openai.com/v1/images/edits", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${setting.value}`
                },
                body: form
            });

            if (!apiRes.ok) {
                const errText = await apiRes.text();
                throw new Error(`OpenAI API Error: ${apiRes.status} ${errText}`);
            }

            const apiData = await apiRes.json();
            const b64 = apiData.data?.[0]?.b64_json;
            if (!b64) throw new Error("No b64_json image data in response");

            // Deduct Credits AFTER successful API response
            await creditService.deductCredits(req.user.effectiveId, 'IMAGE_VAR', 'KI Bild variieren');

            // 4. Save Result
            const uploadDir = path.join(__dirname, `../../public/uploads/users/${req.user.effectiveId}/recipes`);
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = uniqueSuffix + '.jpg';
            const filepath = path.join(uploadDir, filename);

            fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));

            // Optimize
            const { path: optimizedPath } = await optimizeImage(filepath);
            const finalFilename = path.basename(optimizedPath);
            console.log('Regenerated Image optimized saved to:', optimizedPath);

            // Cleanup temp
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

            // Return RELATIVE URL
            res.json({ url: `uploads/users/${req.user.effectiveId}/recipes/${finalFilename}` });

        } catch (apiError) {
            // Cleanup temp on error
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            throw apiError;
        }

    } catch (err) {
        console.error('Image Regeneration Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Chat with Recipe Assistant
router.post('/chat', auth, async (req, res) => {
    try {
        const { message, context } = req.body; // context = { title, ingredients, steps }
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        const openai = new OpenAI({ apiKey: setting.value });

        const systemPrompt = `
        You are a smart Cooking Assistant helping a user cook a recipe.
        
        Recipe Context:
        Title: ${context?.title || 'Unknown'}
        Ingredients: ${JSON.stringify(context?.ingredients || [])}
        Steps: ${JSON.stringify(context?.steps || [])}
        Current Step Index: ${context?.currentStep || 0}
        Servings: ${context?.servings || 4}

        Your Goal:
        Answer the user's question AND execute commands if requested.
        
        You must return a JSON Object:
        {
            "reply": "Short spoken answer (German)",
            "action": { "type": "ACTION_TYPE", "payload": ... } // Optional, only if command detected
        }

        Available Actions:
        1. NAVIGATION:
           - "NEXT_STEP": Go to next step. Payload: null
           - "PREV_STEP": Go to previous step. Payload: null
           - "GOTO_STEP": Go to specific step number (1-based). Payload: { "index": 0 } (0-based index!)
        
        2. SCALING:
           - "SCALE": Change portion size. Payload: { "factor": 2.0 } (e.g. 2 for double, 0.5 for half). 
             If user says "for 3 people" and base is 4, factor is 0.75.
        
        3. SUBSTITUTION:
           - "SUBSTITUTE": Replace an ingredient. Payload: { "original": "Milk", "replacement": "Cream" }

        4. TIMERS:
           - "START_TIMER": Start a timer. Payload: { "seconds": 300, "label": "Nudeln kochen", "text": "5 Minuten" }
        
        Rules for TIMERS:
        - If user says anything about starting a timer:
            - **STEP TIMER**: Look at the CURRENT STEP: "${context?.steps[context?.currentStep || 0] || ''}". 
              If user says "den Timer" (of this step), find the duration.
              If exactly ONE duration is in the step: Return START_TIMER with those seconds.
              If MULTIPLE durations: Ask which one.
              If NO duration: Say so and ask for a manual duration.
            - **CUSTOM TIMER**: If user mentions a specific duration like "5 Minuten" or "1 Stunde":
              CALCULATE SECONDS IMMEDIATELY (e.g. 5 Min = 300, 1 Std = 3600).
              ALWAYS Return START_TIMER action. Example: { "seconds": 300, "label": "Individueller Timer", "text": "5 Minuten" }.
        - NEVER reply with a time in text without ALSO including the START_TIMER action if the user wants to start it.
        
        General Rules:
        - FASSE DICH EXTREM KURZ. Avoid Smalltalk.
        - If the user just chats, return "action": null.
        - If the user says "Ok" or "Danke", confirm and end.
        - Output strictly valid JSON.
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Deduct Credits on Success
        await creditService.deductCredits(req.user.effectiveId, 'COOKING_CHAT', 'KI Kochassistent Chat');

        res.json({ reply: result.reply, action: result.action });

    } catch (err) {
        console.error('AI Chat Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Extract Ingredients from Text/URL for Shopping List
router.post('/extract-list-ingredients', auth, upload.single('image'), async (req, res) => {
    try {
        let { text } = req.body;
        const imageFile = req.file;

        if (!text && !imageFile) {
            return res.status(400).json({ error: 'Text or image is required' });
        }

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        // Fair-Use Rate Limit for Plastikgabel
        if (req.user.tier === 'Plastikgabel') {
            if (!checkFairUse(req.user.effectiveId)) {
                return res.status(429).json({ error: 'Fair-Use Limit erreicht: Bitte warte ein wenig, bevor du diese kostenlose Funktion erneut nutzt (Maximal 10 Anfragen pro Stunde).' });
            }
        }

        let contentToAnalyze = text || "";
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = text ? text.match(urlRegex) : null;

        if (urls && urls.length > 0 && !imageFile) {
            const url = urls[0];
            try {
                const browser = await require('puppeteer').launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                const page = await browser.newPage();
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const bodyText = await page.evaluate(() => document.body.innerText);
                contentToAnalyze = `URL: ${url}\n\nCONTENT:\n${bodyText.substring(0, 20000)}`;
                await browser.close();
            } catch (puppeteerErr) {
                console.error('Puppeteer Error:', puppeteerErr);
                contentToAnalyze = `URL: ${url} (Fetch failed: ${puppeteerErr.message})\n\nOriginal Text:\n${text}`;
            }
        }

        const openai = new OpenAI({ apiKey: setting.value });

        let userContent = [
            {
                type: "text",
                text: `
                Analyze the following data (text, URL content, or image of a shopping list).
                Extract ALL ingredients/products that should be bought.
                
                ${contentToAnalyze ? `TEXT/DATA: "${contentToAnalyze.substring(0, 15000)}"` : ""}
        
                Return a JSON object with an array "items".
                Each item must have:
                - "name": German product name (standardized).
                - "amount": Number (approximate needed quantity). Default 1 if unclear.
                - "unit": Best fitting German unit (e.g. Stück, Packung, kg, g, Liter, Glas, Dose).
                
                Example:
                {
                  "items": [
                    { "name": "Tomaten", "amount": 500, "unit": "g" },
                    { "name": "Milch", "amount": 1, "unit": "Liter" }
                  ]
                }
                
                Ignore conversational text, just get the ingredients/products.
                `
            }
        ];

        if (imageFile) {
            const base64Image = fs.readFileSync(imageFile.path, { encoding: 'base64' });
            userContent.push({
                type: "image_url",
                image_url: {
                    url: `data:${imageFile.mimetype};base64,${base64Image}`
                }
            });
        }

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a shopping list assistant. Return strictly valid JSON in German." },
                { role: "user", content: userContent }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // Deduct Credits
        const creditType = imageFile ? 'IMAGE_TO_TEXT' : 'TEXT';
        await creditService.deductCredits(req.user.effectiveId, creditType, 'Smart Import (Vision)');

        // Cleanup temporary image file
        if (imageFile && fs.existsSync(imageFile.path)) {
            fs.unlinkSync(imageFile.path);
        }

        res.json(result);

    } catch (err) {
        console.error('AI List Extraction Error:', err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: err.message });
    }
});

// Helper to expand abbreviations for TTS
function expandAbbreviations(text) {
    if (!text) return "";

    const expansions = {
        'Min\\.': 'Minuten',
        'Min': 'Minuten',
        'Sek\\.': 'Sekunden',
        'Sek': 'Sekunden',
        'Std\\.': 'Stunden',
        'Std': 'Stunden',
        'g': 'Gramm',
        'kg': 'Kilogramm',
        'EL': 'Esslöffel',
        'TL': 'Teelöffel',
        'Pr\\.': 'Prise',
        'Pkg\\.': 'Packung',
        'Stk\\.': 'Stück',
        'Stk': 'Stück',
        'ml': 'Milliliter',
        'l': 'Liter',
        'ca\\.': 'zirka',
        'evtl\\.': 'eventuell',
        'bzw\\.': 'beziehungsweise',
        'Sekt\\.': 'Sektion',
        '/': ' slash ',
        'Grad': 'Grad Celsius'
    };

    let expanded = text;

    // Expand numbers for explicit pronunciation if they look like quantities/times
    // e.g. "1/2" -> "ein halb", "1/4" -> "ein viertel"
    expanded = expanded.replace(/\b1\/2\b/g, 'ein halb');
    expanded = expanded.replace(/\b1\/4\b/g, 'ein viertel');
    expanded = expanded.replace(/\b3\/4\b/g, 'drei viertel');

    // Expand cooking abbreviations with boundaries
    Object.entries(expansions).forEach(([abbr, full]) => {
        const regex = new RegExp(`\\b${abbr}\\b`, 'g');
        expanded = expanded.replace(regex, full);
    });

    return expanded;
}

// OpenAI TTS Endpoint (GET for easier streaming in browser)
router.get('/speak', auth, async (req, res) => {
    try {
        const { text } = req.query;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        const openai = new OpenAI({ apiKey: setting.value });
        const speechText = expandAbbreviations(text);

        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "shimmer",
            input: speechText,
        });

        res.set('Content-Type', 'audio/mpeg');

        // Use mp3.body if it's a stream, or pipe the result
        if (mp3.body && mp3.body.pipe) {
            mp3.body.pipe(res);
        } else if (mp3.response && mp3.response.body) {
            // Some versions of the SDK require this
            const reader = mp3.response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
            res.end();
        } else {
            // Fallback: full buffer
            const buffer = Buffer.from(await mp3.arrayBuffer());
            res.send(buffer);
        }

    } catch (err) {
        console.error('TTS Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Rewrite Recipe Instructions based on Substitutions
router.post('/rewrite-instructions', auth, async (req, res) => {
    try {
        const { recipeId } = req.body;
        if (!recipeId) return res.status(400).json({ error: 'RecipeId is required' });

        const { Recipe, RecipeSubstitution, Product, RecipeInstructionOverride } = require('../models');

        // Fetch user's substitutions for this recipe
        const substitutions = await RecipeSubstitution.findAll({
            where: { RecipeId: recipeId, UserId: req.user.effectiveId },
            include: [
                { model: Product, as: 'OriginalProduct' },
                { model: Product, as: 'SubstituteProduct' }
            ]
        });

        if (substitutions.length === 0) {
            // If no substitutions, delete any existing override and return original steps
            await RecipeInstructionOverride.destroy({
                where: { RecipeId: recipeId, UserId: req.user.effectiveId }
            });
            const recipe = await Recipe.findByPk(recipeId);
            return res.json({ instructions: recipe.instructions, isOverride: false });
        }

        const recipe = await Recipe.findByPk(recipeId);
        if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        const openai = new OpenAI({ apiKey: setting.value });

        const subList = substitutions.map(s => {
            if (s.isOmitted) {
                return `"${s.OriginalProduct.name}" wurde KOMPLETT GESTRICHEN/WEGGELASSEN (dafür gibt es KEINEN Ersatz).`;
            }
            return `"${s.OriginalProduct.name}" wurde ersetzt durch "${s.SubstituteProduct.name}"`;
        }).join('\n');

        const prompt = `
Du bist ein erfahrener Koch und Experte für Lebensmitteltechnologie. Deine Aufgabe ist es, die Zubereitungsschritte eines Rezepts basierend auf Zutaten-Ersetzungen semantisch und technisch völlig neu zu bewerten.

Original-Rezept: "${recipe.title}"
Original-Schritte (Format: JSON Array von Strings):
${JSON.stringify(recipe.instructions)}

Vorgenommene Ersetzungen:
${subList}

Handlungsanweisungen für die Prozess-Transformation:

1. KULINARISCHE LOGIK-PRÜFUNG:
   Analysiere jeden Schritt auf seine physikalische Sinnhaftigkeit. Wenn eine Handlung (z.B. "Eier trennen", "Knochen entfernen", "Haut einschneiden") auf die Ersatz-Zutat nicht anwendbar ist, ersetze sie durch eine technisch sinnvolle Vorbereitung (z.B. "Ersatzprodukt glatt rühren", "in Scheiben schneiden" oder "trocken tupfen").

2. VORBEREITUNG (PRE-PROCESSING):
   Falls eine Ersatz-Zutat eine Vorbehandlung benötigt, die das Original nicht brauchte (z.B. Soja-Schnetzel einweichen, Jackfruit abspülen, Leinsamen-Ei quellen lassen), integriere diesen Hinweis organisch in den ersten passenden Schritt.

3. GAR- UND TEXTUR-ANPASSUNG:
   Passe Verben und Zeiten an die neue Textur an:
   - Von tierisch auf pflanzlich: Achte darauf, dass pflanzliche Proteine oft schneller zäh werden oder Röstaromen anders entwickeln (z.B. "kurz scharf anbraten" statt "stundenlang schmoren").
   - Flüssigkeiten: Achte auf das Kochverhalten (z.B. "Mandelmilch nur leicht köcheln" statt "Milch sprudelnd aufkochen").

4. STRUKTURELLE KONSISTENZ:
   - Behalte die Anzahl der Schritte (Array-Länge) bei. 
   - Kombiniere Vorbehandlungen der neuen Zutat mit dem ersten Schritt des Originals, um die Schrittzahl nicht zu verändern.

5. AUSGABE-FORMAT:
   - Antworte NUR mit dem JSON-Array der Strings.
   - Keine Markdown-Blöcke, kein Text davor oder danach.
   - Korrigiere dabei automatisch die Grammatik (Artikel/Fälle).

6. ELIMINIERUNG VON FLEISCH-ANATOMIE:
   - Durchsuche den Text aktiv nach Begriffen, die biologisch exklusiv für Fleisch/Tierprodukte sind und lösche oder transformiere sie zwingend:
   - Fettseite / Schwarte / Haut: Ersetze durch "glatte Seite", "Oberfläche" oder streiche es ganz (z.B. "den Tofu von beiden Seiten scharf anbraten").
   - Knochen / Sehnen / Mark: Ersetze durch Formbeschreibungen wie "Würfel", "Scheiben" oder "Stücke".
   - Eigelb/Eiweiß trennen: Ersetze durch "das Ersatzprodukt glatt rühren" oder "mit den flüssigen Zutaten vermengen".
   - Ruhen lassen (Fleischsaft): Bei pflanzlichem Ersatz streichen oder in "kurz ziehen lassen, damit sich die Aromen verbinden" ändern.

7. ELIMINIERUNG UNMÖGLICHER HANDLUNGEN:
   Wenn eine Handlung bei der neuen Zutat physikalisch unmöglich ist, schreibe den Satz komplett um.
   - KEIN "Schälen" oder "Abschrecken" bei Tofu/Ersatzprodukten.
   - KEINE "Größenangaben (Größe M)" bei pflanzlichen Produkten.
   - KEINE "Fettseite", "Haut" oder "Schwarte" bei Fleischersatz.
   - KEIN "Eier trennen", wenn der Ersatz (z.B. Apfelmus) homogen ist.

8. SEMANTISCHE TRANSFORMATION:
   Übersetze die Intention des Originalschritts in eine für die neue Zutat logische Handlung:
   - "Eier 6 Min. kochen und schälen" -> "[Ersatz] vorbereiten und unter die Masse rühren/anbraten."
   - "Mit der Fettseite nach unten anbraten" -> "In der Pfanne von beiden Seiten goldbraun anbraten."
   - "Fleisch vom Knochen lösen" -> "[Ersatz] in mundgerechte Stücke schneiden."

9. TECHNISCHE KORREKTUR:
   Passe Garzeiten und Hitze an. Pflanzliche Proteine und Milchalternativen verbrennen oder verändern ihre Textur anders als tierische Originale.

Beispiele für Transformationen:
- Original: "Eier trennen und das Eigelb schaumig schlagen." -> Ersatz (Apfelmark): "Das Apfelmark mit den übrigen feuchten Zutaten glatt rühren."
- Original: "Den Braten mit der Fettseite nach unten..." -> Ersatz (Seitan): "Den Seitan rundherum scharf anbraten, um eine Kruste zu bilden..."
- Original: "Das Fleisch 2 Stunden schmoren." -> Ersatz (Sojawürfel): "Die eingeweichten Sojawürfel 15 Minuten in der Sauce ziehen lassen."

Beispiel - Ergebnis:
["Zuerst die Zwiebeln anbraten.", "Dann den [Ersatz] dazugeben und 5 Minuten köcheln lassen.", "Zum Schluss alles mit Salz abschmecken."]
    `;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // gpt-4o might be better but gpt-3.5 is faster and cheaper for this
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
        });

        let rewrittenInstructions = [];
        try {
            const content = completion.choices[0].message.content.trim();
            rewrittenInstructions = JSON.parse(content);
        } catch (e) {
            console.error('Failed to parse AI response:', e, completion.choices[0].message.content);
            throw new Error('Die KI hat ein ungültiges Format zurückgegeben.');
        }

        // Save or update override
        const [override, created] = await RecipeInstructionOverride.findOrCreate({
            where: { RecipeId: recipeId, UserId: req.user.effectiveId },
            defaults: { instructions: rewrittenInstructions }
        });

        if (!created) {
            override.instructions = rewrittenInstructions;
            await override.save();
        }

        res.json({ instructions: rewrittenInstructions, isOverride: true });

    } catch (err) {
        console.error('Rewrite Instructions Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Analyze Product for Admin Modal
router.post('/analyze-product', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can use this feature.' });
        }

        const { productName, userFeedback } = req.body;
        if (!productName) return res.status(400).json({ error: 'Product name is required' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        // Fetch context data
        const { ProductVariant, Intolerance, Product } = require('../models');

        const existingCategories = await Product.findAll({
            attributes: ['category'],
            group: ['category'],
            where: { category: { [require('sequelize').Op.ne]: null } },
            raw: true
        });
        const categoryList = existingCategories.map(c => c.category).filter(Boolean);

        const variants = await ProductVariant.findAll({ raw: true });
        const variantList = variants.map(v => ({ id: v.id, title: v.title }));

        const intolerances = await Intolerance.findAll({ raw: true });
        const intoleranceList = intolerances.map(i => ({ id: i.id, name: i.name, warningText: i.warningText }));

        const openai = new OpenAI({ apiKey: setting.value });

        const prompt = `
Du bist ein Ernährungs - und Supermarktexperte.
Analysiere das folgende Produkt: "${productName}"

Hier sind die in der Datenbank vorhandenen Optionen:
Kategorien: ${JSON.stringify(categoryList)}
Varianten: ${JSON.stringify(variantList)}
Unverträglichkeiten: ${JSON.stringify(intoleranceList)}

${userFeedback ? `ACHTUNG - Der Benutzer war mit dem vorherigen Ergebnis nicht einverstanden und hat folgendes Feedback gegeben: "${userFeedback}". 
Bitte passe deine neue Analyse zwingend an dieses Feedback an (!).` : ''
            }

Bitte beantworte diese drei Hauptfragen und formatiere die Antwort EXAKT wie unten gefordert als JSON:
1. Kommt das Produkt typischerweise in mehr als einer dieser DB - Varianten vor ?
    - Wenn NEIN: ordne eine Kategorie und eine Standardverkaufseinheit zu.
        WICHTIG: Denke zwingend an das ** Verkaufsgebinde ** (wie steht es im Regal ?). 
     Nutze Einheiten wie: Stück, Packung, Glas, Dose, Flasche, Beutel, Kiste, Netz, Korb, Bund, etc.
     VERMEIDE generische Einheiten wie g, kg, ml oder l!
    - Wenn JA: nenne die passenden DB - Varianten - IDs und ordne pro Variante eine passende Kategorie und Einheit(Verkaufsgebinde!) zu.
2. In welche existierende Kategorie(siehe Liste) passt das Produkt am besten ? Falls keine passt, schlage eine neue sinnvolle vor.
3. Welche der exakt vorgegebenen DB - Unverträglichkeiten(IDs) treffen typischerweise auf dieses Produkt zu ?
    RECHERCHIERE EXTREM GENAU UND KRITISCH UND GIB EINE WAHRSCHEINLICHKEIT AN:
- Gib für jede zutreffende Unverträglichkeit eine Wahrscheinlichkeit(0 - 100 %) an.
   - 100 % bedeutet: Das Produkt verstößt definitiv gegen diese Regel(z.B.Schweinefleisch bei "Vegan" oder "Vegetarisch").
   - Niedrigere Werte(z.B. 30 %) bedeuten: Es besteht ein Risiko oder eine gewisse Wahrscheinlichkeit(z.B.Spuren von Nüssen, oder bei Cashewmuß ein Restrisiko für nicht - vegane Zusätze wie Honig).
   - Ein Produkt, das zu 100 % Sicher ist(z.B.Brokkoli bei "Vegan"), sollte eine Wahrscheinlichkeit von 0 % haben(und muss dann nicht zwingend gelistet werden, außer du bist dir unsicher).

   HIER SIND DIE DETAILS:
- Alkohol: Alle Getränke mit Ethanolgehalt(Bier, Wein, Spirituosen) sowie Speisen, die mit Alkohol zubereitet wurden(z.B.Rotwein - Saucen oder Pralinen).
   - Eier: Hühnereier in allen Formen(gekocht, gebraten) sowie Produkte, die Ei als Bindemittel enthalten(Mayonnaise, Panaden, viele Backwaren).
   - Erdnüsse: Ganze Erdnüsse, Erdnussbutter, Erdnussöl und oft auch Spuren in asiatischen Gerichten oder Knabbergebäck.
   - Fisch: Alle Süß - und Salzwasserfische.Auch versteckt in Saucen(z.B.Worcestershiresauce oder thailändische Fischsauce).
   - FODMAP - empfindlich: Diese und nur diese Lebensmittel markieren(und ihre ähnlichen Schreibweisen oder wo diese Lebensmittel nachweislich enthalten sind): Apfel, Aprikose, Avocado, Birne, Brombeeren, Datteln, Johannisbeeren, Kirschen, Litschis, Mango, Nashi - Birne, Nektarine, Pampelmuse, Persimone, Pfirsich, Pflaumen, Wassermelone, Zwetschgen, Obstkonserven, Fruchtsäfte, getrocknete Früchte, Artischocke, Blumenkohl, Bohnen(alle außer grüne Stangenbohnen), Chicorée, Erbsen, Frühlingszwiebel(weißer Teil), Knoblauch, Kraut, Lauch(weißer Teil), Linsen, Pilze, Rote Bete, Schalotte, Sellerie(ausgewachsen), Soja, Spargel, Wirsing, Zuckererbsen, Zuckermais, Zwiebel, Gerste, Roggen, Weizen, Brot, Cerealien, Couscous, Gebäck, Gries, Nudeln, Buttermilch, Frischkäse, Hüttenkäse, Joghurt, Kondensmilch, Margarine, Mascarpone, Milch, Milchpulver, Milcheis, Sahne, Sauerrahm, Agavensirup, Fruktosesirup, Honig, Ketchup, Maissirup, Zuckeraustauschstoffe, Vollmilchschokolade, Cashewkerne, Pistazien, Bier(mehr als ein Glas), Wein, Schaumwein(halbtrocken; süß)
- Fruktose: Fruchtzucker, der in Obst, Säften, Honig und oft als Süßungsmittel(Maisstärkesirup) in verarbeiteten Lebensmitteln vorkommt.
   - Glutamat: Ein Geschmacksverstärker, der oft in Fertiggerichten, Brühwürfeln, Chips und der klassischen China - Restaurant - Küche(MSG) zu finden ist.
   - Glutenhaltiges Getreide: Weizen(auch Dinkel, Emmer, Einkorn), Roggen, Gerste und Hafer(sofern nicht als glutenfrei zertifiziert).Enthalten in Brot, Pasta und Bier.
   - Histaminintoleranz: Betrifft gereifte Lebensmittel wie alten Käse, Rotwein, Sauerkraut, gepökeltes Fleisch sowie Tomaten und Schokolade.
   - Krebstiere: Garnelen, Krabben, Hummer, Flusskrebse und Scampi.
   - Lupine: Eine proteinreiche Hülsenfrucht, deren Mehl oft in glutenfreien Backwaren, veganem Fleischersatz oder Pizza - Teigen verwendet wird.
   - Milcheiweiß / Laktose: Kuhmilch und daraus hergestellte Produkte(Käse, Joghurt, Sahne, Butter).Laktose ist der Milchzucker, Milcheiweiß das Protein(Kasein / Molke).
   - Schalenfrüchte: Hierzu zählen Baumnüsse wie Mandeln, Haselnüsse, Walnüsse, Cashews, Pekannüsse, Paranüsse, Pistazien und Macadamia.
   - Sellerie: Knollen - und Staudensellerie.Oft versteckt in Gewürzmischungen, Suppengrün, Saucen und Fertigsuppen.
   - Senf: Senfkörner, Senfpulver und natürlich die Paste.Auch oft in Dressings, Marinaden und Currys enthalten.
   - Sesam: Sesamsamen, Sesamöl und Pasten wie Tahini(Hummussutat).
   - Soja: Sojabohnen, Tofu, Sojamilch, Sojasauce und Lecithin(E322) in Schokolade oder Backwaren.
   - Sorbitunverträglichkeit: Ein Zuckerersatzstoff(E420), der natürlich in Steinobst(Pflaumen, Kirschen) vorkommt oder als Süßungsmittel in zuckerfreien Kaugummis / Bonbons genutzt wird.
   - Sulfite: Schwefelverbindungen zur Konservierung.Hauptsächlich in Wein, Trockenfrüchten und manchmal in geschälten Kartoffelprodukten.
   - Weichtiere: Dazu gehören Muscheln(Miesmuscheln, Austern), Schnecken und Tintenfische(Kalmare, Oktopus).
   - Pescetarisch: Eine vegetarische Ernährung, die jedoch Fisch und Meeresfrüchte sowie meist Eier und Milchprodukte einschließt.
   - Schwein: Alle Produkte vom Hausschwein oder Wildschwein(Schnitzel, Schinken, Speck, Salami) sowie Gelatine vom Schwein(oft in Gummibärchen).
   - Vegan: Verzicht auf alle tierischen Produkte.Kein Fleisch, Fisch, Milch, Eier, Honig oder tierische Zusatzstoffe(wie Karmin oder Gelatine).
   - Vegetarisch: Verzicht auf Fleisch und Fisch(Schlachtprodukte).Milch, Eier und Honig werden konsumiert.
   - ** Fleisch(Meat):** Falls das Produkt Fleisch enthält(Schinken, Salami, Rind, Huhn, etc.), ist es weder vegan noch vegetarisch! Kennzeichne dies korrekt, falls es dafür IDs gibt.
   - ** Allergene:** Beachte versteckte Allergene(z.B.Gluten in Sojasauce, Laktose in Wurst, etc.).
   - Avocados sind KEINE Schalenfrüchte.
   - Butter / Milch / Eier sind NICHT vegan.

Erforderliches JSON - Format:
{
    "hasVariants": true / false,
        "variants": [
            { "ProductVariantId": 1, "category": "KategorieName", "unit": "Einheit" }
        ],
            "category": "KategorieName",
                "unit": "Einheit",
                    "intolerances": [
                        { "id": 3, "probability": 100 },
                        { "id": 4, "probability": 30 }
                    ]
}

WICHTIG:
- Nutze unter 'variants' nur "ProductVariantId"s, die in der DB existieren.
- Fülle "category" und "unit" für das Basis - Objekt immer aus, als Fallback.
- "variants" kann leer sein, wenn "hasVariants" false ist.
- Nutze unter 'intolerances' nur IDs, die tatsächlichen Unverträglichkeiten aus der Liste zugeordnet sind.
- Priorisiere bei 'unit' IMMER das Verkaufsgebinde.Ein Apfel ist 1 Stück, nicht 150g.Milch ist 1 Flasche / Packung, nicht 1l.
- Wenn Fleisch enthalten ist, MUSS "Vegetarisch" und "Vegan" explizit ALS NICHT KONFORM(Wahrscheinlichkeit 100 %) gekennzeichnet werden.
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        let result = JSON.parse(completion.choices[0].message.content);

        // Map intolerances to intoleranceIds for backward compatibility
        if (result.intolerances) {
            result.intoleranceIds = result.intolerances
                .filter(i => i.probability > 0)
                .map(i => i.id);
        }

        // Deduct logical credits internally without charging the admin specifically for their own usage if desired, 
        // but since AI costs real money, let's track it softly or just use the system credit record.
        await creditService.deductCredits(req.user.effectiveId, 'TEXT', 'KI Produktdaten Analyse');

        res.json(result);
    } catch (err) {
        console.error('AI Product Analyze Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
