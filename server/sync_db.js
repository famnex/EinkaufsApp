const { sequelize } = require('./src/models');

async function sync() {
    try {
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully');
    } catch (err) {
        console.error('Failed to sync database:', err);
    }
}

sync();
