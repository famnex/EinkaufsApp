const { List, ListItem, ProductVariation, Product, ProductRelation, User } = require('./src/models');
const { Op } = require('sequelize');

async function test() {
    // Find the latest active list for testing
    const list = await List.findOne({
        order: [['id', 'DESC']],
        include: [
            {
                model: ListItem,
                include: [{ model: Product }, { model: ProductVariation }]
            }
        ]
    });

    if (!list) return console.log('No list found');
    console.log('Testing List ID:', list.id);

    const u = await User.findOne();
    const req = { user: { effectiveId: u.id }, params: { id: list.id } };

    // Simulate sort
    let sortedItems = list.ListItems;
    const currentStoreId = list.CurrentStoreId || 1; // Fallback to store 1
    const unboughtItems = sortedItems.filter(i => !i.is_bought);

    console.log(`Unbought Items Length: ${unboughtItems.length}`);
    console.log(`Current Store: ${currentStoreId}`);

    // 1. Fetch ALL knowledge for this store
    const allRelations = await ProductRelation.findAll({
        where: { StoreId: currentStoreId, UserId: req.user.effectiveId }
    });

    console.log(`Relations Found for Store ${currentStoreId}:`, allRelations.length);

    if (allRelations.length > 0) {
        const graph = new Map(); // ProductId -> Set(SuccessorIds)
        const inDegree = new Map();
        const allProductIds = new Set();
        const touch = (id) => {
            allProductIds.add(id);
            if (!graph.has(id)) graph.set(id, new Set());
            if (!inDegree.has(id)) inDegree.set(id, 0);
        };
        const edgeMap = new Map(); // "min:max" -> { A: weight, B: weight, dirA: A->B }

        allRelations.forEach(r => {
            const u = `${r.PredecessorId}_${r.PredecessorVariationId || 'null'}`;
            const v = `${r.SuccessorId}_${r.SuccessorVariationId || 'null'}`;
            const key = u < v ? `${u}:${v}` : `${v}:${u}`;

            if (!edgeMap.has(key)) edgeMap.set(key, { forward: 0, backward: 0 });
            const entry = edgeMap.get(key);

            if (u < v) entry.forward = r.weight; // "Forward" means Lexicographically smaller string first
            else entry.backward = r.weight;      // "Backward" means larger first
        });

        // Add Winning Edges to Graph
        for (const [key, weights] of edgeMap.entries()) {
            const [uStr, vStr] = key.split(':');
            const u = uStr;
            const v = vStr;

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

        const queue = [];
        allProductIds.forEach(id => {
            if ((inDegree.get(id) || 0) === 0) queue.push(id);
        });
        queue.sort((a, b) => a.localeCompare(b));

        console.log('Initial Queue:', queue);

        const masterSequence = [];
        while (queue.length > 0) {
            const u = queue.shift();
            masterSequence.push(u);

            if (graph.has(u)) {
                const neighbors = Array.from(graph.get(u));
                neighbors.sort((a, b) => a.localeCompare(b)); // Deterministic visitation

                for (const v of neighbors) {
                    inDegree.set(v, inDegree.get(v) - 1);
                    if (inDegree.get(v) === 0) queue.push(v);
                }
            }
        }

        const rankMap = new Map();
        masterSequence.forEach((pid, idx) => rankMap.set(pid, idx));
        console.log('Rank Map Size:', rankMap.size);

        const categoryMaxRank = new Map();
        unboughtItems.forEach(item => {
            const pid = `${item.ProductId}_${item.ProductVariationId || 'null'}`;
            if (rankMap.has(pid)) {
                const rank = rankMap.get(pid);
                const cat = item.ProductVariation?.category || item.Product.category || 'Uncategorized';
                if (!categoryMaxRank.has(cat) || rank > categoryMaxRank.get(cat)) {
                    categoryMaxRank.set(cat, rank);
                }
            }
        });

        console.log('Category Max Ranks:', Object.fromEntries(categoryMaxRank));

        console.log('--- RANK ASSIGNMENT ---');
        unboughtItems.forEach(item => {
            const pid = `${item.ProductId}_${item.ProductVariationId || 'null'}`;
            const cat = item.ProductVariation?.category || item.Product.category || 'Uncategorized';
            let rankInfo = 'UNKNOWN';
            let rankVal = Infinity;

            if (rankMap.has(pid)) {
                rankInfo = 'DIRECT';
                rankVal = rankMap.get(pid);
                console.log(`[Assign] DIRECT ${rankVal} -> ${item.Product.name} (${pid}) [Cat: ${cat}]`);
            } else if (categoryMaxRank.has(cat)) {
                rankInfo = `CATEGORY (${categoryMaxRank.get(cat)})`;
                rankVal = categoryMaxRank.get(cat) + 0.1;
                console.log(`[Assign] CAT ${rankVal.toFixed(1)} -> ${item.Product.name} (${pid}) [Cat: ${cat}]`);
            } else {
                console.log(`[Assign] FALLBACK -> ${item.Product.name} (${pid}) [Cat: ${cat}]`);
            }
        });
    } else {
        console.log('No relations to build graph.');
    }
}
test();
