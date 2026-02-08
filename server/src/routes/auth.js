const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Settings } = require('../models');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

// Configure multer for cookbook image
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userId = req.user.id;
        const uploadDir = path.join(__dirname, `../../public/uploads/users/${userId}/cookbook`);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'cookbook' + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Get current user profile
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'role', 'sharingKey', 'alexaApiKey', 'cookbookTitle', 'cookbookImage']
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile (Title & Image)
router.put('/profile', auth, upload.single('image'), async (req, res) => {
    try {
        const { cookbookTitle } = req.body;
        const updates = {};
        if (cookbookTitle !== undefined) updates.cookbookTitle = cookbookTitle;
        if (req.file) {
            updates.cookbookImage = `/uploads/users/${req.user.id}/cookbook/${req.file.filename}`;
        } else if (req.body.cookbookImage === null || req.body.cookbookImage === 'null') {
            updates.cookbookImage = null;
        }

        await User.update(updates, { where: { id: req.user.id } });
        const updatedUser = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'role', 'sharingKey', 'alexaApiKey', 'cookbookTitle', 'cookbookImage']
        });
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Regenerate Sharing Key
router.post('/regenerate-sharing-key', auth, async (req, res) => {
    try {
        const newKey = crypto.randomBytes(8).toString('hex');
        await User.update({ sharingKey: newKey }, { where: { id: req.user.id } });
        res.json({ sharingKey: newKey });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, sharingKey: user.sharingKey, alexaApiKey: user.alexaApiKey } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Signup
router.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        const userCount = await User.count();
        const isFirstUser = userCount === 0;

        // Check registration setting ONLY if not first user
        if (!isFirstUser) {
            const regSetting = await Settings.findOne({ where: { key: 'registration_enabled' } });
            if (regSetting && regSetting.value === 'false') {
                return res.status(403).json({ error: 'Registrierung ist deaktiviert.' });
            }
        }

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) return res.status(400).json({ error: 'Username already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            password: hashedPassword,
            email,
            role: isFirstUser ? 'admin' : 'user' // First user is always admin
        });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(201).json({ token, user: { id: user.id, username: user.username, role: user.role, sharingKey: user.sharingKey, alexaApiKey: user.alexaApiKey } });
    } catch (err) {
        console.error('Signup Error:', err); // Debug Log
        if (!process.env.JWT_SECRET) console.error('CRITICAL: JWT_SECRET is missing!');
        res.status(500).json({ error: err.message });
    }
});

// Check Registration Status (Public)
router.get('/registration-status', async (req, res) => {
    try {
        const [regSetting, userCount] = await Promise.all([
            Settings.findOne({ where: { key: 'registration_enabled' } }),
            User.count()
        ]);

        // Default to true if not set
        res.json({
            enabled: !regSetting || regSetting.value !== 'false',
            setupRequired: userCount === 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Implementation for LDAP would go here...

module.exports = router;
