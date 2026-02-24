const { User } = require('../src/models');

async function seed() {
    try {
        const user = await User.findByPk(1);
        if (!user) {
            console.error('Benutzer mit ID 1 nicht gefunden.');
            return;
        }

        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);

        await user.update({
            tier: 'Silbergabel',
            subscriptionStatus: 'active',
            subscriptionExpiresAt: nextMonth,
            cancelAtPeriodEnd: false,
            aiCredits: 600.00
        });

        console.log('----------------------------------------------------');
        console.log('✅ Beispieldaten für User 1 (ID: 1) erfolgreich eingefügt:');
        console.log('Username:     ', user.username);
        console.log('Tier:         ', user.tier);
        console.log('Status:       ', user.subscriptionStatus);
        console.log('Ablaufdatum:  ', user.subscriptionExpiresAt.toLocaleString('de-DE'));
        console.log('Gekündigt:    ', user.cancelAtPeriodEnd ? 'JA' : 'NEIN');
        console.log('AI Credits:   ', user.aiCredits);
        console.log('----------------------------------------------------');

    } catch (err) {
        console.error('❌ Fehler beim Einfügen der Beispieldaten:', err);
    } finally {
        process.exit();
    }
}

seed();
