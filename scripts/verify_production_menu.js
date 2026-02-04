const axios = require('../server/node_modules/axios');

const API_URL = 'https://famnex.uber.space/EinkaufsApp/api/alexa/menu';
const KEY = '700e31dec5384bdd96c0a18125083f52';

async function check() {
    try {
        console.log(`Checking ${API_URL}...`);
        const res = await axios.post(API_URL, {
            tag: 'morgen',
            art: 'abendbrot'
        }, {
            headers: { Authorization: `Bearer ${KEY}` }
        });

        console.log('Status:', res.status);
        console.log('Data:', res.data);
    } catch (err) {
        if (err.response) {
            console.error('Error Status:', err.response.status);
            console.error('Error Data:', err.response.data);
        } else {
            console.error('Error:', err.message);
        }
    }
}

check();
