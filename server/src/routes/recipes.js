const express = require('express');
const router = express.Router();
const { Recipe, RecipeIngredient, Product, Manufacturer, Tag } = require('../models');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../public/uploads/recipes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
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

const axios = require('axios'); // Ensure axios is required

// Create recipe
router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, category, prep_time, duration, servings, instructions, tags } = req.body;

        let finalImageUrl = null;
        if (req.file) {
            finalImageUrl = `/uploads/recipes/${req.file.filename}`;
        } else if (req.body.image_url) {
            if (req.body.image_url.startsWith('http')) {
                finalImageUrl = await downloadImage(req.body.image_url);
            } else {
                finalImageUrl = req.body.image_url;
            }
        }

        const recipe = await Recipe.create({
            title,
            category,
            prep_time: parseInt(prep_time) || 0,
            duration: parseInt(duration) || 0,
            servings: parseInt(servings) || 1,
            instructions: instructions ? (typeof instructions === 'string' ? JSON.parse(instructions) : instructions) : [],
            image_url: finalImageUrl
        });

        // Handle Tags
        if (tags) {
            const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
            if (Array.isArray(parsedTags)) {
                for (const tagName of parsedTags) {
                    const [tag] = await Tag.findOrCreate({ where: { name: tagName } });
                    await recipe.addTag(tag);
                }
            }
        }

        const reloaded = await Recipe.findByPk(recipe.id, { include: [Tag] });
        res.status(201).json(reloaded);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Update recipe
router.put('/:id', auth, upload.single('image'), async (req, res) => {
    try {
        const recipe = await Recipe.findByPk(req.params.id);
        if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

        const { title, category, prep_time, duration, servings, instructions, tags } = req.body;
        const updates = {
            title, category,
            prep_time: parseInt(prep_time) || 0,
            duration: parseInt(duration) || 0,
            servings: parseInt(servings) || 1,
            instructions: instructions ? JSON.parse(instructions) : undefined
        };

        if (req.file) {
            updates.image_url = `/uploads/recipes/${req.file.filename}`;
        } else if (req.body.image_url !== undefined) {
            if (req.body.image_url.startsWith('http')) {
                const downloaded = await downloadImage(req.body.image_url);
                if (downloaded) updates.image_url = downloaded;
            } else {
                updates.image_url = req.body.image_url;
            }
        }

        await recipe.update(updates);

        // Handle Tags
        if (tags !== undefined) {
            const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
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
        res.json(reloaded);
    } catch (err) {
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
    try {
        // Dependencies (Ingredients) should be deleted via Cascade or manually
        await RecipeIngredient.destroy({ where: { RecipeId: req.params.id } });
        const recipe = await Recipe.findByPk(req.params.id);
        if (recipe) await recipe.destroy();
        res.json({ message: 'Recipe deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
