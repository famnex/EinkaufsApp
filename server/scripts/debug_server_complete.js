const express = require('express');
const { sequelize, User } = require('../src/models');
const { auth } = require('../src/middleware/auth');
const listRoutes = require('../src/routes/lists');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

async function debugServer() {
    try {
        console.log('--- STARTING DEBUG SERVER ---');
        await sequelize.authenticate();
        console.log('DB Connection OK');

        const app = express();
        app.use(express.json());

        // Mock Auth Middleware to verify if REAL auth is breaking
        app.use((req, res, next) => {
            console.log(`[Request] ${req.method} ${req.url}`);
            next();
        });

        // Generate a valid token for the test
        const adminUser = await User.findOne();
        if (!adminUser) throw new Error('No user found to test auth');

        const token = jwt.sign({ id: adminUser.id }, process.env.JWT_SECRET || 'secret');
        console.log('Generated Test Token for User:', adminUser.username);

        app.use('/api/lists', listRoutes);

        const PORT = 5002;
        const server = app.listen(PORT, async () => {
            console.log(`Debug Server running on ${PORT}`);

            // PERFORM REQUEST
            const fetch = (await import('node-fetch')).default;
            try {
                const res = await fetch(`http://localhost:${PORT}/api/lists`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                console.log('Response Status:', res.status);
                const data = await res.json();
                if (res.status === 200) {
                    console.log('Success! Found lists:', data.length);
                } else {
                    console.log('FAILURE RESPONSE:', JSON.stringify(data, null, 2));
                }
            } catch (fetchErr) {
                console.error('Fetch Error:', fetchErr);
            } finally {
                server.close();
                console.log('Debug Server Closed');
            }
        });

    } catch (err) {
        console.error('CRITICAL STARTUP ERROR:', err);
    }
}

debugServer();
