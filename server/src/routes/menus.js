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
        const where = {};
        if (start && end) {
            where.date = { [Op.between]: [start, end] };
        }

        const menus = await Menu.findAll({
            where,
            include: [
                {
                    model: Recipe,
                    include: [{ model: RecipeIngredient, include: [Product] }] // Need Products for Smart Modal
                },
                { model: ListItem } // To check if added to list
            ],
            order: [['date', 'ASC'], ['meal_type', 'ASC']]
        });
        res.json(menus);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
            is_eating_out: is_eating_out || false
        });

        // Fetch fresh to return with associations if needed
        const fresh = await Menu.findByPk(menu.id, { include: [Recipe] });
        res.status(201).json(fresh);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update menu entry
router.put('/:id', auth, async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        if (!menu) return res.status(404).json({ error: 'Menu not found' });

        await menu.update(req.body);
        const fresh = await Menu.findByPk(menu.id, { include: [Recipe] });
        res.json(fresh);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete menu entry
router.delete('/:id', auth, async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        if (menu) {
            // Optional: Remove associated ListItems if menu is deleted?
            // For now, let's keep them (or user handles manually), or simple destroy.
            // Requirement was: "auch beim löschen des Rezepts aus der mahlzeitenliste werden die Produkte wieder heruntergenommen"
            await ListItem.destroy({ where: { MenuId: menu.id } });
            await menu.destroy();
        }
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
