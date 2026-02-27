const express = require('express');
const router = express.Router();
const { RecipeSubstitution, Product, Recipe } = require('../models');
const { auth } = require('../middleware/auth');

// Get substitutions for a recipe
router.get('/recipe/:recipeId', auth, async (req, res) => {
    try {
        const substitutions = await RecipeSubstitution.findAll({
            where: {
                RecipeId: req.params.recipeId,
                UserId: req.user.householdId || req.user.id
            },
            include: [
                { model: Product, as: 'OriginalProduct' },
                { model: Product, as: 'SubstituteProduct' }
            ]
        });
        res.json(substitutions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create or update substitution
router.post('/', auth, async (req, res) => {
    try {
        const {
            recipeId,
            originalProductId,
            substituteProductId,
            originalQuantity,
            originalUnit,
            substituteQuantity,
            substituteUnit
        } = req.body;
        const userId = req.user.householdId || req.user.id;

        const [substitution, created] = await RecipeSubstitution.findOrCreate({
            where: {
                RecipeId: recipeId,
                originalProductId: originalProductId,
                UserId: userId
            },
            defaults: {
                substituteProductId: substituteProductId,
                originalQuantity,
                originalUnit,
                substituteQuantity,
                substituteUnit
            }
        });

        if (!created) {
            substitution.substituteProductId = substituteProductId;
            substitution.originalQuantity = originalQuantity;
            substitution.originalUnit = originalUnit;
            substitution.substituteQuantity = substituteQuantity;
            substitution.substituteUnit = substituteUnit;
            await substitution.save();
        }

        const fullSub = await RecipeSubstitution.findByPk(substitution.id, {
            include: [
                { model: Product, as: 'OriginalProduct' },
                { model: Product, as: 'SubstituteProduct' }
            ]
        });

        res.json(fullSub);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete substitution
router.delete('/:id', auth, async (req, res) => {
    try {
        const substitution = await RecipeSubstitution.findOne({
            where: {
                id: req.params.id,
                UserId: req.user.householdId || req.user.id
            }
        });

        if (!substitution) {
            return res.status(404).json({ error: 'Substitution not found' });
        }

        await substitution.destroy();
        res.json({ message: 'Substitution deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
