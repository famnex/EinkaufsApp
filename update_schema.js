const { sequelize } = require('./server/src/models');

async function updateSchema() {
    try {
        console.log('Syncing database schema...');
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully.');
    } catch (error) {
        console.error('Error syncing database:', error);
    } finally {
        await sequelize.close();
    }
}

updateSchema();
