const axios = require('axios');
const jwt = require('jsonwebtoken');

const secret = 'supersecretkey'; // From .env
const adminUser = { id: 1, role: 'admin', username: 'famnex' };
const token = jwt.sign(adminUser, secret, { expiresIn: '1h' });

async function testUpdate() {
    try {
        console.log('Testing update with token for user:', adminUser.username);

        // Random color to verify change
        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        console.log('Setting accent color to:', randomColor);

        const response = await axios.post('http://localhost:5000/api/system/settings', {
            key: 'system_accent_color',
            value: randomColor
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Response status:', response.status);
        console.log('Response data:', response.data);

    } catch (err) {
        console.error('Error updating settings:', err.response ? err.response.data : err.message);
    }
}

testUpdate();
