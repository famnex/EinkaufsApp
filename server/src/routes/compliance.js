const express = require('express');
const router = express.Router();
const { ComplianceReport } = require('../models');
const { auth } = require('../middleware/auth');
const { sendSystemEmail } = require('../services/emailService');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/compliance');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// POST / - Create a new compliance report (Public)
router.post('/', async (req, res) => {
    try {
        const {
            reporterName,
            reporterEmail,
            reporterRole,
            contentUrl,
            contentType,
            reasonCategory,
            reasonDescription,
            originalSourceUrl,
            confirmAccuracy,
            confirmPrivacy
        } = req.body;

        // Validation
        if (!confirmAccuracy || !confirmPrivacy) {
            return res.status(400).json({ error: 'Bitte bestätigen Sie die Pflichtfelder.' });
        }

        if (!reporterName || !reporterEmail || !contentUrl || !reasonCategory || !reasonDescription) {
            return res.status(400).json({ error: 'Bitte füllen Sie alle Pflichtfelder aus.' });
        }

        // Capture Screenshot
        let screenshotPath = null;
        if (contentUrl) {
            try {
                const browser = await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                const page = await browser.newPage();
                await page.setViewport({ width: 1280, height: 720 });
                await page.goto(contentUrl, { waitUntil: 'networkidle2', timeout: 30000 });

                // Force hide splash screen via CSS injection
                await page.addStyleTag({ content: '#splash-screen { display: none !important; opacity: 0 !important; visibility: hidden !important; }' });

                // Wait a moment for rendering to update
                await new Promise(r => setTimeout(r, 1000));

                const filename = `report_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const filepath = path.join(uploadDir, filename);

                await page.screenshot({ path: filepath, type: 'jpeg', quality: 70 });
                await browser.close();

                screenshotPath = `/uploads/compliance/${filename}`;
            } catch (err) {
                console.error('Screenshot capture failed:', err.message);
            }
        }

        // Create Report
        const report = await ComplianceReport.create({
            reporterName,
            reporterEmail,
            reporterRole,
            contentUrl,
            contentType,
            reasonCategory,
            reasonDescription,
            originalSourceUrl,
            screenshotPath
        });

        // Send Confirmation Email
        const emailSubject = `Eingangsbestätigung: Ihre Meldung [${report.id}]`;
        const emailText = `Guten Tag ${reporterName},\n\nIhre Meldung wurde erfolgreich eingereicht.\n\nDetails:\nID: ${report.id}\nKategorie: ${reasonCategory}\nAnmerkung: ${reasonDescription}\n\nWir werden Ihre Meldung prüfen.\n\nMit freundlichen Grüßen,\nIhr GabelGuru Compliance Team`;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif;">
                <h2>Eingangsbestätigung</h2>
                <p>Guten Tag ${reporterName},</p>
                <p>Ihre Meldung wurde erfolgreich bei uns eingereicht.</p>
                <hr>
                <h3>Details Ihrer Meldung:</h3>
                <ul>
                    <li><strong>ID:</strong> ${report.id}</li>
                    <li><strong>Kategorie:</strong> ${reasonCategory}</li>
                    <li><strong>Anmerkung:</strong> ${reasonDescription}</li>
                    <li><strong>URL:</strong> <a href="${contentUrl}">${contentUrl}</a></li>
                </ul>
                <hr>
                <p>Wir werden den Sachverhalt schnellstmöglich prüfen.</p>
                <p>Mit freundlichen Grüßen,<br>Ihr GabelGuru Compliance Team</p>
            </div>
        `;

        // Send email asynchronously (fire and forget for response speed, but log result)
        sendSystemEmail({
            to: reporterEmail,
            subject: emailSubject,
            text: emailText,
            html: emailHtml
        }).then(success => {
            if (success) console.log(`[Compliance] Confirmation email sent to ${reporterEmail}`);
            else console.warn(`[Compliance] Failed to send confirmation email to ${reporterEmail}`);
        });

        res.status(201).json({ success: true, message: 'Meldung erfolgreich eingereicht.', reportId: report.id });
    } catch (err) {
        console.error('Compliance Report Error:', err);
        res.status(500).json({ error: 'Interner Serverfehler beim Speichern der Meldung.' });
    }
});

// GET /stats - Get compliance statistics (Admin only)
router.get('/stats', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const openCount = await ComplianceReport.count({
            where: {
                status: ['open', 'investigating', 'in_progress'] // Adjust statuses as needed
            }
        });
        res.json({ open: openCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET / - List all reports (Admin only)
router.get('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const reports = await ComplianceReport.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update report status (Admin only)
router.put('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { status, resolutionNote } = req.body;
        const report = await ComplianceReport.findByPk(req.params.id);

        if (!report) return res.status(404).json({ error: 'Meldung nicht gefunden' });

        await report.update({
            status: status || report.status,
            resolutionNote: resolutionNote !== undefined ? resolutionNote : report.resolutionNote
        });

        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
