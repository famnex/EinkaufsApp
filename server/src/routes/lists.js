const express = require('express');
const router = express.Router();
const { List, ListItem, Product, Store, Manufacturer } = require('../models');
const { auth } = require('../middleware/auth');

// Get all lists
router.get('/', auth, async (req, res) => {
    try {
        const lists = await List.findAll({ order: [['date', 'DESC']] });
        res.json(lists);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new list
router.post('/', auth, async (req, res) => {
    try {
        const list = await List.create(req.body);
        res.status(201).json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get list details
router.get('/:id', auth, async (req, res) => {
    try {
        const list = await List.findByPk(req.params.id, {
            include: [
                { model: Store, as: 'CurrentStore' },
                { model: ListItem, include: [{ model: Product, include: [Store, Manufacturer] }] }
            ]
        });
        if (!list) return res.status(404).json({ error: 'List not found' });
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update list
router.put('/:id', auth, async (req, res) => {
    try {
        const list = await List.findByPk(req.params.id);
        if (!list) return res.status(404).json({ error: 'List not found' });
        await list.update(req.body);
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add item to list
router.post('/:id/items', auth, async (req, res) => {
    try {
        const listId = parseInt(req.params.id);
        const { ProductId, quantity, price_actual, unit } = req.body;

        if (isNaN(listId)) return res.status(400).json({ error: 'Invalid List ID' });

        const item = await ListItem.create({
            ListId: listId,
            ProductId: parseInt(ProductId),
            quantity: parseFloat(quantity) || 1,
            unit: unit || null,
            price_actual: price_actual || null
        });
        res.status(201).json(item);
    } catch (err) {
        console.error('[Add Item Error]:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update list item
router.put('/items/:itemId', auth, async (req, res) => {
    try {
        const item = await ListItem.findByPk(req.params.itemId);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        await item.update(req.body);
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete list
router.delete('/:id', auth, async (req, res) => {
    try {
        const list = await List.findByPk(req.params.id);
        if (!list) return res.status(404).json({ error: 'List not found' });

        // Delete all items associated with this list first
        await ListItem.destroy({ where: { ListId: req.params.id } });

        await list.destroy();
        res.json({ message: 'List deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete list item
router.delete('/items/:itemId', auth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const item = await ListItem.findByPk(itemId);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        await item.destroy();
        res.json({ message: 'Item removed from list' });
    } catch (err) {
        console.error('[Delete Item Error]:', err);
        res.status(500).json({ error: err.message });
    }
});

// Sync Recipe Items (Full Update for a MenuId)
router.put('/:id/recipe-items', auth, async (req, res) => {
    try {
        const listId = parseInt(req.params.id);
        const { MenuId, items } = req.body; // items: [{ ProductId, quantity }]

        if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items array' });

        // 1. Get existing items for this Menu on this List
        const existingItems = await ListItem.findAll({
            where: { ListId: listId, MenuId: MenuId }
        });

        const existingMap = new Map(existingItems.map(i => [i.ProductId, i]));
        const newProductIds = new Set(items.map(i => i.ProductId));

        // 2. Identify items to Delete (in DB but not in new list)
        const toDeleteIds = existingItems
            .filter(i => !newProductIds.has(i.ProductId))
            .map(i => i.id);

        if (toDeleteIds.length > 0) {
            await ListItem.destroy({ where: { id: toDeleteIds } });
        }

        // 3. Identify items to Create or Update
        const operations = items.map(async (newItem) => {
            if (existingMap.has(newItem.ProductId)) {
                // Update quantity if changed
                const existing = existingMap.get(newItem.ProductId);
                if (existing.quantity !== newItem.quantity) {
                    return existing.update({ quantity: newItem.quantity });
                }
                return existing;
            } else {
                // Create new
                return ListItem.create({
                    ListId: listId,
                    ProductId: newItem.ProductId,
                    quantity: newItem.quantity,
                    MenuId: MenuId,
                    is_bought: false
                });
            }
        });

        await Promise.all(operations);

        res.json({ message: 'Synced successfully' });
    } catch (err) {
        console.error('[Sync Error]:', err);
        res.status(500).json({ error: err.message });
    }
});

// Batch Delete Recipe Items (by MenuId)
router.delete('/:id/recipe-items/:menuId', auth, async (req, res) => {
    try {
        const { id, menuId } = req.params;
        await ListItem.destroy({
            where: {
                ListId: id,
                MenuId: menuId
            }
        });
        res.json({ message: 'Recipe items removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Bulk Planning Data (Range & Aggregated Ingredients)
router.get('/:id/planning-data', auth, async (req, res) => {
    try {
        const listId = parseInt(req.params.id);
        const currentList = await List.findByPk(listId);
        if (!currentList) return res.status(404).json({ error: 'List not found' });

        // 1. Determine Date Range [currentList.date, nextList.date)
        // If no next list, maybe look ahead 7 days? Let's say 7 days for now if no next list.
        const allLists = await List.findAll({
            where: { date: { [require('sequelize').Op.gt]: currentList.date } },
            order: [['date', 'ASC']],
            limit: 1
        });
        const nextList = allLists[0];

        const startDate = currentList.date; // Inclusive
        let endDate;

        if (nextList) {
            endDate = nextList.date; // Exclusive
        } else {
            // Default to +7 days if no next list
            const date = new Date(startDate);
            date.setDate(date.getDate() + 7);
            endDate = date.toISOString().split('T')[0];
        }

        // 2. Fetch Menus in Range
        const { Op } = require('sequelize');
        const menus = await require('../models').Menu.findAll({
            where: {
                date: {
                    [Op.gte]: startDate,
                    [Op.lt]: endDate
                }
            },
            include: [
                {
                    model: require('../models').Recipe,
                    include: [{
                        model: require('../models').RecipeIngredient,
                        include: [{ model: Product, include: [Store] }]
                    }]
                }
            ]
        });

        // 3. Fetch Existing List Items
        const existingListItems = await ListItem.findAll({
            where: { ListId: listId }
        });
        const existingMap = new Map(); // ProductId -> { quantity, unit, id }

        // Note: If multiple items exist for same product, this simple logic might just take the last one or sum blindly.
        // For now, let's try to preserve the unit of the first item found to lock it.
        existingListItems.forEach(i => {
            const current = existingMap.get(i.ProductId) || { quantity: 0, id: null, unit: null };
            existingMap.set(i.ProductId, {
                quantity: current.quantity + i.quantity,
                id: i.id,
                unit: i.unit // Capture unit. If mixed units exist, this might be ambiguous, but fits 'locking' requirement.
            });
        });

        // 4. Aggregate Ingredients (Smart Aggregation by Unit)
        const aggregated = {}; // ProductId -> { ... }

        menus.forEach(menu => {
            if (!menu.Recipe || !menu.Recipe.RecipeIngredients) return;

            menu.Recipe.RecipeIngredients.forEach(ing => {
                if (!aggregated[ing.ProductId]) {
                    const existing = existingMap.get(ing.ProductId) || { quantity: 0, id: null, unit: null };
                    aggregated[ing.ProductId] = {
                        product: ing.Product,
                        neededByUnit: {},
                        sources: [],
                        onList: existing.quantity,
                        onListUnit: existing.unit, // Pass to frontend
                        onListId: existing.id
                    };
                }
                const entry = aggregated[ing.ProductId];
                const unit = ing.unit || ing.Product.unit || 'Stück';

                entry.neededByUnit[unit] = (entry.neededByUnit[unit] || 0) + parseFloat(ing.quantity);

                entry.sources.push({
                    date: menu.date,
                    recipe: menu.Recipe.title,
                    amount: ing.quantity,
                    unit: unit
                });
            });
        });

        // 5. Format totals
        const resultIngredients = Object.values(aggregated).map(item => {
            // Create text representation: "500 g + 2 EL"
            const parts = Object.entries(item.neededByUnit).map(([unit, amount]) => `${parseFloat(amount.toFixed(2))} ${unit}`);
            const totalNeededText = parts.join(' + ');

            return {
                ...item,
                totalNeededText,
                // Add a "primary" needed status for simple cases (one unit type)
                primaryNeed: Object.keys(item.neededByUnit).length === 1 ? {
                    amount: Object.values(item.neededByUnit)[0],
                    unit: Object.keys(item.neededByUnit)[0]
                } : null
            };
        });

        res.json({
            range: { start: startDate, end: endDate },
            ingredients: resultIngredients
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Bulk Save Items from Planner
router.post('/:id/bulk-items', auth, async (req, res) => {
    try {
        const listId = parseInt(req.params.id);
        const { items } = req.body; // [{ ProductId, quantity, unit }]

        if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });

        for (const item of items) {
            // Check if exists
            const existing = await ListItem.findOne({
                where: { ListId: listId, ProductId: item.ProductId }
            });

            if (existing) {
                // If units match, add quantities. If not, what? 
                // For simplicity, if units differ, we might overwrite or add as string note? 
                // Current simple logic: If unit provided, overwrite unit and ADD quantity? 
                // Or if user sets specific unit, maybe they want to normalize?
                // Let's assume: Add quantity, Update unit to new one (if provided)

                const newQuantity = parseFloat(existing.quantity) + parseFloat(item.quantity);
                const updates = { quantity: newQuantity };
                if (item.unit) updates.unit = item.unit;

                await existing.update(updates);
            } else {
                await ListItem.create({
                    ListId: listId,
                    ProductId: item.ProductId,
                    quantity: item.quantity,
                    unit: item.unit
                });
            }
        }

        res.json({ message: 'Items added' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
