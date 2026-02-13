const { sequelize } = require('../src/models');

async function migrate() {
    try {
        console.log('Starting migration v0.24.5: Compliance Banning...');
        await sequelize.authenticate();
        const queryInterface = sequelize.getQueryInterface();

        // Add bannedAt to Users
        try {
            await queryInterface.addColumn('Users', 'bannedAt', {
                type: 'DATETIME',
                allowNull: true
            });
            console.log('Added bannedAt to Users table.');
        } catch (e) {
            console.log('Users.bannedAt might already exist:', e.message);
        }

        // Add bannedAt to Recipes
        try {
            await queryInterface.addColumn('Recipes', 'bannedAt', {
                type: 'DATETIME',
                allowNull: true
            });
            console.log('Added bannedAt to Recipes table.');
        } catch (e) {
            console.log('Recipes.bannedAt might already exist:', e.message);
        }

        console.log('Migration v0.24.5 successful.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sequelize.close();
    }
}

migrate();
