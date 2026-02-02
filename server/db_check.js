const { User, List, Product, Store, Manufacturer } = require('./src/models');

async function check() {
    try {
        const users = await User.count();
        const lists = await List.count();
        const products = await Product.count();
        const stores = await Store.count();
        const manufacturers = await Manufacturer.count();

        console.log({
            users,
            lists,
            products,
            stores,
            manufacturers
        });
    } catch (err) {
        console.error(err);
    }
    process.exit();
}

check();
