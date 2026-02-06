const express = require('express');
const router = express.Router();
const { Recipe, RecipeIngredient, Product, Manufacturer, Tag, Menu, RecipeTag, sequelize } = require('../models');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../public/uploads/recipes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        console.log(' Multer: Saving file to:', uploadDir); // DEBUG LOG
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Get all tags
router.get('/tags', auth, async (req, res) => {
    try {
        const tags = await Tag.findAll({ order: [['name', 'ASC']] });
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all recipes
router.get('/', auth, async (req, res) => {
    try {
        const recipes = await Recipe.findAll({
            include: [
                Tag,
                {
                    model: RecipeIngredient,
                    include: [Product]
                }
            ],
            order: [['title', 'ASC']]
        });
        res.json(recipes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public recipe details (No Auth)
router.get('/public/:id', async (req, res) => {
    try {
        const recipe = await Recipe.findByPk(req.params.id, {
            include: [
                {
                    model: RecipeIngredient,
                    include: [{ model: Product, include: [Manufacturer] }]
                },
                Tag
            ]
        });
        if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

        // Hide image if scraped
        const plain = recipe.get({ plain: true });
        if (plain.imageSource === 'scraped') {
            plain.image_url = null;
        }
        res.json(plain);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public recipes list (No Auth)
router.get('/public', async (req, res) => {
    try {
        const recipes = await Recipe.findAll({
            attributes: ['id', 'title', 'category', 'image_url', 'prep_time', 'duration', 'servings', 'imageSource'],
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: RecipeIngredient,
                    include: [
                        { model: Product, attributes: ['name'] }
                    ]
                }
            ],
            order: [['title', 'ASC']]
        });

        // Filter out images where source is 'scraped' for public view
        const sanitizedRecipes = recipes.map(r => {
            const plain = r.get({ plain: true });
            if (plain.imageSource === 'scraped') {
                plain.image_url = null; // Hide image
            }
            return plain;
        });

        res.json(sanitizedRecipes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get recipe details
router.get('/:id', auth, async (req, res) => {
    try {
        const recipe = await Recipe.findByPk(req.params.id, {
            include: [
                {
                    model: RecipeIngredient,
                    include: [{ model: Product, include: [Manufacturer] }]
                },
                Tag
            ]
        });
        if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
        res.json(recipe);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to download image
const downloadImage = async (url) => {
    try {
        const response = await axios({
            url,
            responseType: 'stream'
        });
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + '.jpg'; // Assume jpg for simplicity or derive from content-type
        const uploadDir = path.join(__dirname, '../../public/uploads/recipes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        console.log(' DownloadImage: Saving to:', uploadDir); // DEBUG LOG
        const filepath = path.join(uploadDir, filename);

        await new Promise((resolve, reject) => {
            response.data.pipe(fs.createWriteStream(filepath))
                .on('finish', resolve)
                .on('error', reject);
        });

        return `/uploads/recipes/${filename}`;
    } catch (err) {
        console.error('Image download failed:', err.message);
        return null; // Fallback to null or original URL if strict
    }
};



// Check recipe usage
router.get('/:id/usage', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastCount = await Menu.count({
            where: {
                RecipeId: req.params.id,
                date: { [Op.lt]: today }
            }
        });

        const futureCount = await Menu.count({
            where: {
                RecipeId: req.params.id,
                date: { [Op.gte]: today }
            }
        });

        res.json({ past: pastCount, future: futureCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create recipe
router.post('/', auth, upload.single('image'), async (req, res) => {
    console.log('--- RECIPE CREATE START ---');
    console.log('User:', req.user ? req.user.username : 'Unknown');
    // Log body keys since values might be large
    console.log('Body Keys:', Object.keys(req.body));
    if (req.file) console.log('File:', req.file.filename);

    try {
        const { title, category, prep_time, duration, servings, instructions, tags } = req.body;

        console.log('Title:', title);
        console.log('Instructions Type:', typeof instructions);

        let finalImageUrl = null;
        if (req.file) {
            finalImageUrl = `/uploads/recipes/${req.file.filename}`;
        } else if (req.body.image_url) {
            console.log('Process image URL:', req.body.image_url);
            if (req.body.image_url.startsWith('http')) {
                try {
                    const downloaded = await downloadImage(req.body.image_url);
                    if (downloaded) {
                        finalImageUrl = downloaded;
                        console.log('Downloaded image to:', finalImageUrl);
                    } else {
                        console.log('Download returned null, using original URL');
                        finalImageUrl = req.body.image_url;
                    }
                } catch (dlErr) {
                    console.error('Download Image Crushed:', dlErr);
                    finalImageUrl = req.body.image_url;
                }
            } else {
                finalImageUrl = req.body.image_url;
            }
        }

        // Parse JSON fields safely
        let parsedInstructions = [];
        try {
            parsedInstructions = instructions ? (typeof instructions === 'string' ? JSON.parse(instructions) : instructions) : [];
        } catch (e) {
            console.error('Failed to parse instructions:', e);
            parsedInstructions = [instructions]; // Fallback as single step
        }

        const recipe = await Recipe.create({
            title: title || 'Untitled Recipe',
            category,
            prep_time: parseInt(prep_time) || 0,
            duration: parseInt(duration) || 0,
            servings: parseInt(servings) || 1,
            instructions: parsedInstructions,
            image_url: finalImageUrl,
            imageSource: req.body.imageSource || (finalImageUrl ? (req.file ? 'upload' : 'scraped') : 'scraped')
        });
        console.log('Recipe Created ID:', recipe.id);

        // Handle Tags
        if (tags) {
            try {
                const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
                console.log('Processing Tags:', parsedTags);
                if (Array.isArray(parsedTags)) {
                    for (const tagName of parsedTags) {
                        // Ensure tag name is valid string
                        if (typeof tagName === 'string' && tagName.trim()) {
                            const [tag] = await Tag.findOrCreate({ where: { name: tagName.trim() } });
                            await recipe.addTag(tag);
                        }
                    }
                }
            } catch (tagErr) {
                console.error('Tag processing error:', tagErr);
            }
        }

        const reloaded = await Recipe.findByPk(recipe.id, { include: [Tag] });
        console.log('--- RECIPE CREATE SUCCESS ---');
        res.status(201).json(reloaded);
    } catch (err) {
        console.error('--- RECIPE CREATE ERROR ---', err);
        console.error(err.stack);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Update recipe
router.put('/:id', auth, upload.single('image'), async (req, res) => {
    console.log('--- RECIPE UPDATE START ---', req.params.id);
    console.log('Body:', JSON.stringify(req.body, null, 2).substring(0, 500) + '...'); // Truncate to avoid massive logs

    try {
        const recipe = await Recipe.findByPk(req.params.id);
        if (!recipe) {
            console.log('Recipe not found');
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const { title, category, prep_time, duration, servings, instructions, tags } = req.body;
        const updates = {
            title, category,
            prep_time: parseInt(prep_time) || 0,
            duration: parseInt(duration) || 0,
            servings: parseInt(servings) || 1,
            instructions: instructions ? JSON.parse(instructions) : undefined,
            imageSource: req.body.imageSource
        };

        if (req.file) {
            console.log('New file uploaded:', req.file.filename);
            updates.image_url = `/uploads/recipes/${req.file.filename}`;
        } else if (req.body.image_url !== undefined) {
            console.log('New image URL:', req.body.image_url);
            if (req.body.image_url.startsWith('http')) {
                const downloaded = await downloadImage(req.body.image_url);
                if (downloaded) updates.image_url = downloaded;
            } else {
                updates.image_url = req.body.image_url;
            }
        }

        await recipe.update(updates);
        console.log('Recipe updated');

        // Handle Tags
        if (tags !== undefined) {
            const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
            console.log('Updating Tags:', parsedTags);
            if (Array.isArray(parsedTags)) {
                const tagInstances = [];
                for (const tagName of parsedTags) {
                    const [tag] = await Tag.findOrCreate({ where: { name: tagName } });
                    tagInstances.push(tag);
                }
                await recipe.setTags(tagInstances);
            }
        }

        const reloaded = await Recipe.findByPk(recipe.id, { include: [Tag] });
        console.log('--- RECIPE UPDATE SUCCESS ---');
        res.json(reloaded);
    } catch (err) {
        console.error('--- RECIPE UPDATE ERROR ---', err);
        res.status(500).json({ error: err.message });
    }
});

// Add ingredient
router.post('/:id/ingredients', auth, async (req, res) => {
    try {
        const { ProductId, quantity, unit } = req.body;
        const ingredient = await RecipeIngredient.create({
            RecipeId: req.params.id,
            ProductId,
            quantity,
            unit
        });
        const withProduct = await RecipeIngredient.findByPk(ingredient.id, {
            include: [{ model: Product, include: [Manufacturer] }]
        });
        res.status(201).json(withProduct);
    } catch (err) {
        console.error('Add Ingredient Error:', err);
        res.status(500).json({ error: err.message, details: err.errors });
    }
});

// Update ingredient
router.put('/:id/ingredients/:ingredientId', auth, async (req, res) => {
    try {
        const { quantity, unit } = req.body;
        const ingredient = await RecipeIngredient.findOne({
            where: { id: req.params.ingredientId, RecipeId: req.params.id }
        });
        if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });

        await ingredient.update({ quantity, unit });
        res.json(ingredient);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove ingredient
router.delete('/:id/ingredients/:ingredientId', auth, async (req, res) => {
    try {
        const ingredient = await RecipeIngredient.findOne({
            where: { id: req.params.ingredientId, RecipeId: req.params.id }
        });
        if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });
        await ingredient.destroy();
        res.json({ message: 'Ingredient removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Recipe
router.delete('/:id', auth, async (req, res) => {
    // Start transaction
    const t = await sequelize.transaction();
    console.log('--- RECIPE DELETE START ---', req.params.id);

    try {
        const recipe = await Recipe.findByPk(req.params.id, { transaction: t });
        if (!recipe) {
            console.log('Recipe record not found');
            await t.rollback();
            return res.json({ message: 'Recipe already deleted' });
        }

        // 1. Remove Ingredients
        console.log('Removing Ingredients...');
        await RecipeIngredient.destroy({ where: { RecipeId: req.params.id }, transaction: t });

        // 2. Remove from Menus
        console.log('Unlinking from Menus...');
        await Menu.update({ RecipeId: null }, { where: { RecipeId: req.params.id }, transaction: t });

        // 3. Remove Tags
        if (RecipeTag) {
            console.log('Removing Tag Links...');
            // Check if table exists (simplified check by just trying)
            await RecipeTag.destroy({ where: { RecipeId: req.params.id }, transaction: t });
        }

        // 4. Capture image path for later deletion (Post-commit to avoid deleting if DB fail)
        const imageToDelete = recipe.image_url;

        // 5. Destroy Recipe
        console.log('Destroying Recipe record...');
        await recipe.destroy({ transaction: t });

        // Commit transaction
        await t.commit();
        console.log('--- DATABASE DELETE SUCCESS ---');

        // 6. Delete Image File (Best effort, non-blocking)
        if (imageToDelete && !imageToDelete.startsWith('http')) {
            try {
                // image_url is like /uploads/recipes/xxx.jpg
                //We need to go from src/routes -> ... -> public
                const publicDir = path.join(__dirname, '../../public');
                const fullPath = path.join(publicDir, imageToDelete);
                console.log('Attempting to delete image:', fullPath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    console.log('Image deleted.');
                } else {
                    console.log('Image file not found:', fullPath);
                }
            } catch (fileErr) {
                console.error('Failed to delete image file:', fileErr.message);
                // Do not fail the request since DB is consistent
            }
        }

        res.json({ message: 'Recipe deleted' });
    } catch (err) {
        // Only rollback if transaction is active (it should be)
        if (t) await t.rollback();
        console.error('--- RECIPE DELETE ERROR ---');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({ error: 'Delete failed: ' + err.message });
    }
});

module.exports = router;
