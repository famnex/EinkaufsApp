const express = require('express');
const router = express.Router();
const { RecipeSubstitution, Product, Recipe, RecipeInstructionOverride } = require('../models');
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
            substituteName,
            originalQuantity,
            originalUnit,
            substituteQuantity,
            substituteUnit,
            isOmitted
        } = req.body;
        const userId = req.user.householdId || req.user.id;

        let finalSubstituteId = substituteProductId;

        if (!finalSubstituteId && substituteName && !isOmitted) {
            // Try to find product by name
            let product = await Product.findOne({
                where: {
                    name: substituteName,
                    UserId: [userId, null] // Check user-specific and global products
                }
            });

            if (!product) {
                // Create new AI product
                product = await Product.create({
                    name: substituteName,
                    UserId: userId,
                    source: 'ai'
                });
            }
            finalSubstituteId = product.id;
        }

        const [substitution, created] = await RecipeSubstitution.findOrCreate({
            where: {
                RecipeId: recipeId,
                originalProductId: originalProductId,
                UserId: userId
            },
            defaults: {
                substituteProductId: finalSubstituteId,
                originalQuantity,
                originalUnit,
                substituteQuantity,
                substituteUnit,
                isOmitted: isOmitted || false
            }
        });

        if (!created) {
            substitution.substituteProductId = finalSubstituteId;
            substitution.originalQuantity = originalQuantity;
            substitution.originalUnit = originalUnit;
            substitution.substituteQuantity = substituteQuantity;
            substitution.substituteUnit = substituteUnit;
            substitution.isOmitted = isOmitted || false;
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

        const { RecipeId } = substitution;
        await substitution.destroy();

        // Also delete instruction override because substitutions changed
        await RecipeInstructionOverride.destroy({
            where: {
                RecipeId,
                UserId: req.user.householdId || req.user.id
            }
        });
        res.json({ message: 'Substitution deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
