const axios = require('../server/node_modules/axios');

// CONFIG
const API_URL = 'http://localhost:5000/api/alexa/add';
const ALEXA_KEY = 'TEST_KEY_123'; // We need to set this in DB first or use existing

async function test() {
    try {
        console.log('--- TEST 1: Auth Failure ---');
        try {
            await axios.post(API_URL, {}, { headers: { Authorization: 'Bearer WRONG_KEY' } });
        } catch (e) {
            console.log('Expected Error:', e.response ? e.response.status : e.message);
        }

        console.log('\n--- TEST 2: Add New Product ---');
        // valid key needs to be set in DB manually or we mock it. 
        // For this test script to work "real", we need a valid key in DB.

        const payload1 = {
            name: "Flux Kompensator",
            menge: 1,
            einheit: "Stück",
            source: "alexa",
            mode: "food"
        };

        try {
            const res = await axios.post(API_URL, payload1, {
                headers: { Authorization: `Bearer ${ALEXA_KEY}` }
            });
            console.log('Status:', res.status, res.data);
        } catch (e) {
            console.log('Error:', e.response ? e.response.data : e.message);
        }

        console.log('\n--- TEST 3: Add Existing Product (Increment) ---');
        try {
            const res = await axios.post(API_URL, payload1, {
                headers: { Authorization: `Bearer ${ALEXA_KEY}` }
            });
            console.log('Status:', res.status, res.data);
        } catch (e) {
            console.log('Error:', e.response ? e.response.data : e.message);
        }

    } catch (err) {
        console.error('Fatal Test Error:', err);
    }
}

test();
