const { sequelize } = require('./server/src/models');
async function check() {
    try {
        const [results] = await sequelize.query("PRAGMA table_info(Recipes)");
        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
check();
