const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function migrate() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    const queryInterface = sequelize.getQueryInterface();

    try {
        await sequelize.authenticate();

        // 1. Check if isOmitted exists
        const tableInfo = await queryInterface.describeTable('RecipeSubstitutions');

        if (!tableInfo.isOmitted) {
            console.log('Adding isOmitted column...');
            await queryInterface.addColumn('RecipeSubstitutions', 'isOmitted', {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            });
        }

        // 2. Make substituteProductId nullable
        // Since SQLite doesn't support changing nullability easily, we check if we need to do the migration
        if (tableInfo.substituteProductId && !tableInfo.substituteProductId.allowNull) {
            console.log('Making substituteProductId nullable via temporary table...');

            await sequelize.transaction(async (t) => {
                // Rename old table
                await queryInterface.renameTable('RecipeSubstitutions', 'RecipeSubstitutions_old', { transaction: t });

                // Create new table with nullable substituteProductId
                await sequelize.query(`
                    CREATE TABLE "RecipeSubstitutions" (
                        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                        "originalProductId" INTEGER NOT NULL,
                        "substituteProductId" INTEGER, -- NOW NULLABLE
                        "originalQuantity" FLOAT,
                        "originalUnit" STRING,
                        "substituteQuantity" FLOAT,
                        "substituteUnit" STRING,
                        "isOmitted" TINYINT(1) DEFAULT 0,
                        "createdAt" DATETIME NOT NULL,
                        "updatedAt" DATETIME NOT NULL,
                        "UserId" INTEGER,
                        "RecipeId" INTEGER,
                        FOREIGN KEY ("UserId") REFERENCES "Users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
                        FOREIGN KEY ("RecipeId") REFERENCES "Recipes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
                        FOREIGN KEY ("originalProductId") REFERENCES "Products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
                        FOREIGN KEY ("substituteProductId") REFERENCES "Products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
                    );
                `, { transaction: t });

                // Copy data
                await sequelize.query(`
                    INSERT INTO "RecipeSubstitutions" 
                    (id, originalProductId, substituteProductId, originalQuantity, originalUnit, substituteQuantity, substituteUnit, isOmitted, createdAt, updatedAt, UserId, RecipeId)
                    SELECT id, originalProductId, substituteProductId, originalQuantity, originalUnit, substituteQuantity, substituteUnit, isOmitted, createdAt, updatedAt, UserId, RecipeId
                    FROM "RecipeSubstitutions_old";
                `, { transaction: t });

                // Drop old table
                await queryInterface.dropTable('RecipeSubstitutions_old', { transaction: t });
            });
        }

        console.log('Migration v0.32.9_recipe_substitution_omissions completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
