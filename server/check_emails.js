const { Email } = require('./src/models');

async function checkEmails() {
    try {
        const emails = await Email.findAll({
            limit: 5,
            order: [['date', 'DESC']]
        });
        console.log('--- RECENT EMAILS ---');
        emails.forEach(e => {
            console.log(`[${e.date}] From: ${e.fromAddress}, To: ${e.toAddress}, Subject: ${e.subject}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkEmails();
