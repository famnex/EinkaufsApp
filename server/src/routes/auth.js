const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Settings } = require('../models');

// Basic Login (Local)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ where: { username } });
        if (!user) return res.status(400).json({ error: 'Invalid username or password' });

        if (user.isLdap) {
            // LDAP Logic Placeholder
            return res.status(501).json({ error: 'LDAP login not fully implemented yet' });
        }

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Signup
router.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        // Check registration setting
        const regSetting = await Settings.findOne({ where: { key: 'registration_enabled' } });
        if (regSetting && regSetting.value === 'false') {
            return res.status(403).json({ error: 'Registrierung ist deaktiviert.' });
        }

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) return res.status(400).json({ error: 'Username already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            password: hashedPassword,
            email,
            role: 'user' // Default role
        });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(201).json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error('Signup Error:', err); // Debug Log
        if (!process.env.JWT_SECRET) console.error('CRITICAL: JWT_SECRET is missing!');
        res.status(500).json({ error: err.message });
    }
});

// Check Registration Status (Public)
router.get('/registration-status', async (req, res) => {
    try {
        const regSetting = await Settings.findOne({ where: { key: 'registration_enabled' } });
        // Default to true if not set
        res.json({ enabled: !regSetting || regSetting.value !== 'false' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Implementation for LDAP would go here...

module.exports = router;
