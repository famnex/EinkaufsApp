const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(__dirname, 'database.sqlite'),
    logging: false,
});

async function check() {
    try {
        const [results] = await sequelize.query("PRAGMA table_info(Stores);");
        console.log('Stores Columns:', results.map(c => c.name));
    } catch (err) {
        console.error(err);
    }
}

check();
