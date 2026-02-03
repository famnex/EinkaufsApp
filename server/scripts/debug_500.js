const { sequelize, List, ListItem, Product, Store, Manufacturer, ProductRelation } = require('../src/models');
const { Op } = require('sequelize');

async function testFetchList() {
    try {
        console.log('Syncing DB...');
        await sequelize.sync({ alter: true }); // Force sync here to be sure
        console.log('DB Synced.');

        const list = await List.findOne({
            include: [
                { model: Store, as: 'CurrentStore' },
                { model: ListItem, include: [{ model: Product }] }
            ]
        });

        if (!list) {
            console.log('No lists found to test.');
            return;
        }

        console.log(`Testing List ID: ${list.id}`);
        console.log('CurrentStoreId:', list.CurrentStoreId);

        // --- REPLICATE ROUTE LOGIC ---
        let sortedItems = list.ListItems;
        const currentStoreId = list.CurrentStoreId;

        const unboughtItems = sortedItems.filter(i => !i.is_bought);

        if (currentStoreId && unboughtItems.length > 1) {
            console.log('Running Smart Sort logic...');
            const productIds = unboughtItems.map(i => i.ProductId);

            // Check if ProductRelation table is queried correctly
            try {
                const relations = await ProductRelation.findAll({
                    where: {
                        StoreId: currentStoreId,
                        PredecessorId: { [Op.in]: productIds },
                        SuccessorId: { [Op.in]: productIds }
                    }
                });
                console.log(`Found ${relations.length} relations.`);
            } catch (relErr) {
                console.error('FAILED to query ProductRelation:', relErr);
            }
        }

        console.log('Test completed successfully (no crash).');

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    } finally {
        await sequelize.close();
    }
}

testFetchList();
