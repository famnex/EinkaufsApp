const { sequelize } = require('../src/models');
const { QueryTypes } = require('sequelize');

async function migrate() {
    console.log('Starting migration v0.29.2: add flagging...');
    try {
        const tableInfo = await sequelize.query('PRAGMA table_info(Emails)', { type: QueryTypes.SELECT });
        const hasFlag = tableInfo.some(col => col.name === 'flag');

        if (!hasFlag) {
            await sequelize.query("ALTER TABLE Emails ADD COLUMN flag TEXT DEFAULT 'none'");
            console.log('Column flag added to Emails table.');
        } else {
            console.log('Column flag already exists.');
        }

        console.log('Migration v0.29.2 completed successfully.');
    } catch (error) {
        console.error('Migration v0.29.2 failed:', error);
        process.exit(1);
    }
}

migrate();
