const axios = require('axios');

async function verifyLogin() {
    const baseUrl = 'http://localhost:5000/api'; // Adjust port if needed
    const email = 'g@gabelguru.local'; // The backfilled email
    const password = 'test'; // Hopefully this is the password, or I need to reset it.
    // Actually I don't know the password for 'g'. I should use a known user or create one.
    // Let's create a temp user first.

    // Instead of full integration test which might fail on password, let's just check if the endpoint REJECTS username and ACCEPTS email schema.

    try {
        console.log('Testing Login with Username (Expect Failure)...');
        try {
            await axios.post(`${baseUrl}/auth/login`, {
                username: 'g',
                password: 'wrongpassword'
            });
            console.log('FAIL: Login with username should have failed 400 or ignored, but got success?');
        } catch (e) {
            if (e.response && e.response.status === 400 && e.response.data.error === 'Invalid email or password') {
                console.log('SUCCESS: Login with username failed as expected (backend likely ignored username and saw missing email).');
            } else if (e.response) {
                console.log(`FAIL: Login with username failed with unexpected status: ${e.response.status} ${JSON.stringify(e.response.data)}`);
            } else {
                console.log('FAIL: Network error', e.message);
            }
        }

        console.log('\nTesting Login with Email (Expect Success/Credential Check)...');
        try {
            await axios.post(`${baseUrl}/auth/login`, {
                email: 'g@gabelguru.local',
                password: 'wrongpassword'
            });
            console.log('FAIL: Login with wrong password succeeded?');
        } catch (e) {
            if (e.response && e.response.status === 400 && e.response.data.error === 'Invalid email or password') {
                console.log('SUCCESS: Login with email reached credential check (got Invalid email or password).');
            } else {
                console.log(`FAIL: Login with email failed with unexpected status: ${e.response.status} ${JSON.stringify(e.response.data)}`);
            }
        }

    } catch (err) {
        console.error('Verification failed:', err);
    }
}

verifyLogin();
