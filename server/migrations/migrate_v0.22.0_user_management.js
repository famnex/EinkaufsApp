const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function checkColumnExists(tableName, columnName) {
    const result = await sequelize.query(
        `PRAGMA table_info(${tableName})`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return result.some(col => col.name === columnName);
}

async function checkTableExists(tableName) {
    const result = await sequelize.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return result.length > 0;
}

async function migrate() {
    console.log('=== Migration v0.22.0 (User Management) Starting ===\n');

    try {
        // 1. Update Users Table
        if (!(await checkColumnExists('Users', 'tier'))) {
            console.log('Adding column: Users.tier...');
            await sequelize.query("ALTER TABLE Users ADD COLUMN tier VARCHAR(255) DEFAULT 'Plastikgabel';");
            console.log('✓ Added Users.tier\n');
        }

        if (!(await checkColumnExists('Users', 'aiCredits'))) {
            console.log('Adding column: Users.aiCredits...');
            await sequelize.query("ALTER TABLE Users ADD COLUMN aiCredits DECIMAL(10, 2) DEFAULT 0.00;");
            console.log('✓ Added Users.aiCredits\n');
        }

        // 2. Create CreditTransactions Table
        if (!(await checkTableExists('CreditTransactions'))) {
            console.log('Creating table: CreditTransactions...');
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS CreditTransactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    delta DECIMAL(10, 2) NOT NULL,
                    description VARCHAR(255) NOT NULL,
                    type VARCHAR(50) DEFAULT 'usage',
                    createdAt DATETIME NOT NULL,
                    updatedAt DATETIME NOT NULL,
                    UserId INTEGER REFERENCES Users(id) ON DELETE CASCADE
                );
            `);
            console.log('✓ Created CreditTransactions table\n');
        }

        console.log('=== Migration v0.22.0 Completed Successfully ===');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
