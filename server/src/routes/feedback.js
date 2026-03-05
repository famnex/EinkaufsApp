const express = require('express');
const router = express.Router();
const { ProductReport, User, Product } = require('../models');
const { auth, admin } = require('../middleware/auth');

// POST /api/feedback/report-issue
// ... (omitted for brevity in instruction, will be in replacement content)
// Wait, I should provide the full content or a proper chunk.

router.post('/report-issue', auth, async (req, res) => {
    try {
        const { productId, productName, variationId, issueType, description, context } = req.body;
        const userId = req.user.id;

        const report = await ProductReport.create({
            UserId: userId,
            ProductId: productId,
            ProductVariationId: variationId,
            productName,
            issueType,
            description,
            context,
            status: 'open'
        });

        res.status(201).json({
            message: 'Vielen Dank für deine Meldung!',
            reportId: report.id
        });
    } catch (err) {
        console.error('Error saving product report:', err);
        res.status(500).json({ error: 'Meldung konnte nicht gespeichert werden.' });
    }
});

// GET /api/feedback/ (Admin only)
router.get('/', auth, admin, async (req, res) => {
    try {
        const reports = await ProductReport.findAll({
            include: [
                { model: User, attributes: ['id', 'username', 'email'] },
                { model: Product, attributes: ['id', 'name', 'category'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(reports);
    } catch (err) {
        console.error('Error fetching product reports:', err);
        res.status(500).json({ error: 'Berichte konnten nicht geladen werden.' });
    }
});

// GET /api/feedback/stats (Admin only)
router.get('/stats', auth, admin, async (req, res) => {
    try {
        const openCount = await ProductReport.count({ where: { status: 'open' } });
        res.json({ open: openCount });
    } catch (err) {
        console.error('Error fetching product report stats:', err);
        res.status(500).json({ error: 'Statistiken konnten nicht geladen werden.' });
    }
});

// Bulk Status Update (Admin only)
router.post('/bulk/status', auth, admin, async (req, res) => {
    try {
        const { ids, status } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Keine IDs angegeben.' });

        await ProductReport.update({ status }, { where: { id: ids } });
        res.json({ message: `${ids.length} Berichte aktualisiert.` });
    } catch (err) {
        console.error('Error bulk updating product reports:', err);
        res.status(500).json({ error: 'Berichte konnten nicht aktualisiert werden.' });
    }
});

// Bulk Delete (Admin only)
router.post('/bulk/delete', auth, admin, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Keine IDs angegeben.' });

        await ProductReport.destroy({ where: { id: ids } });
        res.json({ message: `${ids.length} Berichte gelöscht.` });
    } catch (err) {
        console.error('Error bulk deleting product reports:', err);
        res.status(500).json({ error: 'Berichte konnten nicht gelöscht werden.' });
    }
});

// PATCH /api/feedback/:id (Admin only)
router.patch('/:id', auth, admin, async (req, res) => {
    try {
        const { status } = req.body;
        const report = await ProductReport.findByPk(req.params.id);
        if (!report) return res.status(404).json({ error: 'Bericht nicht gefunden.' });

        await report.update({ status });
        res.json(report);
    } catch (err) {
        console.error('Error updating product report:', err);
        res.status(500).json({ error: 'Bericht konnte nicht aktualisiert werden.' });
    }
});

// DELETE /api/feedback/:id (Admin only)
router.delete('/:id', auth, admin, async (req, res) => {
    try {
        const report = await ProductReport.findByPk(req.params.id);
        if (!report) return res.status(404).json({ error: 'Bericht nicht gefunden.' });

        await report.destroy();
        res.json({ message: 'Bericht gelöscht.' });
    } catch (err) {
        console.error('Error deleting product report:', err);
        res.status(500).json({ error: 'Bericht konnte nicht gelöscht werden.' });
    }
});

module.exports = router;
