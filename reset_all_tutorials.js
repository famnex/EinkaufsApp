const { User } = require('./server/src/models');

async function resetAllTutorials() {
    try {
        console.log('Setze forkyTutorialsSeen für alle Benutzer zurück...');
        await User.update({ forkyTutorialsSeen: {} }, { where: {} });
        console.log('Alle Tutorials wurden erfolgreich zurückgesetzt.');
    } catch (error) {
        console.error('Fehler beim Zurücksetzen der Tutorials:', error);
    }
}

resetAllTutorials();
