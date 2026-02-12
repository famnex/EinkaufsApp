const express = require('express');
const router = express.Router();
const { Settings } = require('../models');
const { auth } = require('../middleware/auth');

const { exec } = require('child_process');

// Get system version
router.get('/system/version', auth, (req, res) => {
    exec('git describe --tags --always', (error, stdout, stderr) => {
        if (error) {
            console.warn('Git describe failed:', error);
            return res.json({ version: require('../../package.json').version });
        }
        res.json({ version: stdout.trim() });
    });
});

// GET /logs - Admin only, paginated
router.get('/logs', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { limit = 50, offset = 0 } = req.query;
        const { LoginLog } = require('../models');

        const logs = await LoginLog.findAll({
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const total = await LoginLog.count();

        res.json({ logs, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /legal - Update legal texts (Admin only)
router.post('/legal', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { key, value } = req.body;
        // Allowed keys
        const allowed = ['legal_privacy', 'legal_imprint', 'legal_terms'];
        if (!allowed.includes(key)) return res.status(400).json({ error: 'Invalid legal text key' });

        const [setting] = await Settings.findOrCreate({
            where: { key, UserId: req.user.id }, // Bind to admin user or make global? 
            // Better: Bind to admin user who is editing it, OR make it global (UserId null).
            // Current Settings model enforces UserId. Let's use the admin's UserId.
            defaults: { value }
        });

        await setting.update({ value });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /legal/:type - Public endpoint for legal texts
router.get('/legal/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const allowed = ['legal_privacy', 'legal_imprint', 'legal_terms'];
        // Map param to key
        const keyMap = {
            'privacy': 'legal_privacy',
            'imprint': 'legal_imprint',
            'terms': 'legal_terms'
        };

        const dbKey = keyMap[type];
        if (!dbKey) return res.status(400).json({ error: 'Invalid type' });

        // Fetch from ANY admin user (assuming single tenant or main admin)
        // For simplicity, we fetch the most recently updated one or from the first admin found.
        // Actually, let's just find one.
        const setting = await Settings.findOne({
            where: { key: dbKey }
        });

        res.json({ value: setting ? setting.value : '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a setting by key
router.get('/:key', auth, async (req, res) => {
    try {
        const setting = await Settings.findOne({ where: { key: req.params.key, UserId: req.user.effectiveId } });
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
            where: { key, UserId: req.user.effectiveId },
            defaults: { value, UserId: req.user.effectiveId }
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
