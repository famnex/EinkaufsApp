const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const { Settings, Recipe, Product, Tag, HiddenCleanup } = require('../models');
const { auth } = require('../middleware/auth');

router.post('/cleanup/toggle-hidden', auth, async (req, res) => {
    try {
        const { productId, context } = req.body;
        if (!productId || !context) {
            return res.status(400).json({ error: 'ProductId and Context required' });
        }

        const existing = await HiddenCleanup.findOne({
            where: { ProductId: productId, context }
        });

        if (existing) {
            await existing.destroy();
            res.json({ isHidden: false });
        } else {
            await HiddenCleanup.create({ ProductId: productId, context });
            res.json({ isHidden: true });
        }
    } catch (err) {
        console.error('Toggle Hidden Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/parse', auth, async (req, res) => {
    try {
        let { input } = req.body;
        if (!input) return res.status(400).json({ error: 'Input is required' });

        // Get API Key
        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured in Settings' });
        }

        // Fetch existing categories and tags to guide the AI
        const existingCategories = await Recipe.findAll({
            attributes: ['category'],
            group: ['category'],
            raw: true
        });
        const categoryList = existingCategories
            .map(c => c.category)
            .filter(c => c) // remove nulls
            .join(', ');

        const existingTags = await Tag.findAll({ attributes: ['name'], raw: true });
        const tagList = existingTags.map(t => t.name).join(', ');

        let metaImage = null;

        // Check if input is a URL and scrape if so
        if (input.startsWith('http://') || input.startsWith('https://')) {
            try {
                console.log('Fetching URL content:', input);
                const response = await axios.get(input, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });
                const $ = cheerio.load(response.data);

                // Extract Meta Images
                metaImage = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content');

                // Try to find JSON-LD
                let jsonLd = null;
                $('script[type="application/ld+json"]').each((i, el) => {
                    try {
                        const data = JSON.parse($(el).html());
                        if (data['@type'] === 'Recipe' || (Array.isArray(data) && data.find(d => d['@type'] === 'Recipe'))) {
                            jsonLd = data;
                        }
                    } catch (e) { }
                });

                if (jsonLd) {
                    console.log('DEBUG: JSON-LD found');
                    // Use specifically the recipe part if possible to save tokens
                    const recipeData = Array.isArray(jsonLd) ? jsonLd.find(d => d['@type'] === 'Recipe') || jsonLd : jsonLd;
                    input = "JSON-LD Data:\n" + JSON.stringify(recipeData);
                } else {
                    console.log('DEBUG: No JSON-LD, using body text');
                    input = $('body').text();
                }

                // CRITICAL: Limit input size to prevent 429 Token Error (Limit ~30k tokens)
                // 15,000 chars is roughly 4k-5k tokens, leaving plenty of room for prompt + response
                if (input.length > 15000) {
                    console.log(`DEBUG: Truncating input from ${input.length} to 15000 chars`);
                    input = input.substring(0, 15000);
                }

            } catch (e) {
                console.error('Scraping error:', e.message);
                // Continue with raw URL or whatever user pasted effectively
            }
        }

        const openai = new OpenAI({ apiKey: setting.value });

        const prompt = `
        Analyze the recipe data below. It may be raw text, scraped HTML text, or a JSON-LD object.
        Extract structured recipe data.
        
        Existing Categories in Database: [${categoryList}]
        Existing Tags in Database: [${tagList}]
        
        Potential Image URL found in Metadata: "${metaImage || 'None'}"
        
        DATA:
        "${input}" 
        
        Return a JSON object with this EXACT structure: 
        
        Return a JSON object with this EXACT structure:
        {
            "title": "Recipe Title",
            "description": "Short description (max 200 chars)",
            "category": "Suggested Category (Pick from existing if fits, or suggest new)",
            "tags": ["Tag1", "Tag2"], // Authentically describe the recipe. Use existing tags if applicable, or create new ones (e.g. "Vegetarisch", "Schnell", "Party", "Sommer"). Max 5 tags.
            "image_url": "URL found in data or meta tags (return null if none found)",
            "servings": 4, // integer. If range "4-6", average to 5. Default 4 if missing.
            "prep_time": 20, // integer (minutes). 0 if missing.
            "total_time": 60, // integer (minutes). 0 if missing.
            "ingredients": [
                {
                    "amount": 2,    // number. If fraction "1/2", convert to 0.5. If string "2-3", use 2.5. If null, use 1 or 0 (never null).
                    "unit": "Stück", // Standardized German unit (e.g. g, kg, l, ml, Stück, EL, TL, Pkg, Prise, Bund, Dose)
                    "name": "Eier", // Standardized German ingredient name
                    "alternative_names": ["Ei", "Eier", "Hühnerei"] // Array of ALL possible synonyms, singular/plural forms, and generic terms to help matching against a database.
                }
            ],
            "steps": [
                "Step 1...",
                "Step 2..."
            ]
        }
        
        IMPORTANT:
        - Output strictly valid JSON.
        - Translate all text (instructions, names, category, tags) to GERMAN.
        - Ensure "amount" is a JSON Number, not a string. Handle ranges or fractions by converting to decimal number.
        - "prep_time" and "total_time" must be in MINUTES (integer). Parse "1h 30m" to 90.
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "You are a recipe parser. Return strictly valid JSON." }, { role: "user", content: prompt }],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log('DEBUG: AI Result Image URL:', result.image_url);
        res.json(result);

    } catch (err) {
        console.error('AI Parse Error:', err);
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
                where: { category: { [require('sequelize').Op.ne]: null } },
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

        } else if (type === 'manufacturer') {
            prompt = `
            You are a grocery expert for the German market. I have a list of products missing manufacturer/brand information.
            
            Products:
            [${productNames}]

            For each product, suggest a list of 3-5 common manufacturers/brands typically found in German supermarkets (e.g. Rewe, Edeka, Aldi brands or major brands like Dr. Oetker, Nestle, etc.).
            
            Return a JSON object:
            {
                "results": [
                    { "name": "Product Name", "manufacturers": ["Brand A", "Brand B", "Brand C"] }
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

        res.json(mappedResults);

    } catch (err) {
        console.error('AI Cleanup Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Single Product Lookup Endpoint
router.post('/lookup', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        const openai = new OpenAI({ apiKey: setting.value });

        // Get existing categories for context
        const existingCategories = await Product.findAll({
            attributes: ['category'],
            group: ['category'],
            where: { category: { [require('sequelize').Op.ne]: null } },
            raw: true
        });
        const categoryList = existingCategories.map(c => c.category).filter(Boolean).join(', ');

        const prompt = `
        You are a grocery expert for the German market.
        Product to analyze: "${name}"

        Existing Categories: [${categoryList}]

        1. Assign the best fitting category from the existing list, or suggest a new sensible German category.
        2. Suggest the most common sales unit (e.g. Stück, Packung, Flasche, Dose, kg, g, Liter).
        3. Suggest a numeric amount for the unit (e.g. 1).
        4. Suggest a list of 3-5 common manufacturers/brands for this product in Germany.

        Return a JSON object:
        {
            "category": "Category Name",
            "unit": "Unit Name (WITHOUT amount!)",
            "amount": 1,
            "manufacturers": ["Brand A", "Brand B", "Brand C"]
        }
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant that outputs strictly JSON." },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);
        res.json(result);

    } catch (err) {
        console.error('AI Lookup Error:', err);
        res.status(500).json({ error: err.message });
    }
});

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
            size: "1024x1024",
            quality: "standard",
        });

        const imageUrl = response.data[0].url;
        res.json({ url: imageUrl });

    } catch (err) {
        console.error('Image Generation Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
