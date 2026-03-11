'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Modify enum context to add 'pipeline'
        await queryInterface.changeColumn('HiddenCleanups', 'context', {
            type: Sequelize.ENUM('category', 'unit', 'pipeline'),
            allowNull: false,
        });
    },

    down: async (queryInterface, Sequelize) => {
        // In PostgreSQL or MySQL we'd ideally remove 'pipeline' from enum, 
        // but typically down migrations for enums are tricky or skipped.
        // For SQLite, changeColumn for enums just writes Check constraints.
        await queryInterface.changeColumn('HiddenCleanups', 'context', {
            type: Sequelize.ENUM('category', 'unit'),
            allowNull: false,
        });
    }
};
