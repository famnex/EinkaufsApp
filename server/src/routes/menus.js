const express = require('express');
const router = express.Router();
const { Menu, Recipe, Product, RecipeIngredient, ListItem, Sequelize } = require('../models');
const { auth } = require('../middleware/auth');
const { Op } = require('sequelize');

// Get menus for a date range
// GET /api/menus?start=2024-02-01&end=2024-02-07
router.get('/', auth, async (req, res) => {
    try {
        const { start, end } = req.query;
        console.log(`[GET /api/menus] Fetching menus from ${start} to ${end}`);

        const where = {};
        if (start && end) {
            where.date = { [Op.between]: [start, end] };
        }

        const menus = await Menu.findAll({
            where: { ...where, UserId: req.user.id },
            include: [
                {
                    model: Recipe,
                    where: { UserId: req.user.id },
                    required: false,
                    include: [{
                        model: RecipeIngredient,
                        where: { UserId: req.user.id },
                        required: false,
                        include: [{ model: Product, where: { UserId: req.user.id }, required: false }]
                    }]
                },
                { model: ListItem, where: { UserId: req.user.id }, required: false }
            ],
            order: [['date', 'ASC'], ['meal_type', 'ASC']]
        });
        res.json(menus);
    } catch (err) {
        console.error('CRITICAL ERROR in GET /api/menus:', err);
        console.error('Stack:', err.stack);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Create menu entry
router.post('/', auth, async (req, res) => {
    try {
        const { date, meal_type, description, RecipeId, is_eating_out } = req.body;

        const menu = await Menu.create({
            date,
            meal_type,
            description,
            RecipeId: RecipeId || null,
            is_eating_out: is_eating_out || false,
            UserId: req.user.id
        });

        // Fetch fresh to return with associations if needed
        const fresh = await Menu.findOne({
            where: { id: menu.id, UserId: req.user.id },
            include: [{ model: Recipe, where: { UserId: req.user.id }, required: false }]
        });
        res.status(201).json(fresh);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update menu entry
router.put('/:id', auth, async (req, res) => {
    try {
        const menu = await Menu.findOne({ where: { id: req.params.id, UserId: req.user.id } });
        if (!menu) return res.status(404).json({ error: 'Menu not found or unauthorized' });

        await menu.update(req.body);
        const fresh = await Menu.findOne({
            where: { id: menu.id, UserId: req.user.id },
            include: [{ model: Recipe, where: { UserId: req.user.id }, required: false }]
        });
        res.json(fresh);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete menu entry
router.delete('/:id', auth, async (req, res) => {
    try {
        const menu = await Menu.findOne({ where: { id: req.params.id, UserId: req.user.id } });
        if (menu) {
            // Optional: Remove associated ListItems if menu is deleted?
            // For now, let's keep them (or user handles manually), or simple destroy.
            // Requirement was: "auch beim löschen des Rezepts aus der mahlzeitenliste werden die Produkte wieder heruntergenommen"
            await ListItem.destroy({ where: { MenuId: menu.id, UserId: req.user.id } });
            await menu.destroy();
        }
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
