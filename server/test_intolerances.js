const { sequelize, Intolerance } = require('./src/models');

async function test() {
    try {
        await sequelize.authenticate();
        console.log("DB connected");

        const ints = await Intolerance.findAll();
        console.log("Intolerances:", ints.map(i => i.toJSON()));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
test();
