const express = require('express');
const router = express.Router();
const { Store } = require('../models');
const { auth, admin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.user ? req.user.effectiveId : 'unknown';
        const uploadDir = path.join(__dirname, `../../public/uploads/users/${userId}/stores`);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'store-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Get all stores
router.get('/', auth, async (req, res) => {
    try {
        const stores = await Store.findAll({
            where: { UserId: req.user.effectiveId },
            order: [['name', 'ASC']]
        });
        res.json(stores);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new store (Admin)
router.post('/', auth, upload.single('logo'), async (req, res) => {
    try {
        const { name } = req.body;
        const logo_url = req.file ? `/uploads/users/${req.user.effectiveId}/stores/${req.file.filename}` : null;

        const store = await Store.create({ name, logo_url, UserId: req.user.effectiveId });
        res.status(201).json(store);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update store (Admin)
router.put('/:id', auth, upload.single('logo'), async (req, res) => {
    try {
        const store = await Store.findOne({ where: { id: req.params.id, UserId: req.user.effectiveId } });
        if (!store) return res.status(404).json({ error: 'Store not found or unauthorized' });

        const updates = { name: req.body.name };
        if (req.file) {
            updates.logo_url = `/uploads/users/${req.user.effectiveId}/stores/${req.file.filename}`;
        }

        await store.update(updates);
        res.json(store);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete store (Admin)
router.delete('/:id', auth, async (req, res) => {
    try {
        const store = await Store.findOne({ where: { id: req.params.id, UserId: req.user.effectiveId } });
        if (!store) return res.status(404).json({ error: 'Store not found or unauthorized' });
        await store.destroy();
        res.json({ message: 'Store deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
