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
            // 1. Capture Screenshot (BEFORE banning)
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

            // 2. Auto-Banning Logic & User Linking
            let accusedUserId = null;
            try {
                const { User, Recipe } = require('../models');
                const urlObj = new URL(contentUrl);
                const pathParts = urlObj.pathname.split('/');

                // Expected patterns:
                // Frontend: /shared/:sharingKey or /shared/:sharingKey/recipe/:recipeId
                // API: /public/cookbook/:sharingKey or /public/recipe/:sharingKey/:recipeId

                if (pathParts.includes('public') || pathParts.includes('shared')) {

                    // Regex for extraction
                    // Regex for extraction (supports public and shared routes)
                    // Cookbook: /shared/KEY/cookbook or /public/cookbook/KEY
                    // Recipe: /shared/KEY/recipe/ID or /public/recipe/KEY/ID

                    const cookbookMatch = contentUrl.match(/\/(?:shared|public)\/(?:cookbook\/)?([a-zA-Z0-9-]+)(?:\/cookbook)?/);
                    let recipeMatch = contentUrl.match(/\/(?:shared|public)\/(?:recipe\/)?([a-zA-Z0-9-]+)(?:\/recipe\/|\/)(\d+)/);

                    if (recipeMatch) {
                        const sharingKey = recipeMatch[1];
                        const recipeId = recipeMatch[2];
                        console.log(`[Compliance] Detected reported recipe ${recipeId} with key ${sharingKey}. Banning...`);

                        const user = await User.findOne({ where: { sharingKey } });
                        if (user) {
                            accusedUserId = user.id; // Capture for report
                            const recipe = await Recipe.findOne({ where: { id: recipeId, UserId: user.id } });
                            if (recipe) {
                                recipe.bannedAt = new Date();
                                await recipe.save();
                                console.log(`[Compliance] Recipe ${recipe.id} banned.`);
                            }
                        }
                    } else if (cookbookMatch) {
                        const sharingKey = cookbookMatch[1];
                        console.log(`[Compliance] Detected reported cookbook with key: ${sharingKey}. Banning...`);
                        const user = await User.findOne({ where: { sharingKey } });
                        if (user) {
                            accusedUserId = user.id; // Capture for report
                            user.bannedAt = new Date();
                            user.isPublicCookbook = false; // Immediate offline
                            await user.save();
                            console.log(`[Compliance] User ${user.id} cookbook banned.`);
                        }
                    }
                }
            } catch (banErr) {
                console.error('[Compliance] Auto-ban failed:', banErr);
                // Continue execution, don't fail report
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
            screenshotPath,
            accusedUserId // Set immediately if found
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
        const { User } = require('../models'); // Ensure model is available
        const reports = await ComplianceReport.findAll({
            include: [
                { model: User, as: 'accusedUser', attributes: ['id', 'username', 'email'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Enrich with strike counts (N+1 but acceptable for this scale)
        const enrichedReports = await Promise.all(reports.map(async (r) => {
            const report = r.toJSON();
            if (report.accusedUserId) {
                const count = await ComplianceReport.count({
                    where: {
                        accusedUserId: report.accusedUserId,
                        status: 'resolved'
                    }
                });
                if (report.accusedUser) {
                    report.accusedUser.strikeCount = count;
                }
            }
            return report;
        }));

        res.json(enrichedReports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update report status (Admin only)
router.put('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    try {
        const { status, resolutionNote, internalNote, accusedUserId } = req.body;
        const report = await ComplianceReport.findByPk(req.params.id);

        if (!report) return res.status(404).json({ error: 'Meldung nicht gefunden' });

        // Check Finality: If report is already in a final state, prevent any changes
        if (report.status === 'resolved' || report.status === 'dismissed') {
            return res.status(400).json({ error: 'Dieser Fall ist bereits abgeschlossen und kann nicht mehr bearbeitet werden.' });
        }

        // Update Report
        // Note: We only update if the value is provided in the request
        await report.update({
            status: status || report.status,
            resolutionNote: resolutionNote !== undefined ? resolutionNote : report.resolutionNote,
            internalNote: internalNote !== undefined ? internalNote : report.internalNote,
            accusedUserId: accusedUserId !== undefined ? accusedUserId : report.accusedUserId
        });

        // ACTION HANDLER & EMAIL NOTIFICATION
        if (status === 'resolved' || status === 'dismissed') {
            const { User, Recipe } = require('../models');
            const contentUrl = report.contentUrl;

            // 1. Execute Actions (Ban/Delete/Unban)
            if (contentUrl) {
                try {
                    // Regex for extraction (supports public and shared routes)
                    // Cookbook: /shared/KEY/cookbook or /public/cookbook/KEY
                    // Recipe: /shared/KEY/recipe/ID or /public/recipe/KEY/ID

                    const cookbookMatch = contentUrl.match(/\/(?:shared|public)\/(?:cookbook\/)?([a-zA-Z0-9-]+)(?:\/cookbook)?/);
                    let recipeMatch = contentUrl.match(/\/(?:shared|public)\/(?:recipe\/)?([a-zA-Z0-9-]+)(?:\/recipe\/|\/)(\d+)/);

                    if (recipeMatch) {
                        const sharingKey = recipeMatch[1];
                        const recipeId = recipeMatch[2];
                        const user = await User.findOne({ where: { sharingKey } });

                        if (user) {
                            const recipe = await Recipe.findOne({ where: { id: recipeId, UserId: user.id } });
                            if (recipe) {
                                if (status === 'resolved') {
                                    // DELETE Recipe
                                    await recipe.destroy();
                                    console.log(`[Compliance] Recipe ${recipe.id} DELETED (Report Resolved).`);
                                } else if (status === 'dismissed') {
                                    // UNBAN Recipe
                                    recipe.bannedAt = null;
                                    await recipe.save();
                                    console.log(`[Compliance] Recipe ${recipe.id} UNBANNED (Report Dismissed).`);
                                }
                            }
                        }
                    } else if (cookbookMatch) {
                        const sharingKey = cookbookMatch[1];
                        const user = await User.findOne({ where: { sharingKey } });

                        if (user) {
                            if (status === 'resolved') {
                                // UNBAN Cookbook (Content removed by admin/user?) - User strict instruction: "bannedat status is removed so that it can be accessed again"
                                user.bannedAt = null;
                                user.isPublicCookbook = true; // Restore public status? Or just let user decide? Assuming restore.
                                await user.save();
                                console.log(`[Compliance] Cookbook (User ${user.id}) UNBANNED (Report Resolved - Content Cleaned).`);
                            } else if (status === 'dismissed') {
                                // UNBAN Cookbook
                                user.bannedAt = null;
                                user.isPublicCookbook = true;
                                await user.save();
                                console.log(`[Compliance] Cookbook (User ${user.id}) UNBANNED (Report Dismissed).`);
                            }
                        }
                    }
                } catch (actionErr) {
                    console.error('[Compliance] Action handler error:', actionErr);
                    // Don't fail the request, just log
                }
            }

            // 2. Send Resolution Email to Reporter
            const actionText = status === 'resolved' ? 'Der gemeldete Inhalt wurde entfernt.' : 'Die Meldung wurde abgelehnt (kein Verstoß festgestellt).';
            const emailSubject = `Update zu Ihrer Meldung [${report.id}]`;

            // 3. Send Warning Email to Content Creator (Only if Resolved/Removed)
            if (status === 'resolved') {
                try {
                    let targetUser = null;

                    // Priority 1: Use manually linked user or already identified user
                    if (report.accusedUserId) {
                        targetUser = await User.findByPk(report.accusedUserId);
                    }

                    // Priority 2: Try to extract from URL if not linked
                    if (!targetUser && contentUrl) {
                        const cookbookMatch = contentUrl.match(/\/(?:shared|public)\/(?:cookbook\/)?([a-zA-Z0-9-]+)(?:\/cookbook)?/);
                        let recipeMatch = contentUrl.match(/\/(?:shared|public)\/(?:recipe\/)?([a-zA-Z0-9-]+)(?:\/recipe\/|\/)(\d+)/);

                        if (recipeMatch) {
                            const sharingKey = recipeMatch[1];
                            targetUser = await User.findOne({ where: { sharingKey } });
                        } else if (cookbookMatch) {
                            const sharingKey = cookbookMatch[1];
                            targetUser = await User.findOne({ where: { sharingKey } });
                        }
                    }

                    if (targetUser && targetUser.email) {
                        // Ensure link exists if we found them via URL
                        if (!report.accusedUserId) {
                            try {
                                await report.update({ accusedUserId: targetUser.id });
                                console.log(`[Compliance] Linked report ${report.id} to user ${targetUser.id}.`);
                            } catch (linkErr) {
                                console.error('[Compliance] Failed to auto-link accused user:', linkErr);
                            }
                        }

                        const warningSubject = `Wichtiger Hinweis zu Ihrem Inhalt auf GabelGuru`;
                        const warningText = `Hallo ${targetUser.username || 'Nutzer'},\n\n` +
                            `wir haben eine Meldung zu einem Ihrer Inhalte erhalten und geprüft. Dabei wurde ein Verstoß gegen unsere Richtlinien festgestellt.\n\n` +
                            `Der betroffene Inhalt wurde daher entfernt.\n\n` +
                            `Grund: ${resolutionNote || 'Verstoß gegen Nutzungsbedingungen'}\n\n` +
                            `Dies ist eine formelle Verwarnung. Wir bitten Sie, zukünftig genau auf die Einhaltung unserer Regeln zu achten. ` +
                            `Bitte beachten Sie, dass bei wiederholten Verstößen Ihr Benutzerkonto temporär oder dauerhaft gesperrt werden kann.\n\n` +
                            `Wir schätzen Sie als Teil unserer Community und hoffen auf Ihr Verständnis.\n\n` +
                            `Mit freundlichen Grüßen,\nIhr GabelGuru Compliance Team`;

                        const warningHtml = `
                            <div style="font-family: Arial, sans-serif;">
                                <h2>Wichtiger Hinweis zu Ihrem Inhalt</h2>
                                <p>Hallo ${targetUser.username || 'Nutzer'},</p>
                                <p>wir haben eine Meldung zu einem Ihrer Inhalte erhalten und geprüft. Dabei wurde leider ein Verstoß gegen unsere Richtlinien festgestellt.</p>
                                <p style="color: #d32f2f; font-weight: bold;">Der betroffene Inhalt wurde daher dauerhaft entfernt.</p>
                                <hr>
                                <h3>Begründung:</h3>
                                <p style="background-color: #fff3e0; padding: 10px; border-left: 4px solid #ff9800;">
                                    ${(resolutionNote || 'Verstoß gegen Nutzungsbedingungen').replace(/\n/g, '<br>')}
                                </p>
                                <hr>
                                <p><strong>Dies ist eine formelle Verwarnung.</strong></p>
                                <p>Wir bitten Sie, zukünftig genau auf die Einhaltung unserer Regeln zu achten. Bitte beachten Sie, dass bei wiederholten Verstößen Ihr Benutzerkonto temporär oder dauerhaft gesperrt werden kann.</p>
                                <p>Wir schätzen Sie als Teil unserer Community und hoffen auf Ihr Verständnis.</p>
                                <p>Mit freundlichen Grüßen,<br>Ihr GabelGuru Compliance Team</p>
                            </div>
                        `;

                        sendSystemEmail({
                            to: targetUser.email,
                            subject: warningSubject,
                            text: warningText,
                            html: warningHtml
                        }).then(success => {
                            if (success) console.log(`[Compliance] Warning email sent to Creator (${targetUser.email})`);
                            else console.warn(`[Compliance] Failed to send warning email to Creator (${targetUser.email})`);
                        });
                    }
                } catch (warnErr) {
                    console.error('[Compliance] Failed to process warning email:', warnErr);
                }
            }
            const emailText = `Guten Tag ${report.reporterName},\n\nDer Status Ihrer Meldung hat sich geändert: ${status === 'resolved' ? 'Gelöst' : 'Abgeschlossen'}\n\nErgebnis: ${actionText}\n\nBegründung: ${resolutionNote || 'Keine Begründung angegeben.'}\n\nMit freundlichen Grüßen,\nIhr GabelGuru Compliance Team`;

            const emailHtml = `
                <div style="font-family: Arial, sans-serif;">
                    <h2>Update zu Ihrer Meldung</h2>
                    <p>Guten Tag ${report.reporterName},</p>
                    <p>Wir haben Ihre Meldung bearbeitet.</p>
                    <hr>
                    <h3>Ergebnis:</h3>
                    <p><strong>Status:</strong> ${status === 'resolved' ? '<span style="color:green">Gelöst / Entfernt</span>' : '<span style="color:gray">Abgelehnt / Kein Verstoß</span>'}</p>
                    <p>${actionText}</p>
                    <br>
                    <h3>Begründung:</h3>
                    <p style="background-color: #f5f5f5; padding: 10px; border-left: 4px solid #ccc;">
                        ${(resolutionNote || 'Keine Begründung angegeben.').replace(/\n/g, '<br>')}
                    </p>
                    <hr>
                    <p>Mit freundlichen Grüßen,<br>Ihr GabelGuru Compliance Team</p>
                </div>
            `;

            sendSystemEmail({
                to: report.reporterEmail,
                subject: emailSubject,
                text: emailText,
                html: emailHtml
            }).then(success => {
                if (success) console.log(`[Compliance] Resolution email sent to ${report.reporterEmail}`);
                else console.warn(`[Compliance] Failed to send resolution email to ${report.reporterEmail}`);
            });
        }

        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
