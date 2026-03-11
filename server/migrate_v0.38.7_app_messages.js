const { AppMessage, UserAppMessageRead } = require('./src/models');

async function migrate() {
    console.log('Starting migration for AppMessages (v0.38.7)...');
    try {
        await AppMessage.sync({ alter: true });
        console.log('AppMessage table synced.');

        await UserAppMessageRead.sync({ alter: true });
        console.log('UserAppMessageRead table synced.');

        console.log('Migration v0.38.7 completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
