const { List, ListItem, Product, Store, Manufacturer, sequelize } = require('./src/models');

async function testFetch() {
    try {
        console.log('Fetching all lists...');
        const lists = await List.findAll();
        console.log('Found lists:', lists.map(l => ({ id: l.id, name: l.name })));

        if (lists.length > 0) {
            const id = lists[0].id;
            console.log(`Attempting to fetch details for List ID: ${id}`);

            const list = await List.findByPk(id, {
                include: [
                    { model: Store, as: 'CurrentStore' },
                    {
                        model: ListItem,
                        include: [
                            {
                                model: Product,
                                include: [
                                    { model: Manufacturer }, // This is the suspected new addition
                                    { model: Store }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (list) {
                console.log('Success! List found.');
                console.log(JSON.stringify(list.toJSON(), null, 2));
            } else {
                console.error('List found in findAll but returned null in findByPk with includes.');
            }
        } else {
            console.log('No lists in database to test.');
        }
    } catch (err) {
        console.error('Error fetching list:', err);
    } finally {
        await sequelize.close();
    }
}

testFetch();
