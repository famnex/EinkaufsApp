const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const { Settings, Recipe, Product, Tag } = require('../models');
const { auth } = require('../middleware/auth');

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
