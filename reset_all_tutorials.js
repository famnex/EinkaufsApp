const { User } = require('./server/src/models');

async function resetAllTutorials() {
    try {
        console.log('Setze Tutorials und Onboarding für alle Benutzer zurück...');
        await User.update({ 
            forkyTutorialsSeen: {},
            isOnboardingCompleted: false,
            onboardingPreferences: null
        }, { where: {} });
        console.log('Alle Tutorials und Onboarding-Status wurden erfolgreich zurückgesetzt.');
    } catch (error) {
        console.error('Fehler beim Zurücksetzen der Tutorials:', error);
    }
}

resetAllTutorials();
