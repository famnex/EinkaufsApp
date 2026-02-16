const axios = require('axios');
const fs = require('fs');
require('dotenv').config({ path: '../.env' }); // Adjust path to .env if needed

// Configuration
const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api`; // Added /api
const EMAIL = 'fleischer.steffen@googlemail.com'; // Use a valid email in your DB
const PASSWORD = 'password123'; // Matches password used in other scripts

async function verify() {
    try {
        console.log('--- AI List Import Verification ---\n');

        // 1. Login
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('✔ Logged in');

        // 2. Create a temporary list
        console.log('\n2. Creating temporary list...');
        const listRes = await axios.post(`${BASE_URL}/lists`, {
            name: 'AI Import Test List',
            date: new Date().toISOString()
        }, { headers });
        const listId = listRes.data.id;
        console.log(`✔ Created List ID: ${listId}`);

        // 3. Test Text AI Extraction (Mocking URL behavior to save time/cost or just checking endpoint)
        console.log('\n3. Testing AI Extraction Endpoint (Simple Text)...');
        const text = "Ich brauche 500g Tomaten, 1 Liter Milch und eine Packung Butter.";
        const extractRes = await axios.post(`${BASE_URL}/ai/extract-list-ingredients`, { text }, { headers });
        console.log('AI Extraction Result:', JSON.stringify(extractRes.data, null, 2));

        if (!extractRes.data.items || extractRes.data.items.length !== 3) {
            console.error('❌ AI Extraction failed to find 3 items.');
            // process.exit(1); 
        } else {
            console.log('✔ AI Extraction successful (found 3 items).');
        }

        // 4. Test Bulk Add
        console.log('\n4. Testing Bulk Add Endpoint...');
        const itemsToAdd = [
            { name: "Test Tomaten", amount: 500, unit: "g" },
            { name: "Test Milch", amount: 1, unit: "Liter" }
        ];
        const bulkRes = await axios.post(`${BASE_URL}/lists/${listId}/items/bulk`, { items: itemsToAdd }, { headers });
        console.log('Bulk Add Result:', bulkRes.data);

        // 5. Verify Items on List
        console.log('\n5. Verifying Items on List...');
        const verificationListRes = await axios.get(`${BASE_URL}/lists/${listId}`, { headers });
        const listItems = verificationListRes.data.ListItems;
        console.log(`Found ${listItems.length} items on list.`);

        const foundTomaten = listItems.find(i => i.Product.name === "Test Tomaten");
        if (foundTomaten) console.log('✔ Found "Test Tomaten"'); else console.error('❌ "Test Tomaten" not found');

        // Cleanup
        console.log('\n6. Cleaning up...');
        await axios.delete(`${BASE_URL}/lists/${listId}`, { headers });
        console.log('✔ Test list deleted.');

    } catch (err) {
        console.error('❌ Error:', err.response ? err.response.data : err.message);
    }
}

verify();
