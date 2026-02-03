const { sequelize } = require('./src/models');

async function addColumn() {
    try {
        await sequelize.query(`ALTER TABLE ListItems ADD COLUMN sort_store_id INTEGER DEFAULT NULL;`);
        console.log('Column sort_store_id added successfully!');
        process.exit(0);
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('Column sort_store_id already exists.');
            process.exit(0);
        } else {
            console.error('Error adding column:', err);
            process.exit(1);
        }
    }
}

addColumn();
