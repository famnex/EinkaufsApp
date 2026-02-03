const { sequelize, List, ListItem, Product, Store, ProductRelation } = require('../src/models');
const { Op } = require('sequelize');

async function debugQuery() {
    try {
        console.log('Authenticating DB...');
        await sequelize.authenticate();
        console.log('DB Connection OK.');

        // 1. Check if column exists by raw query
        try {
            const [results] = await sequelize.query("PRAGMA table_info(ListItems);");
            const hasBoughtAt = results.some(r => r.name === 'bought_at');
            console.log('ListItems.bought_at exists:', hasBoughtAt);
        } catch (e) {
            console.error('Failed to check table info:', e.message);
        }

        // 2. Try the actual failing query logic on ALL lists
        console.log('Fetching ALL lists...');
        const lists = await List.findAll({
            include: [
                { model: Store, as: 'CurrentStore' },
                { model: ListItem, include: [{ model: Product }] }
            ]
        });

        console.log(`Found ${lists.length} lists.`);

        for (const list of lists) {
            console.log(`Checking List ID: ${list.id}`);

            const productIds = list.ListItems.map(i => {
                if (!i.ProductId) throw new Error(`ListItem ${i.id} has no ProductId`);
                return i.ProductId;
            });
            const currentStoreId = list.CurrentStoreId;

            if (currentStoreId && productIds.length > 0) {
                const relations = await ProductRelation.findAll({
                    where: {
                        StoreId: currentStoreId,
                        PredecessorId: { [Op.in]: productIds },
                        SuccessorId: { [Op.in]: productIds }
                    }
                });
                console.log(`  Relations: ${relations.length}`);
            }
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
        console.error(err.stack);
    } finally {
        await sequelize.close();
    }
}

debugQuery();
