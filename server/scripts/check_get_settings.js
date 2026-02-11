const axios = require('axios');

async function checkSettingsEndpoint() {
    try {
        console.log('Fetching settings from http://localhost:5000/api/system/settings...');
        const { data } = await axios.get('http://localhost:5000/api/system/settings');
        console.log('Response:', data);
    } catch (err) {
        console.error('Error fetching settings:', err.message);
    }
}

checkSettingsEndpoint();
