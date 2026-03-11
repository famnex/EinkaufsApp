const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || path.join(__dirname, '../database.sqlite'),
    logging: console.log
});

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Verbindung zur Datenbank erfolgreich.');
        const queryInterface = sequelize.getQueryInterface();

        // 1. Menus: portions hinzufügen
        try {
            await queryInterface.addColumn('Menus', 'portions', {
                type: DataTypes.INTEGER,
                allowNull: true
            });
            console.log('[OK] Spalte "portions" zu "Menus" hinzugefügt.');
        } catch (err) {
            console.log('[SKIP] Spalte "portions" existiert bereits oder konnte nicht hinzugefügt werden.');
        }

        // 2. HiddenCleanups: ENUM erweitern (SQLite ignoriert ENUM-Änderungen oft, aber wir setzen das Model-Statement ab)
        try {
            await queryInterface.changeColumn('HiddenCleanups', 'context', {
                type: DataTypes.ENUM('category', 'unit', 'pipeline'),
                allowNull: false,
            });
            console.log('[OK] HiddenCleanups context ENUM aktualisiert.');
        } catch (err) {
            console.log('[ERR] HiddenCleanups context konnte nicht aktualisiert werden:', err.message);
        }

        // 3. Email: Folder ENUM erweitern (app_messages hinzufügen)
        try {
            await queryInterface.changeColumn('Emails', 'folder', {
                type: DataTypes.ENUM('inbox', 'sent', 'sent_system', 'daemon', 'newsletter', 'trash', 'app_messages'),
                defaultValue: 'inbox'
            });
            console.log('[OK] Email folder ENUM aktualisiert (app_messages hinzugefügt).');
        } catch (err) {
            console.log('[ERR] Email folder ENUM konnte nicht aktualisiert werden:', err.message);
        }

        // 4. User: Onboarding-Felder hinzufügen
        try {
            await queryInterface.addColumn('Users', 'isOnboardingCompleted', {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            });
            console.log('[OK] Spalte "isOnboardingCompleted" zu "Users" hinzugefügt.');
        } catch (err) {}

        try {
            await queryInterface.addColumn('Users', 'onboardingPreferences', {
                type: DataTypes.JSON,
                allowNull: true
            });
            console.log('[OK] Spalte "onboardingPreferences" zu "Users" hinzugefügt.');
        } catch (err) {}

        // 4. User: showAppTutorial entfernen (Optional, in SQLite oft über Table Recreation)
        // Wir lassen es vorerst drin, da SQLite removeColumn unterstützt, aber es ist nicht kritisch.
        try {
            // await queryInterface.removeColumn('Users', 'showAppTutorial');
            // console.log('[OK] Spalte "showAppTutorial" von "Users" entfernt.');
        } catch (err) {}

        // 5. Neue Tabelle: PlannedRecipes
        try {
            await queryInterface.createTable('PlannedRecipes', {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                servings: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 1
                },
                settings: {
                    type: DataTypes.JSON,
                    allowNull: true
                },
                hiddenIngredients: {
                    type: DataTypes.JSON,
                    allowNull: true
                },
                UserId: {
                    type: DataTypes.INTEGER,
                    references: { model: 'Users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                RecipeId: {
                    type: DataTypes.INTEGER,
                    references: { model: 'Recipes', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                ListId: {
                    type: DataTypes.INTEGER,
                    references: { model: 'Lists', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false
                }
            });
            console.log('[OK] Tabelle "PlannedRecipes" erstellt.');
        } catch (err) {
            console.log('[SKIP] Tabelle "PlannedRecipes" existiert bereits.');
        }

        // 6. ListItems um PlannedRecipeId erweitern
        try {
            await queryInterface.addColumn('ListItems', 'PlannedRecipeId', {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'PlannedRecipes', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
            console.log('[OK] Spalte "PlannedRecipeId" zu "ListItems" hinzugefügt.');
        } catch (err) {}

        console.log('\nMigration abgeschlossen.');
    } catch (error) {
        console.error('Migration fehlgeschlagen:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
