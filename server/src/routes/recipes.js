const express = require('express');
const router = express.Router();
const { Recipe, RecipeIngredient, Product, Tag, Menu, RecipeTag, sequelize, User, RecipeSubstitution } = require('../models');
const { auth } = require('../middleware/auth');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { optimizeImage } = require('../utils/imageOptimizer');
const { recordVisit } = require('../utils/visitorTracker');
// const axios = require('axios'); // Removed for compliance

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // userId is available on req.user if auth middleware ran BEFORE multer
        // But multer often runs before. However, our routes have 'auth' before 'upload.single'.
        const userId = req.user ? req.user.effectiveId : 'unknown';
        const uploadDir = path.join(__dirname, `../../public/uploads/users/${userId}/recipes`);
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
        const tags = await Tag.findAll({
            where: { UserId: req.user.effectiveId },
            order: [['name', 'ASC']]
        });
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all recipes (optimized for list view). Now includes both own and favorited community recipes for the whole household.
router.get('/', auth, async (req, res) => {
    try {
        const householdUsers = await User.findAll({
            where: {
                [Op.or]: [
                    { id: req.user.effectiveId },
                    { householdId: req.user.effectiveId }
                ]
            },
            attributes: ['id', 'username']
        });
        const householdUserIds = householdUsers.map(u => u.id);

        const recipes = await Recipe.findAll({
            where: {
                [Op.or]: [
                    { UserId: req.user.effectiveId },
                    { '$FavoritedBy.id$': { [Op.in]: householdUserIds } }
                ]
            },
            attributes: ['id', 'title', 'category', 'image_url', 'prep_time', 'duration', 'servings', 'imageSource', 'createdAt', 'updatedAt', 'UserId', 'clicks'],
            include: [
                {
                    model: Tag,
                    where: { UserId: req.user.effectiveId },
                    required: false,
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    // Lightweight ingredient include – only product name for search
                    model: RecipeIngredient,
                    where: { UserId: req.user.effectiveId },
                    required: false,
                    attributes: ['id'],
                    include: [{
                        model: Product,
                        where: { UserId: req.user.effectiveId },
                        required: false,
                        attributes: ['name']
                    }]
                },
                {
                    model: User,
                    as: 'FavoritedBy',
                    where: { id: { [Op.in]: householdUserIds } },
                    required: false,
                    attributes: ['id', 'username']
                },
                {
                    model: Menu,
                    required: false,
                    attributes: ['id']
                },
                {
                    model: RecipeSubstitution,
                    where: { UserId: req.user.effectiveId },
                    required: false,
                    attributes: ['id']
                }
            ],
            order: [['title', 'ASC']]
        });

        // Add an explicit isFavorite flag based on the relation for the frontend, and favoritedBy array
        const mappedRecipes = recipes.map(r => {
            const plain = r.get({ plain: true });
            plain.isFavorite = plain.FavoritedBy && plain.FavoritedBy.some(u => u.id === req.user.id);
            plain.favoritedBy = plain.FavoritedBy ? plain.FavoritedBy.map(u => u.username) : [];
            plain.cookCount = plain.Menus ? plain.Menus.length : 0;
            plain.hasSubstitutions = plain.RecipeSubstitutions && plain.RecipeSubstitutions.length > 0;
            delete plain.FavoritedBy; // clean up payload
            delete plain.Menus;
            delete plain.RecipeSubstitutions;
            return plain;
        });

        res.json(mappedRecipes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public recipe details (No Auth)
router.get('/public/:sharingKey/:id', async (req, res) => {
    try {
        const { sharingKey, id } = req.params;
        const { User } = require('../models');
        const user = await User.findOne({ where: { sharingKey } });

        if (!user) return res.status(403).json({ error: 'Ungültiger Freigabe-Link.' });
        if (!user.isPublicCookbook) return res.status(403).json({ error: 'Dieses Kochbuch ist privat.' });

        // Check for ban
        if (user.bannedAt) {
            return res.status(403).json({ error: 'Dieses Kochbuch wurde aufgrund eines Verstoßes gesperrt.' });
        }

        // Increment clicks (only if unique visitor in window)
        if (await recordVisit(req, 'cookbook', user.id)) {
            await user.increment('cookbookClicks');
        }

        const recipe = await Recipe.findOne({
            where: { id: id, UserId: user.id },
            attributes: ['id', 'title', 'category', 'image_url', 'prep_time', 'duration', 'servings', 'imageSource', 'instructions', 'clicks'],
            include: [
                {
                    model: RecipeIngredient,
                    where: { UserId: user.id },
                    required: false,
                    include: [{ model: Product, where: { UserId: user.id }, required: false }]
                },
                { model: Tag, where: { UserId: user.id }, required: false }
            ]
        });

        if (!recipe) return res.status(404).json({ error: 'Recipe not found or unauthorized' });

        if (recipe.bannedAt) {
            return res.status(403).json({ error: 'Dieses Rezept wurde aufgrund eines Verstoßes gesperrt.' });
        }

        // Increment recipe clicks (only if unique visitor in window)
        if (await recordVisit(req, 'recipe', recipe.id)) {
            await recipe.increment('clicks');
        }

        // Hide image if scraped
        const plain = recipe.get({ plain: true });
        if (plain.imageSource === 'scraped') {
            plain.image_url = null;
        }
        // Include user info for display
        plain.ownerUsername = user.username;
        plain.cookbookTitle = user.cookbookTitle;
        res.json(plain);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Optional Auth Middleware for Public Routes
// Let's implement a quick inline optional check using the existing jwt logic, or just write it here.
const jwt = require('jsonwebtoken');

const checkOptionalAuth = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return next();

    const token = authHeader.replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { User } = require('../models');
        const user = await User.findByPk(decoded.id);
        if (user) {
            // For households, same logic as auth middleware
            req.user = {
                ...user.get({ plain: true }),
                effectiveId: user.householdId || user.id
            };
        }
    } catch (err) {
        // Ignore errors, treating as unauthenticated
    }
    next();
};

// Public recipes list (Optional Auth)
router.get('/public/:sharingKey', checkOptionalAuth, async (req, res) => {
    try {
        const { sharingKey } = req.params;
        const { User } = require('../models');
        const listOwner = await User.findOne({ where: { sharingKey } });

        if (!listOwner) return res.status(403).json({ error: 'Ungültiger Freigabe-Link.' });
        if (!listOwner.isPublicCookbook) return res.status(403).json({ error: 'Dieses Kochbuch ist privat.' });

        // Check for ban
        if (listOwner.bannedAt) {
            return res.status(403).json({ error: 'Dieses Kochbuch wurde aufgrund eines Verstoßes gesperrt.' });
        }

        // Increment clicks (only if unique visitor in window)
        if (await recordVisit(req, 'cookbook', listOwner.id)) {
            await listOwner.increment('cookbookClicks');
        }

        const includeArr = [
            {
                model: Tag,
                where: { UserId: listOwner.id },
                required: false,
                attributes: ['id', 'name'],
                through: { attributes: [] }
            },
            {
                model: User,
                as: 'FavoritedBy',
                required: false,
                attributes: ['id', 'username']
            },
            {
                model: Menu,
                required: false,
                attributes: ['id']
            },
            {
                // Lightweight ingredient count
                model: RecipeIngredient,
                where: { UserId: listOwner.id },
                required: false,
                attributes: ['id']
            }
        ];

        const recipes = await Recipe.findAll({
            where: {
                UserId: listOwner.id,
                bannedAt: null // Exclude banned recipes from list
            },
            attributes: ['id', 'title', 'category', 'image_url', 'prep_time', 'duration', 'servings', 'imageSource', 'clicks'],
            include: includeArr,
            order: [['title', 'ASC']]
        });

        // Filter out images where source is 'scraped' for public view, and set isFavorite flag
        const sanitizedRecipes = recipes.map(r => {
            const plain = r.get({ plain: true });
            if (plain.imageSource === 'scraped') {
                plain.image_url = null; // Hide image
            }
            if (req.user) {
                plain.isFavorite = !!(plain.FavoritedBy && plain.FavoritedBy.some(u => u.id === req.user.id));
            } else {
                plain.isFavorite = false;
            }
            plain.favoritedBy = plain.FavoritedBy ? plain.FavoritedBy.map(u => u.username) : [];
            plain.cookCount = plain.Menus ? plain.Menus.length : 0;
            delete plain.FavoritedBy;
            delete plain.Menus;
            return plain;
        });

        res.json({
            recipes: sanitizedRecipes,
            cookbookTitle: listOwner.cookbookTitle,
            cookbookImage: listOwner.cookbookImage
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get recipe details
router.get('/:id', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { User } = require('../models');

        const householdUsers = await User.findAll({
            where: {
                [Op.or]: [
                    { id: req.user.effectiveId },
                    { householdId: req.user.effectiveId }
                ]
            },
            attributes: ['id']
        });
        const householdUserIds = householdUsers.map(u => u.id);

        const recipe = await Recipe.findOne({
            where: {
                id: req.params.id,
                [Op.or]: [
                    { UserId: req.user.effectiveId },
                    { '$FavoritedBy.id$': { [Op.in]: householdUserIds } }
                ]
            },
            include: [
                {
                    model: RecipeIngredient,
                    required: false,
                    include: [{ model: Product, required: false }]
                },
                { model: Tag, required: false },
                {
                    model: User,
                    as: 'FavoritedBy',
                    required: false,
                    attributes: ['id']
                },
                {
                    model: RecipeSubstitution,
                    where: { UserId: req.user.effectiveId },
                    required: false,
                    include: [
                        { model: Product, as: 'OriginalProduct' },
                        { model: Product, as: 'SubstituteProduct' }
                    ]
                }
            ]
        });
        if (!recipe) return res.status(404).json({ error: 'Recipe not found or unauthorized' });

        // Format response so frontend doesn't break
        const plain = recipe.get({ plain: true });
        plain.isFavorite = !!(plain.FavoritedBy && plain.FavoritedBy.some(u => u.id === req.user.id));
        plain.substitutions = plain.RecipeSubstitutions || [];
        delete plain.FavoritedBy;
        delete plain.RecipeSubstitutions;

        res.json(plain);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to download image - REMOVED for GDPR/Copyright compliance
// const downloadImage = async (url, userId) => { ... }

// Check recipe usage
router.get('/:id/usage', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastCount = await Menu.count({
            where: {
                RecipeId: req.params.id,
                UserId: req.user.effectiveId,
                date: { [Op.lt]: today }
            }
        });

        const futureCount = await Menu.count({
            where: {
                RecipeId: req.params.id,
                UserId: req.user.effectiveId,
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
            const { path: optimizedPath } = await optimizeImage(req.file.path);
            const finalFilename = path.basename(optimizedPath);
            finalImageUrl = `/uploads/users/${req.user.effectiveId}/recipes/${finalFilename}`;
        } else if (req.body.image_url) {
            // Only allow relative URLs (from our own system/AI generation)
            if (!req.body.image_url.startsWith('http')) {
                finalImageUrl = req.body.image_url;
            } else {
                console.log('External URL provided, ignoring for compliance:', req.body.image_url);
                finalImageUrl = null;
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
            imageSource: req.body.imageSource || (finalImageUrl ? (req.file ? 'upload' : 'scraped') : 'none'),
            UserId: req.user.effectiveId
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
                            const [tag] = await Tag.findOrCreate({
                                where: { name: tagName.trim(), UserId: req.user.effectiveId },
                                defaults: { UserId: req.user.effectiveId }
                            });
                            await recipe.addTag(tag);
                        }
                    }
                }
            } catch (tagErr) {
                console.error('Tag processing error:', tagErr);
            }
        }

        const reloaded = await Recipe.findOne({
            where: { id: recipe.id, UserId: req.user.effectiveId },
            include: [{ model: Tag, where: { UserId: req.user.effectiveId }, required: false }]
        });
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
        const recipe = await Recipe.findOne({ where: { id: req.params.id, UserId: req.user.effectiveId } });
        if (!recipe) {
            console.log('Recipe not found or unauthorized');
            return res.status(404).json({ error: 'Recipe not found or unauthorized' });
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
            const { path: optimizedPath } = await optimizeImage(req.file.path);
            const finalFilename = path.basename(optimizedPath);
            updates.image_url = `/uploads/users/${req.user.effectiveId}/recipes/${finalFilename}`;
            if (!updates.imageSource) updates.imageSource = 'upload';
        } else if (req.body.image_url !== undefined) {
            console.log('New image URL:', req.body.image_url);
            // Handle explicit removal (empty string or "null" string)
            if (req.body.image_url === '' || req.body.image_url === 'null' || req.body.image_url === null) {
                updates.image_url = null;
            } else if (req.body.image_url.startsWith('http')) {
                const downloaded = await downloadImage(req.body.image_url, req.user.effectiveId);
                if (downloaded) {
                    updates.image_url = downloaded;
                } else {
                    updates.image_url = req.body.image_url;
                }
            } else {
                updates.image_url = req.body.image_url;
            }
        }

        // Logic to ensure imageSource consistency
        // If the resulting image is empty, source MUST be 'none'
        const resultingImage = updates.image_url !== undefined ? updates.image_url : recipe.image_url;
        if (!resultingImage) {
            updates.imageSource = 'none';
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
                    const [tag] = await Tag.findOrCreate({
                        where: { name: tagName, UserId: req.user.effectiveId },
                        defaults: { UserId: req.user.effectiveId }
                    });
                    tagInstances.push(tag);
                }
                await recipe.setTags(tagInstances);
            }
        }

        const reloaded = await Recipe.findOne({
            where: { id: recipe.id, UserId: req.user.effectiveId },
            include: [{ model: Tag, where: { UserId: req.user.effectiveId }, required: false }]
        });
        console.log('--- RECIPE UPDATE SUCCESS ---');
        res.json(reloaded);
    } catch (err) {
        console.error('--- RECIPE UPDATE ERROR ---', err);
        res.status(500).json({ error: err.message });
    }
});

// Toggle Favorite
router.post('/:id/favorite', auth, async (req, res) => {
    try {
        console.log(`[POST /favorite] Incoming for recipe ${req.params.id}, user: ${req.user.id}`);
        const recipe = await Recipe.findByPk(req.params.id);
        if (!recipe) {
            console.log(`[POST /favorite] Recipe ${req.params.id} not found in DB`);
            return res.status(404).json({ error: 'Recipe not found' });
        }

        // We could add logic to ensure the recipe is either owned by the user,
        // or belongs to a public cookbook. For now, we assume if they can see it,
        // they can favorite it.

        const user = await User.findByPk(req.user.id);
        if (!user) {
            console.log(`[PATCH /favorite] User ${req.user.id} not found in DB`);
            return res.status(404).json({ error: 'User not found' });
        }

        const isFavorited = await user.hasFavorite(recipe);

        if (isFavorited) {
            await user.removeFavorite(recipe);
            res.json({ id: recipe.id, isFavorite: false });
        } else {
            await user.addFavorite(recipe);
            res.json({ id: recipe.id, isFavorite: true });
        }
    } catch (err) {
        console.error('Toggle favorite error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add ingredient
router.post('/:id/ingredients', auth, async (req, res) => {
    try {
        const { ProductId, quantity, unit } = req.body;
        const ingredient = await RecipeIngredient.create({
            RecipeId: req.params.id,
            UserId: req.user.effectiveId,
            ProductId,
            quantity,
            unit
        });
        const withProduct = await RecipeIngredient.findOne({
            where: { id: ingredient.id, UserId: req.user.effectiveId },
            include: [{
                model: Product,
                where: { UserId: req.user.effectiveId },
                required: false
            }]
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
        const recipe = await Recipe.findOne({ where: { id: req.params.id, UserId: req.user.effectiveId }, transaction: t });
        if (!recipe) {
            console.log('Recipe record not found or unauthorized');
            await t.rollback();
            return res.json({ message: 'Recipe already deleted or unauthorized' });
        }

        // 1. Remove Ingredients
        console.log('Removing Ingredients...');
        await RecipeIngredient.destroy({ where: { RecipeId: req.params.id, UserId: req.user.effectiveId }, transaction: t });

        // 2. Remove from Menus
        console.log('Unlinking from Menus...');
        await Menu.update({ RecipeId: null }, { where: { RecipeId: req.params.id, UserId: req.user.effectiveId }, transaction: t });

        // 3. Remove Tags
        if (RecipeTag) {
            console.log('Removing Tag Links...');
            // Check if table exists (simplified check by just trying)
            await RecipeTag.destroy({ where: { RecipeId: req.params.id, UserId: req.user.effectiveId }, transaction: t });
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
