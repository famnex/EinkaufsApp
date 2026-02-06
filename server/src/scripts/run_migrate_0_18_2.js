const migration = require('../migrations/migrate_v0.18.2.js');

console.log("Starting Migration v0.18.2...");
migration.up()
    .then(() => {
        console.log("Migration SUCCESS!");
        process.exit(0);
    })
    .catch(err => {
        console.error("Migration FAILED:", err);
        process.exit(1);
    });
