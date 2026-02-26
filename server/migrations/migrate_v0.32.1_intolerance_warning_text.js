const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function migrate() {
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    console.log('Database Path:', dbPath);

    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: console.log,
    });

    const queryInterface = sequelize.getQueryInterface();

    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // 1. Add warningText column
        try {
            await queryInterface.addColumn('Intolerances', 'warningText', {
                type: DataTypes.STRING,
                allowNull: true
            });
            console.log('Column warningText added to Intolerances.');
        } catch (e) {
            console.log('Column warningText might already exist.');
        }

        // 2. Update existing defaults with warning texts
        const updates = [
            { name: 'Eier', warningText: 'enthält Eier' },
            { name: 'Milcheiweiß', warningText: 'enthält Milch' },
            { name: 'Glutenunverträglichkeit', warningText: 'enthält Gluten' },
            { name: 'Nüsse', warningText: 'enthält Nüsse' },
            { name: 'Laktose', warningText: 'laktosehaltig' },
            { name: 'Glutamat', warningText: 'mit Glutamat' },
            { name: 'Fruktose', warningText: 'fruktosehaltig' },
            { name: 'Soja', warningText: 'enthält Soja' }
        ];

        for (const item of updates) {
            await sequelize.query(
                `UPDATE Intolerances SET warningText = ? WHERE name = ?`,
                { replacements: [item.warningText, item.name] }
            );
        }
        console.log('Initial warning texts updated.');

        console.log('Migration intolerance_warning_text completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
