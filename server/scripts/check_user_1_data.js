const axios = require('axios');
const { User } = require('../src/models');

async function check() {
    try {
        const user = await User.findByPk(1);
        console.log('Database Record for User 1:');
        console.log(JSON.stringify(user.toJSON(), null, 2));

        // Note: We can't easily simulate the /auth/me call with JWT here without a token,
        // but we can check if the User model has the fields and if our code in auth.js is correct.

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

check();
