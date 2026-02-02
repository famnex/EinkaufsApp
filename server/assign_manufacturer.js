const { Product, Manufacturer, sequelize } = require('./src/models');

async function updateData() {
    try {
        // Ensure a manufacturer exists
        const [manu] = await Manufacturer.findOrCreate({ where: { name: 'Test Marke' } });
        console.log('Using manufacturer:', manu.name, manu.id);

        // Update all products to use this manufacturer (brute force for testing)
        // or just the ones in my debug list (ids 7 and 4 from debug output)
        await Product.update({ ManufacturerId: manu.id }, { where: { id: [4, 7] } });

        // Update one to 'kg'
        await Product.update({ unit: 'kg' }, { where: { id: 7 } });

        console.log('Updated products 4 and 7 with manufacturer and checked units.');

    } catch (err) {
        console.error('Update failed:', err);
    } finally {
        await sequelize.close();
    }
}

updateData();
