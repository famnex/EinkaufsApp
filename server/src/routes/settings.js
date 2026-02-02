const express = require('express');
const router = express.Router();
const { Settings } = require('../models');
const { auth } = require('../middleware/auth');

// Get a setting by key
router.get('/:key', auth, async (req, res) => {
    try {
        const setting = await Settings.findOne({ where: { key: req.params.key } });
        res.json({ value: setting ? setting.value : '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save a setting
router.post('/', auth, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'Key is required' });

        const [setting, created] = await Settings.findOrCreate({
            where: { key },
            defaults: { value }
        });

        if (!created) {
            await setting.update({ value });
        }

        res.json(setting);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
