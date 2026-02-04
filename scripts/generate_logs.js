const axios = require('../server/node_modules/axios');

const API_URL = 'http://localhost:5000/api/alexa/add';
const ALEXA_KEY = 'TEST_KEY_123';

async function generateLogs() {
    try {
        console.log('--- Generating Logs ---');
        // Success
        await axios.post(API_URL, { name: "Test Log Item Rewritten", menge: 1, unit: "Stück" }, { headers: { Authorization: `Bearer ${ALEXA_KEY}` } });
        console.log('Log item generated.');
    } catch (err) {
        console.error('Fatal Error:', err);
    }
}

generateLogs();
