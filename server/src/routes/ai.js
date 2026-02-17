const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const { Settings, Recipe, Product, Tag, HiddenCleanup } = require('../models');
const { auth } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

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
            where: { UserId: req.user.effectiveId },
            raw: true
        });
        const categoryList = existingCategories
            .map(c => c.category)
            .filter(c => c) // remove nulls
            .join(', ');

        const existingTags = await Tag.findAll({
            where: { UserId: req.user.effectiveId },
            attributes: ['name'],
            raw: true
        });
        const tagList = existingTags.map(t => t.name).join(', ');

        let metaImage = null;

        // CRITICAL: Limit input size to prevent 429 Token Error (Limit ~30k tokens)
        // 15,000 chars is roughly 4k-5k tokens, leaving plenty of room for prompt + response
        if (input.length > 15000) {
            console.log(`DEBUG: Truncating input from ${input.length} to 15000 chars`);
            input = input.substring(0, 15000);
        }

        const openai = new OpenAI({ apiKey: setting.value });

        const prompt = `
        Analyze the recipe data below. It may be raw text or a JSON-LD object.
        Extract structured recipe data.
        
        Existing Categories in Database: [${categoryList}]
        Existing Tags in Database: [${tagList}]
        
        DATA:
        "${input}" 
        
        Return a JSON object with this EXACT structure:
        {
            "title": "Recipe Title",
            "description": "Short description (max 200 chars)",
            "category": "Suggested Category (Pick from existing if fits, or suggest new)",
            "tags": ["Tag1", "Tag2"], // Authentically describe the recipe. Use existing tags if applicable, or create new ones (e.g. "Vegetarisch", "Schnell", "Party", "Sommer"). Max 5 tags.
            "image_url": "URL found in data or meta tags (return null if none found)",
            "servings": 4, // integer. If range "4-6", average to 5. Default 2 if missing. YOu may also give an educated guess from the weight of the ingredients
            "prep_time": 20, // integer (minutes). 0 if missing. - Look at the recipe and give an educated guess
            "total_time": 60, // integer (minutes). 0 if missing. - Again, look at the times in the recipe and guess
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
                where: {
                    category: { [require('sequelize').Op.ne]: null },
                    UserId: req.user.effectiveId
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
            where: {
                category: { [require('sequelize').Op.ne]: null },
                UserId: req.user.effectiveId
            },
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

        const openai = new OpenAI({ apiKey: setting.value });

        const prompt = `
Du bist ein Experte für deutsche Lebensmittel und Zutaten.
Ich brauche einen Ersatz für "${productName}" ${context ? `für ${context}` : ''}.

Gib mir 5 gute Alternativen, die:
- In deutschen Supermärkten verfügbar sind
- Ähnliche Eigenschaften haben
- Praktisch austauschbar sind

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

        res.json({ suggestions });

    } catch (err) {
        console.error('AI Duplicate Detection Error:', err);
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

        try {
            const image = await Jimp.read(imageResponse.data);

            // Removed resize to keep full resolution (HD Landscape)
            // if (image.bitmap.height > 800) {
            //    image.resize(Jimp.AUTO, 800);
            // }

            await image
                .quality(100)
                .writeAsync(filepath);

            console.log('Processed AI Image (Jimp) saved to:', filepath);
        } catch (jimpError) {
            console.error('Jimp Optimization failed, saving raw:', jimpError);
            fs.writeFileSync(filepath, Buffer.from(imageResponse.data));
        }

        // Return local URL (relative)
        res.json({ url: `uploads/users/${req.user.effectiveId}/recipes/${filename}` });

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

            // 4. Save Result
            const uploadDir = path.join(__dirname, `../../public/uploads/users/${req.user.effectiveId}/recipes`);
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = uniqueSuffix + '.jpg';
            const filepath = path.join(uploadDir, filename);

            fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
            console.log('Regenerated Image saved to:', filepath);

            // Cleanup temp
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

            // Return RELATIVE URL
            res.json({ url: `uploads/users/${req.user.effectiveId}/recipes/${filename}` });

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
        res.json({ reply: result.reply, action: result.action });

    } catch (err) {
        console.error('AI Chat Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Extract Ingredients from Text/URL for Shopping List
router.post('/extract-list-ingredients', auth, async (req, res) => {
    try {
        let { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const setting = await Settings.findOne({ where: { key: 'openai_key' } });
        if (!setting || !setting.value) {
            return res.status(400).json({ error: 'OpenAI API Key not configured' });
        }

        // 1. Check for URL
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = text.match(urlRegex);

        let contentToAnalyze = text;

        if (urls && urls.length > 0) {
            const url = urls[0];
            console.log('Fetching content from URL:', url);

            try {
                const browser = await require('puppeteer').launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                const page = await browser.newPage();

                // Block images/css for speed
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

                // Extract text from body
                const bodyText = await page.evaluate(() => document.body.innerText);
                contentToAnalyze = `URL: ${url}\n\nCONTENT:\n${bodyText.substring(0, 20000)}`; // Limit content

                await browser.close();
            } catch (puppeteerErr) {
                console.error('Puppeteer Error:', puppeteerErr);
                // Fallback: Just analyze the URL itself and any surrounding text
                contentToAnalyze = `URL: ${url} (Fetch failed: ${puppeteerErr.message})\n\nOriginal Text:\n${text}`;
            }
        }

        const openai = new OpenAI({ apiKey: setting.value });

        const prompt = `
        Analyze the following text (which might be a recipe URL content or just plain text).
        Extract ALL ingredients that should be bought.
        
        TEXT/DATA:
        "${contentToAnalyze.substring(0, 15000)}"

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
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a shopping list assistant. Return strictly valid JSON." },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);
        res.json(result);

    } catch (err) {
        console.error('AI List Extraction Error:', err);
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

module.exports = router;
