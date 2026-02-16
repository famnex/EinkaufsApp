const express = require('express');
const router = express.Router();
const { List, ListItem, Product, Store, Manufacturer, ProductRelation, ProductSubstitution, sequelize } = require('../models');
const { Op } = require('sequelize');
const { auth } = require('../middleware/auth');

// Bulk Add Items (for AI Import)
router.post('/:id/items/bulk', auth, async (req, res) => {
    try {
        const listId = parseInt(req.params.id);
        const { items } = req.body; // [{ name, amount, unit }]

        if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });

        const list = await List.findOne({ where: { id: listId, UserId: req.user.effectiveId } });
        if (!list) return res.status(404).json({ error: 'List not found' });

        const results = [];

        for (const item of items) {
            // 1. Find or Create Product
            // Simple fuzzy match by name? Or just Exact match for now to be safe?
            // Let's do exact match (case insensitive)
            let product = await Product.findOne({
                where: {
                    name: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), item.name.toLowerCase()),
                    UserId: req.user.effectiveId
                }
            });

            if (!product) {
                // Create new
                product = await Product.create({
                    name: item.name,
                    unit: item.unit || 'Stück',
                    category: 'Unkategorisiert', // Default
                    UserId: req.user.effectiveId
                });
            }

            // 2. Add to List or Update Existing
            const existingItem = await ListItem.findOne({
                where: {
                    ListId: listId,
                    ProductId: product.id,
                    UserId: req.user.effectiveId,
                    // Check if unit matches? 
                    // Requirement: "Wenn das Produkt schon auf der liste ist und die gleiche einheit verwendet wurde, dann bitte aufaddieren."
                    unit: item.unit || product.unit // Check for same unit
                }
            });

            if (existingItem) {
                // Update quantity
                const newQuantity = parseFloat(existingItem.quantity) + (parseFloat(item.amount) || 1);
                await existingItem.update({ quantity: newQuantity });
                results.push(existingItem);
            } else {
                // Create new
                const listItem = await ListItem.create({
                    ListId: listId,
                    UserId: req.user.effectiveId,
                    ProductId: product.id,
                    quantity: item.amount || 1,
                    unit: item.unit || product.unit,
                    is_bought: false
                });
                results.push(listItem);
            }
        }

        // Auto-Unarchive
        if (list.status === 'archived') {
            await list.update({ status: 'active' });
        }

        res.json({ message: 'Items processed', count: results.length });

    } catch (err) {
        console.error('Bulk Add Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all lists with category stats
router.get('/', auth, async (req, res) => {
    try {
        const lists = await List.findAll({
            where: { UserId: req.user.effectiveId },
            order: [['date', 'DESC']],
            include: [{
                model: ListItem,
                where: { UserId: req.user.effectiveId },
                required: false, // Don't filter out empty lists
                attributes: ['id', 'quantity'],
                include: [{
                    model: Product,
                    where: { UserId: req.user.effectiveId },
                    required: false,
                    attributes: ['category', 'name']
                }]
            }]
        });

        // Transform to add stats
        const result = lists.map(list => {
            const stats = {};
            let productCount = 0;

            list.ListItems.forEach(item => {
                if (item.Product) {
                    const cat = item.Product.category || 'Unkategorisiert';
                    stats[cat] = (stats[cat] || 0) + 1;
                    productCount++;
                }
            });

            // Sort stats by count desc
            const sortedStats = Object.entries(stats)
                .sort(([, a], [, b]) => b - a)
                .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

            const plainList = list.get({ plain: true });
            // Remove heavy nested data from response to keep it light
            delete plainList.ListItems;

            return {
                ...plainList,
                productCount,
                category_stats: sortedStats
            };
        });

        res.json(result);
    } catch (err) {
        console.error('GET /lists ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create new list
router.post('/', auth, async (req, res) => {
    try {
        const list = await List.create({ ...req.body, UserId: req.user.effectiveId });
        res.status(201).json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get list details (with Smart Sorting)
router.get('/:id', auth, async (req, res) => {
    try {
        const list = await List.findOne({
            where: { id: req.params.id, UserId: req.user.effectiveId },
            include: [
                { model: Store, as: 'CurrentStore', where: { UserId: req.user.effectiveId }, required: false },
                {
                    model: ListItem,
                    where: { UserId: req.user.effectiveId },
                    required: false,
                    include: [{
                        model: Product,
                        where: { UserId: req.user.effectiveId },
                        required: false,
                        include: [
                            { model: Store, where: { UserId: req.user.effectiveId }, required: false },
                            { model: Manufacturer, where: { UserId: req.user.effectiveId }, required: false }
                        ]
                    }]
                }
            ]
        });
        if (!list) return res.status(404).json({ error: 'List not found or unauthorized' });

        // --- SORTING LOGIC ---
        let sortedItems = list.ListItems;
        const currentStoreId = list.CurrentStoreId;

        // Only sort unbought items. Bought items go to bottom sorted by time (or id).
        const unboughtItems = sortedItems.filter(i => !i.is_bought);
        const boughtItems = sortedItems.filter(i => i.is_bought).sort((a, b) => {
            if (a.bought_at && b.bought_at) return new Date(a.bought_at) - new Date(b.bought_at);
            return a.id - b.id; // Fallback
        });

        // Check if items have manual sort_order (from drag & drop) FOR THIS STORE
        const hasManualSort = unboughtItems.some(item =>
            item.sort_order !== null &&
            item.sort_order !== undefined &&
            item.sort_store_id === currentStoreId
        );

        if (hasManualSort) {
            // MANUAL SORT MODE: Prioritize sort_order
            unboughtItems.sort((a, b) => {
                const orderA = a.sort_order !== null && a.sort_order !== undefined ? a.sort_order : Infinity;
                const orderB = b.sort_order !== null && b.sort_order !== undefined ? b.sort_order : Infinity;

                if (orderA !== orderB) return orderA - orderB;

                // Fallback for items without sort_order
                const catA = a.Product.category || 'Z';
                const catB = b.Product.category || 'Z';
                if (catA !== catB) return catA.localeCompare(catB);
                return a.Product.name.localeCompare(b.Product.name);
            });

            console.log(`[Manual Sort] Used sort_order for ${unboughtItems.length} items`);
        } else if (currentStoreId) {
            // --- SMART SORT V2: GLOBAL TRANSITIVE GRAPH ---
            // 1. Fetch ALL knowledge for this store
            const allRelations = await ProductRelation.findAll({
                where: { StoreId: currentStoreId, UserId: req.user.effectiveId }
            });

            if (allRelations.length > 0) {
                // 2. Build Weighted Graph & Prune Cycles
                const graph = new Map(); // ProductId -> Set(SuccessorIds)
                const inDegree = new Map();
                const allProductIds = new Set();

                // Helper to init nodes
                const touch = (id) => {
                    allProductIds.add(id);
                    if (!graph.has(id)) graph.set(id, new Set());
                    if (!inDegree.has(id)) inDegree.set(id, 0);
                };

                // Group by pair to find conflicting edges (A->B vs B->A)
                const edgeMap = new Map(); // "min:max" -> { A: weight, B: weight, dirA: A->B }

                allRelations.forEach(r => {
                    const u = r.PredecessorId;
                    const v = r.SuccessorId;
                    const key = u < v ? `${u}:${v}` : `${v}:${u}`;

                    if (!edgeMap.has(key)) edgeMap.set(key, { forward: 0, backward: 0 });
                    const entry = edgeMap.get(key);

                    if (u < v) entry.forward = r.weight; // "Forward" means Lower ID -> Higher ID
                    else entry.backward = r.weight;      // "Backward" means Higher -> Lower
                });

                // Add Winning Edges to Graph
                for (const [key, weights] of edgeMap.entries()) {
                    const [uStr, vStr] = key.split(':');
                    const u = parseInt(uStr);
                    const v = parseInt(vStr);

                    let from, to;
                    if (weights.forward > weights.backward) { from = u; to = v; }
                    else if (weights.backward > weights.forward) { from = v; to = u; }
                    else continue; // Tie or 0? Skip edge to allow falling back to default sort without cycles

                    touch(from);
                    touch(to);

                    if (!graph.get(from).has(to)) {
                        graph.get(from).add(to);
                        inDegree.set(to, (inDegree.get(to) || 0) + 1);
                    }
                }

                // 3. Topological Sort (Kahn's)
                const queue = [];
                // Init queue with 0-in-degree nodes
                // Sort initial queue deterministically (e.g. by Category/Name roughly? or just ID) to stabilize
                // We don't have product details for ALL nodes here efficiently without big join.
                // Just use ID for deterministic stats.
                allProductIds.forEach(id => {
                    if ((inDegree.get(id) || 0) === 0) queue.push(id);
                });
                queue.sort((a, b) => a - b);

                const masterSequence = [];
                while (queue.length > 0) {
                    const u = queue.shift();
                    masterSequence.push(u);

                    if (graph.has(u)) {
                        const neighbors = Array.from(graph.get(u));
                        neighbors.sort((a, b) => a - b); // Deterministic visitation

                        for (const v of neighbors) {
                            inDegree.set(v, inDegree.get(v) - 1);
                            if (inDegree.get(v) === 0) queue.push(v);
                        }
                    }
                }

                // 4. Map Master Sequence to Ranks
                const rankMap = new Map();
                masterSequence.forEach((pid, idx) => rankMap.set(pid, idx));

                // --- NEW SORTING LOGIC WITH CATEGORY INHERITANCE ---
                const categoryMaxRank = new Map();
                const debugItemInfo = [];

                // 4b. Identify Max Rank for each Category present
                unboughtItems.forEach(item => {
                    const pid = item.ProductId;
                    if (rankMap.has(pid)) {
                        const rank = rankMap.get(pid);
                        const cat = item.Product.category || 'Uncategorized';
                        if (!categoryMaxRank.has(cat) || rank > categoryMaxRank.get(cat)) {
                            categoryMaxRank.set(cat, rank);
                        }
                    }
                });

                // 5. Apply to Current Unbought Items (Augmented Sort)
                unboughtItems.sort((a, b) => {
                    // Helper to determine Effective Rank
                    const getRank = (item) => {
                        const pid = item.ProductId;
                        if (rankMap.has(pid)) return { val: rankMap.get(pid), type: 'DIRECT' };

                        // If Unknown, inherit from Category Max
                        const cat = item.Product.category || 'Uncategorized';
                        if (categoryMaxRank.has(cat)) return { val: categoryMaxRank.get(cat) + 0.1, type: 'CATEGORY' };

                        return { val: Infinity, type: 'UNKNOWN' };
                    };

                    const rA = getRank(a);
                    const rB = getRank(b);

                    if (rA.val !== rB.val) return rA.val - rB.val;

                    // Fallback to Category/Name
                    const catA = a.Product.category || 'Z';
                    const catB = b.Product.category || 'Z';
                    if (catA !== catB) return catA.localeCompare(catB);
                    return a.Product.name.localeCompare(b.Product.name);
                });

                // 6. Collect Debug Info
                unboughtItems.forEach(item => {
                    const pid = item.ProductId;
                    const cat = item.Product.category || 'Uncategorized';
                    let rankInfo = 'UNKNOWN';
                    let rankVal = Infinity;

                    if (rankMap.has(pid)) {
                        rankInfo = 'DIRECT';
                        rankVal = rankMap.get(pid);
                    } else if (categoryMaxRank.has(cat)) {
                        rankInfo = `CATEGORY (Inherited from max ${categoryMaxRank.get(cat)})`;
                        rankVal = categoryMaxRank.get(cat) + 0.1;
                    }

                    debugItemInfo.push({
                        name: item.Product.name,
                        category: cat,
                        rankType: rankInfo,
                        rankValue: rankVal
                    });
                });

                // 7. Attach Debug Data
                list.setDataValue('_debug', {
                    masterSequenceLength: masterSequence.length,
                    categoryMaxRanks: Object.fromEntries(categoryMaxRank),
                    itemDetails: debugItemInfo
                });
            } else {
                // No relations, use fallback
                unboughtItems.sort((a, b) => {
                    const catA = a.Product.category || 'Z';
                    const catB = b.Product.category || 'Z';
                    if (catA !== catB) return catA.localeCompare(catB);
                    return a.Product.name.localeCompare(b.Product.name);
                });
            }
        } else {
            // Always Fallback Sort if no store or no data
            unboughtItems.sort((a, b) => {
                const catA = a.Product.category || 'Z';
                const catB = b.Product.category || 'Z';
                if (catA !== catB) return catA.localeCompare(catB);
                return a.Product.name.localeCompare(b.Product.name);
            });
        }

        list.setDataValue('ListItems', [...unboughtItems, ...boughtItems]);

        res.json(list);
    } catch (err) {
        console.error('List detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update list (with Learning Trigger)
router.put('/:id', auth, async (req, res) => {
    try {
        const list = await List.findOne({
            where: { id: req.params.id, UserId: req.user.effectiveId },
            include: [{ model: ListItem, where: { UserId: req.user.effectiveId }, required: false }]
        });
        if (!list) return res.status(404).json({ error: 'List not found' });

        const wasActive = list.status === 'active';
        await list.update(req.body);

        // TRIGGER LEARNING if completing list
        if (wasActive && req.body.status === 'completed' && list.CurrentStoreId) {
            try {
                // 1. Get ordered bought items
                const boughtItems = await ListItem.findAll({
                    where: {
                        ListId: list.id,
                        UserId: req.user.effectiveId,
                        is_bought: true,
                        bought_at: { [Op.ne]: null }
                    },
                    order: [['bought_at', 'ASC']],
                    include: [{ model: Product, where: { UserId: req.user.effectiveId } }]
                });

                if (boughtItems.length > 1) {
                    console.log(`[Learning] Analyzing ${boughtItems.length} items for Store ${list.CurrentStoreId}`);

                    // 2. Iterate pairs and update weights
                    for (let i = 0; i < boughtItems.length - 1; i++) {
                        const pred = boughtItems[i];
                        const succ = boughtItems[i + 1];

                        if (pred.ProductId === succ.ProductId) continue;

                        const relation = await ProductRelation.findOne({
                            where: {
                                StoreId: list.CurrentStoreId,
                                UserId: req.user.effectiveId,
                                PredecessorId: pred.ProductId,
                                SuccessorId: succ.ProductId
                            }
                        });

                        if (relation) {
                            await relation.increment('weight');
                        } else {
                            await ProductRelation.create({
                                StoreId: list.CurrentStoreId,
                                UserId: req.user.effectiveId,
                                PredecessorId: pred.ProductId,
                                SuccessorId: succ.ProductId,
                                weight: 1
                            });
                        }
                    }
                }
            } catch (learnErr) {
                console.error('[Learning Error]', learnErr);
            }
        }

        res.json(list);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Commit current shopping session (Partial Complete)
router.post('/:id/commit', auth, async (req, res) => {
    try {
        const listId = parseInt(req.params.id);
        const { storeId } = req.body;

        if (!storeId) return res.status(400).json({ error: 'Store ID required' });

        // 1. Find items bought but not committed
        const itemsToCommit = await ListItem.findAll({
            where: {
                ListId: listId,
                UserId: req.user.effectiveId,
                is_bought: true,
                is_committed: false, // Only new ones
                bought_at: { [Op.ne]: null }
            },
            order: [['bought_at', 'ASC']],
            include: [{ model: Product, where: { UserId: req.user.effectiveId } }]
        });

        console.log(`[Commit] Found ${itemsToCommit.length} items to commit for Store ${storeId}`);

        if (itemsToCommit.length > 0) {
            // 2. Learn Sequence
            if (itemsToCommit.length > 1) {
                for (let i = 0; i < itemsToCommit.length - 1; i++) {
                    const pred = itemsToCommit[i];
                    const succ = itemsToCommit[i + 1];

                    if (pred.ProductId === succ.ProductId) continue;

                    const relation = await ProductRelation.findOne({
                        where: {
                            StoreId: storeId,
                            UserId: req.user.effectiveId,
                            PredecessorId: pred.ProductId,
                            SuccessorId: succ.ProductId
                        }
                    });

                    if (relation) {
                        await relation.increment('weight');
                    } else {
                        await ProductRelation.create({
                            StoreId: storeId,
                            UserId: req.user.effectiveId,
                            PredecessorId: pred.ProductId,
                            SuccessorId: succ.ProductId,
                            weight: 1
                        });
                    }
                }
            }

            // 3. Mark as committed
            await ListItem.update({ is_committed: true }, {
                where: {
                    id: { [Op.in]: itemsToCommit.map(i => i.id) }
                }
            });
        }

        res.json({ message: 'Session committed', count: itemsToCommit.length });

    } catch (err) {
        console.error('[Commit Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// Reorder list items (for drag & drop)
router.put('/:id/reorder', auth, async (req, res) => {
    try {
        const listId = parseInt(req.params.id);
        const { items } = req.body; // [{ id, sort_order }]

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Items array required' });
        }

        // Get the list to find current store
        const list = await List.findOne({ where: { id: listId, UserId: req.user.effectiveId } });
        if (!list) return res.status(404).json({ error: 'List not found' });

        const currentStoreId = list.CurrentStoreId;
        if (!currentStoreId) {
            return res.status(400).json({ error: 'Store must be selected to reorder items' });
        }

        // Update sort_order AND sort_store_id for each item
        await Promise.all(
            items.map(item =>
                ListItem.update(
                    {
                        sort_order: item.sort_order,
                        sort_store_id: currentStoreId
                    },
                    { where: { id: item.id, UserId: req.user.effectiveId } }
                )
            )
        );

        res.json({ message: 'Items reordered successfully' });
    } catch (err) {
        console.error('[Reorder Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// Add item to list
router.post('/:id/items', auth, async (req, res) => {
    try {
        const listId = parseInt(req.params.id);
        const { ProductId, quantity, price_actual, unit } = req.body;

        if (isNaN(listId)) return res.status(400).json({ error: 'Invalid List ID' });

        // Auto-Unarchive
        await List.update({ status: 'active' }, { where: { id: listId, UserId: req.user.effectiveId, status: 'archived' } });

        const item = await ListItem.create({
            ListId: listId,
            UserId: req.user.effectiveId,
            ProductId: parseInt(ProductId),
            quantity: parseFloat(quantity) || 1,
            unit: unit || null,
            price_actual: price_actual || null
        });

        // Update Product Note if provided
        if (req.body.note !== undefined) {
            const product = await Product.findOne({ where: { id: parseInt(ProductId), UserId: req.user.effectiveId } });
            if (product) {
                await product.update({ note: req.body.note });
            }
        }

        res.status(201).json(item);
    } catch (err) {
        console.error('[Add Item Error]:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update list item
router.put('/items/:itemId', auth, async (req, res) => {
    try {
        const item = await ListItem.findOne({ where: { id: req.params.itemId, UserId: req.user.effectiveId } });
        if (!item) return res.status(404).json({ error: 'Item not found' });

        const updates = req.body;

        // Handle bought_at logic
        if (updates.is_bought !== undefined) {
            if (updates.is_bought && !item.is_bought) {
                updates.bought_at = new Date();
            } else if (!updates.is_bought) {
                updates.bought_at = null;
            }
        }

        // Update Product Note if provided
        if (updates.note !== undefined) {
            const product = await Product.findOne({ where: { id: item.ProductId, UserId: req.user.effectiveId } });
            if (product) {
                await product.update({ note: updates.note });
            }
        }

        await item.update(updates);
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete list
router.delete('/:id', auth, async (req, res) => {
    try {
        const list = await List.findOne({ where: { id: req.params.id, UserId: req.user.effectiveId } });
        if (!list) return res.status(404).json({ error: 'List not found' });

        // Delete all items associated with this list first
        await ListItem.destroy({ where: { ListId: req.params.id, UserId: req.user.effectiveId } });

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
        const item = await ListItem.findOne({ where: { id: itemId, UserId: req.user.effectiveId } });
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

        // Auto-Unarchive
        await List.update({ status: 'active' }, { where: { id: listId, UserId: req.user.effectiveId, status: 'archived' } });

        // 1. Get existing items for this Menu on this List
        const existingItems = await ListItem.findAll({
            where: { ListId: listId, MenuId: MenuId, UserId: req.user.effectiveId }
        });

        const existingMap = new Map(existingItems.map(i => [i.ProductId, i]));
        const newProductIds = new Set(items.map(i => i.ProductId));

        // 2. Identify items to Delete (in DB but not in new list)
        const toDeleteIds = existingItems
            .filter(i => !newProductIds.has(i.ProductId))
            .map(i => i.id);

        if (toDeleteIds.length > 0) {
            await ListItem.destroy({ where: { id: toDeleteIds, UserId: req.user.effectiveId } });
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
                    UserId: req.user.effectiveId,
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
                MenuId: menuId,
                UserId: req.user.effectiveId
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
        const currentList = await List.findOne({ where: { id: listId, UserId: req.user.effectiveId } });
        if (!currentList) return res.status(404).json({ error: 'List not found' });

        // 1. Determine Date Range [currentList.date, nextList.date)
        // If no next list, maybe look ahead 7 days? Let's say 7 days for now if no next list.
        const allLists = await List.findAll({
            where: {
                date: { [require('sequelize').Op.gt]: currentList.date },
                UserId: req.user.effectiveId
            },
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
                },
                UserId: req.user.effectiveId
            },
            include: [
                {
                    model: require('../models').Recipe,
                    where: { UserId: req.user.effectiveId },
                    required: false,
                    include: [{
                        model: require('../models').RecipeIngredient,
                        where: { UserId: req.user.effectiveId },
                        required: false,
                        include: [{ model: Product, where: { UserId: req.user.effectiveId }, required: false, include: [{ model: Store, where: { UserId: req.user.effectiveId }, required: false }] }]
                    }]
                }
            ]
        });

        // 3. Load Product Substitutions for this list
        const substitutions = await ProductSubstitution.findAll({
            where: { ListId: listId, UserId: req.user.effectiveId }
        });
        const subsMap = new Map(); // originalProductId -> substituteProductId
        substitutions.forEach(sub => {
            subsMap.set(sub.originalProductId, sub.substituteProductId);
        });

        // 4. Fetch Existing List Items
        const existingListItems = await ListItem.findAll({
            where: { ListId: listId, UserId: req.user.effectiveId }
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

        // 5. Aggregate Ingredients (Smart Aggregation by Unit)
        const aggregated = {}; // ProductId -> { ... }

        menus.forEach(menu => {
            if (!menu.Recipe || !menu.Recipe.RecipeIngredients) return;

            menu.Recipe.RecipeIngredients.forEach(ing => {
                const origProductId = ing.ProductId;
                // Check if there's a substitution for this product
                const effectiveProductId = subsMap.get(origProductId) || origProductId;

                if (!aggregated[origProductId]) {
                    // Check existingMap using the effective (substituted) product ID
                    const existing = existingMap.get(effectiveProductId) || { quantity: 0, id: null, unit: null };
                    aggregated[origProductId] = {
                        product: ing.Product,
                        neededByUnit: {},
                        sources: [],
                        onList: existing.quantity,
                        onListUnit: existing.unit, // Pass to frontend
                        onListId: existing.id
                    };
                }
                const entry = aggregated[origProductId];
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

        // Auto-Unarchive
        await List.update({ status: 'active' }, { where: { id: listId, UserId: req.user.effectiveId, status: 'archived' } });

        for (const item of items) {
            // Check if exists
            const existing = await ListItem.findOne({
                where: { ListId: listId, ProductId: item.ProductId, UserId: req.user.effectiveId }
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
                    UserId: req.user.effectiveId,
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

// ==================== PRODUCT SUBSTITUTIONS ====================

// Get all substitutions for a list
router.get('/:listId/substitutions', auth, async (req, res) => {
    try {
        const substitutions = await ProductSubstitution.findAll({
            where: { ListId: req.params.listId, UserId: req.user.effectiveId },
            include: [
                { model: Product, as: 'OriginalProduct', where: { UserId: req.user.effectiveId }, required: false },
                { model: Product, as: 'SubstituteProduct', where: { UserId: req.user.effectiveId }, required: false }
            ]
        });
        res.json(substitutions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create or update a substitution
router.post('/:listId/substitutions', auth, async (req, res) => {
    try {
        const { originalProductId, substituteProductId } = req.body;

        // Check if substitution already exists
        const existing = await ProductSubstitution.findOne({
            where: {
                ListId: req.params.listId,
                UserId: req.user.effectiveId,
                originalProductId
            }
        });

        if (existing) {
            // Update
            await existing.update({ substituteProductId });
            res.json(existing);
        } else {
            // Create
            const substitution = await ProductSubstitution.create({
                ListId: req.params.listId,
                UserId: req.user.effectiveId,
                originalProductId,
                substituteProductId
            });
            res.status(201).json(substitution);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a substitution
router.delete('/:listId/substitutions/:originalProductId', auth, async (req, res) => {
    try {
        const deleted = await ProductSubstitution.destroy({
            where: {
                ListId: req.params.listId,
                UserId: req.user.effectiveId,
                originalProductId: req.params.originalProductId
            }
        });

        if (!deleted) {
            return res.status(404).json({ error: 'Substitution not found' });
        }

        res.json({ message: 'Substitution deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
