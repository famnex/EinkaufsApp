const axios = require('axios');

async function verifyResetFlow() {
    const baseUrl = 'http://localhost:5000/api';
    const email = 'fleischer.steffen@googlemail.com'; // Known user
    let token = '';

    console.log('1. Requesting Reset Token...');
    try {
        const res = await axios.post(`${baseUrl}/auth/forgot-password`, { email });
        console.log('Response:', res.data);

        if (res.data.devLink) {
            console.log('Captured Dev Link:', res.data.devLink);
            const match = res.data.devLink.match(/token=([a-f0-9]+)/);
            if (match) {
                token = match[1];
                console.log('Captured Token:', token);
            } else {
                console.error('FAIL: Could not extract token from link');
                return;
            }
        } else {
            console.log('No dev link returned. Check server logs if SMTP is not configured.');
            // We can't proceed automatically if we can't get the token here without SMTP.
            // But since I added the devLink fallback in auth.js, it should work.
            return;
        }

    } catch (err) {
        console.error('Request failed:', err.response ? err.response.data : err.message);
        return;
    }

    console.log('\n2. Resetting Password...');
    try {
        const newPassword = 'newpassword123';
        const res = await axios.post(`${baseUrl}/auth/reset-password`, {
            token,
            newPassword
        });
        console.log('Reset Response:', res.data);
    } catch (err) {
        console.error('Reset failed:', err.response ? err.response.data : err.message);
    }

    console.log('\n3. Verifying Login with new password...');
    try {
        const res = await axios.post(`${baseUrl}/auth/login`, {
            email,
            password: 'newpassword123'
        });
        console.log('Login Success! Token received:', res.data.token ? 'YES' : 'NO');
    } catch (err) {
        console.error('Login failed:', err.response ? err.response.data : err.message);
    }
}

verifyResetFlow();
