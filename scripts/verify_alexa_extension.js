const axios = require('../server/node_modules/axios');

// Configure these
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/alexa/menu`;
const KEY = 'TEST_KEY_123'; // Dev/Test Key

async function testQuery(idx, tag, art = null, description) {
    console.log(`\n--- Test ${idx}: ${description} ---`);
    console.log(`Payload: tag='${tag}', art='${art}'`);
    try {
        const payload = { tag };
        if (art) payload.art = art;

        const res = await axios.post(BASE_URL, payload, {
            headers: { Authorization: `Bearer ${KEY}` }
        });

        console.log('Status:', res.status);
        console.log('Response:', JSON.stringify(res.data, null, 2));

        return res.data;
    } catch (err) {
        if (err.response) {
            console.error('Error Status:', err.response.status);
            console.error('Error Data:', err.response.data);
        } else {
            console.error('Error:', err.message);
            console.log('Is the server running on port ' + PORT + '?');
        }
        return null;
    }
}

async function runTests() {
    console.log(`Target: ${BASE_URL}`);

    // 1. Full Day: "Heute"
    await testQuery(1, 'heute', null, 'Full Day Query (Today)');

    // 2. Full Day: "Morgen"
    await testQuery(2, 'morgen', null, 'Full Day Query (Tomorrow)');

    // 3. Weekend: "Am Wochenende"
    const weekendRes = await testQuery(3, 'am wochenende', null, 'Weekend Query (Expecting Sat & Sun)');
    if (weekendRes && weekendRes.text) {
        const hasSamstag = weekendRes.text.includes('Samstag');
        const hasSonntag = weekendRes.text.includes('Sonntag');
        const hasWeekend = weekendRes.text.includes('Wochenende');

        if ((hasSamstag && hasSonntag) || hasWeekend) {
            console.log('✅ PASS: Weekend keywords found.');
        } else {
            console.log('⚠️ CHECK: Did not find explicit "Samstag" and "Sonntag" in response. Might be empty plan? Text: ' + weekendRes.text);
        }
    }

    // 4. Unknown Type: "Morgen" + "Irgendwas" -> Should fall back to full day
    await testQuery(4, 'morgen', 'irgendwas', 'Unknown Type (Fallback to Full Day)');

    // 5. Specific Type: "Morgen" + "Mittag" (Regression test)
    await testQuery(5, 'morgen', 'mittag', 'Specific Meal Query (Regression)');
}

runTests();
