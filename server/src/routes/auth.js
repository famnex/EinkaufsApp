const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Settings } = require('../models');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configure multer for cookbook image
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userId = req.user.effectiveId;
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
            attributes: ['id', 'username', 'role', 'sharingKey', 'alexaApiKey', 'cookbookTitle', 'cookbookImage', 'householdId']
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
            updates.cookbookImage = `/uploads/users/${req.user.effectiveId}/cookbook/${req.file.filename}`;
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

// Generate Household Invitation Token
router.get('/household/invite', auth, async (req, res) => {
    try {
        if (req.user.householdId) {
            return res.status(403).json({ error: 'Nur der Haushalts-Besitzer kann Einladungen erstellen.' });
        }
        const payload = {
            inviterId: req.user.id,
            householdId: req.user.householdId || req.user.id,
            inviterName: req.user.username,
            type: 'household_invite'
        };
        // Invitation expires in 48 hours
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2d' });
        res.json({ token, inviterName: req.user.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /auth/household/members - List members of current household
router.get('/household/members', auth, async (req, res) => {
    try {
        const householdId = req.user.householdId || req.user.id;
        const members = await User.findAll({
            where: {
                [require('sequelize').Op.or]: [
                    { id: householdId },
                    { householdId: householdId }
                ]
            },
            attributes: ['id', 'username', 'email', 'role', 'cookbookTitle', 'householdId']
        });
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Household Invitation Info
router.get('/household/info', auth, async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'household_invite') {
            return res.status(400).json({ error: 'Invalid invitation type' });
        }
        res.json({
            inviterName: decoded.inviterName,
            householdId: decoded.householdId
        });
    } catch (err) {
        if (err.name === 'TokenExpiredError') return res.status(400).json({ error: 'Einladung ist abgelaufen' });
        res.status(400).json({ error: 'Ungültige Einladung' });
    }
});

// Join Household & Merge Data
router.post('/household/join', auth, async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'household_invite') {
            return res.status(400).json({ error: 'Invalid invitation type' });
        }

        const targetHouseholdId = decoded.householdId;
        const joiningUserId = req.user.id;

        if (joiningUserId === targetHouseholdId) {
            return res.status(400).json({ error: 'You are already the owner of this household' });
        }

        if (req.user.householdId === targetHouseholdId) {
            return res.status(400).json({ error: 'You are already in this household' });
        }

        const models = require('../models');
        const { sequelize, Manufacturer, Store, Tag, Settings, Product, Recipe, List, ListItem, Menu, Expense, HiddenCleanup, ProductSubstitution, RecipeTag, RecipeIngredient, ProductRelation } = models;

        await sequelize.transaction(async (t) => {
            // 1. Merge tables with unique constraints [name, UserId]
            // We'll handle Manufacturer, Store, Tag, Settings
            const uniqueModels = [
                { model: Manufacturer, dep: [{ model: Product, fk: 'ManufacturerId' }] },
                { model: Store, dep: [{ model: Product, fk: 'StoreId' }, { model: List, fk: 'CurrentStoreId' }, { model: ProductRelation, fk: 'StoreId' }] },
                { model: Tag, dep: [{ model: RecipeTag, fk: 'TagId' }] },
                { model: Settings, dep: [] }
            ];

            for (const { model, dep } of uniqueModels) {
                const joiningItems = await model.findAll({ where: { UserId: joiningUserId }, transaction: t });
                for (const item of joiningItems) {
                    const existing = await model.findOne({
                        where: { name: item.name, UserId: targetHouseholdId },
                        transaction: t
                    });

                    if (existing) {
                        // Re-link dependencies
                        for (const d of dep) {
                            await d.model.update(
                                { [d.fk]: existing.id },
                                { where: { [d.fk]: item.id }, transaction: t }
                            );
                        }
                        // Delete the duplicate
                        await item.destroy({ transaction: t });
                    } else {
                        // Safe to just re-assign
                        await item.update({ UserId: targetHouseholdId }, { transaction: t });
                    }
                }
            }

            // 2. Simple re-assignment for everything else
            const simpleModels = [
                Product, Recipe, List, ListItem, Menu, Expense, HiddenCleanup,
                ProductSubstitution, RecipeTag, RecipeIngredient, ProductRelation
            ];

            for (const model of simpleModels) {
                await model.update({ UserId: targetHouseholdId }, { where: { UserId: joiningUserId }, transaction: t });
            }

            // 3. Update User's householdId
            await req.user.update({ householdId: targetHouseholdId }, { transaction: t });
        });

        const updatedUser = await User.findByPk(joiningUserId, {
            attributes: ['id', 'username', 'role', 'sharingKey', 'alexaApiKey', 'cookbookTitle', 'cookbookImage', 'householdId']
        });

        res.json({ message: 'Erfolgreich dem Haushalt beigetreten', user: updatedUser });

    } catch (err) {
        console.error('Household join error:', err);
        if (err.name === 'TokenExpiredError') return res.status(400).json({ error: 'Einladung ist abgelaufen' });
        res.status(500).json({ error: 'Fehler beim Zusammenführen der Daten: ' + err.message });
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
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, sharingKey: user.sharingKey, alexaApiKey: user.alexaApiKey, householdId: user.householdId } });
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
