const express = require('express');
const router = express.Router();
const { ComplianceReport } = require('../models');
const { auth } = require('../middleware/auth');
const { sendSystemEmail, notifyAdmins } = require('../services/emailService');
const logger = require('../utils/logger');
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
        let accusedUserId = null;
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
                logger.logError('Screenshot capture failed:', err.message);
            }

            // 2. Auto-Banning Logic & User Linking
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
                        logger.logSystem(`[Compliance] Detected reported recipe ${recipeId} with key ${sharingKey}. Banning...`);

                        const user = await User.findOne({ where: { sharingKey } });
                        if (user) {
                            accusedUserId = user.id; // Capture for report
                            const recipe = await Recipe.findOne({ where: { id: recipeId, UserId: user.id } });
                            if (recipe) {
                                recipe.bannedAt = new Date();
                                await recipe.save();
                                logger.logSystem(`[Compliance] Recipe ${recipe.id} banned.`);
                            }
                        }
                    } else if (cookbookMatch) {
                        const sharingKey = cookbookMatch[1];
                        logger.logSystem(`[Compliance] Detected reported cookbook with key: ${sharingKey}. Banning...`);
                        const user = await User.findOne({ where: { sharingKey } });
                        if (user) {
                            accusedUserId = user.id; // Capture for report
                            user.bannedAt = new Date();
                            user.isPublicCookbook = false; // Immediate offline
                            await user.save();
                            logger.logSystem(`[Compliance] User ${user.id} cookbook banned.`);
                        }
                    }
                }
            } catch (banErr) {
                logger.logError('[Compliance] Auto-ban failed:', banErr);
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
        const emailText = `Guten Tag ${reporterName},\n\nIhre Meldung wurde erfolgreich eingereicht.\n\nDetails:\nID: ${report.id}\nKategorie: ${reasonCategory}\nAnmerkung: ${reasonDescription}\n\nWir werden Ihre Meldung prüfen.`;

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
                <p>Wir werden Ihre Meldung sorgfältig prüfen und Sie über das Ergebnis informieren.</p>
            </div>
        `;

        // Send email asynchronously (fire and forget for response speed, but log result)
        sendSystemEmail({
            to: reporterEmail,
            subject: emailSubject,
            text: emailText,
            html: emailHtml
        }).then(success => {
            if (success) logger.logSystem(`[Compliance] Confirmation email sent to ${reporterEmail}`);
            else logger.logError(`[Compliance] Failed to send confirmation email to ${reporterEmail}`);
        });

        // Notify Admins
        notifyAdmins({
            subject: `🚨 Neue Meldung eingegangen: ${reasonCategory}`,
            text: `Hallo Admin,\n\neine neue Compliance-Meldung [${report.id}] wurde eingereicht.\n\nKategorie: ${reasonCategory}\nURL: ${contentUrl}\nAnmerkung: ${reasonDescription}\n\nBitte im Admin-Bereich prüfen.`,
            html: `
                <div style="font-family: Arial, sans-serif; border: 2px solid #d32f2f; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #d32f2f;">🚨 Neue Compliance-Meldung</h2>
                    <p>Hallo Admin,</p>
                    <p>eine neue Meldung wurde soeben im System erfasst.</p>
                    <hr>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 5px; font-weight: bold;">ID:</td><td>${report.id}</td></tr>
                        <tr><td style="padding: 5px; font-weight: bold;">Kategorie:</td><td>${reasonCategory}</td></tr>
                        <tr><td style="padding: 5px; font-weight: bold;">Status:</td><td>Offen (Auto-Bann geprüft)</td></tr>
                        <tr><td style="padding: 5px; font-weight: bold;">URL:</td><td><a href="${contentUrl}">${contentUrl}</a></td></tr>
                    </table>
                    <p><strong>Beschreibung:</strong><br>${reasonDescription}</p>
                    <hr>
                    <p>Bitte logge dich ein, um die Meldung im Admin-Bereich zu bearbeiten.</p>
                </div>
            `
        });

        res.status(201).json({ success: true, message: 'Meldung erfolgreich eingereicht.', reportId: report.id });
    } catch (error) {
        logger.logError('Compliance report error:', error);
        res.status(500).json({ error: 'Bericht konnte nicht eingereicht werden.' });
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
        logger.logError('Error getting compliance stats:', err);
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
        logger.logError('Error listing compliance reports:', err);
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
                                    logger.logSystem(`[Compliance] Recipe ${recipe.id} DELETED (Report Resolved).`);
                                } else if (status === 'dismissed') {
                                    // UNBAN Recipe
                                    recipe.bannedAt = null;
                                    await recipe.save();
                                    logger.logSystem(`[Compliance] Recipe ${recipe.id} UNBANNED (Report Dismissed).`);
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
                                logger.logSystem(`[Compliance] Cookbook (User ${user.id}) UNBANNED (Report Resolved - Content Cleaned).`);
                            } else if (status === 'dismissed') {
                                // UNBAN Cookbook
                                user.bannedAt = null;
                                user.isPublicCookbook = true;
                                await user.save();
                                logger.logSystem(`[Compliance] Cookbook (User ${user.id}) UNBANNED (Report Dismissed).`);
                            }
                        }
                    }
                } catch (actionErr) {
                    logger.logError('[Compliance] Action handler error:', actionErr);
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
                                logger.logSystem(`[Compliance] Linked report ${report.id} to user ${targetUser.id}.`);
                            } catch (linkErr) {
                                logger.logError('[Compliance] Failed to auto-link accused user:', linkErr);
                            }
                        }

                        const warningSubject = `Wichtiger Hinweis zu Ihrem Inhalt auf GabelGuru`;
                        const warningText = `Hallo ${targetUser.username || 'Nutzer'},\n\n` +
                            `wir haben eine Meldung zu einem Ihrer Inhalte erhalten und geprüft. Dabei wurde ein Verstoß gegen unsere Richtlinien festgestellt.\n\n` +
                            `Der betroffene Inhalt wurde daher entfernt.\n\n` +
                            `Grund: ${resolutionNote || 'Verstoß gegen Nutzungsbedingungen'}\n\n` +
                            `Dies ist eine formelle Verwarnung. Wir bitten Sie, zukünftig genau auf die Einhaltung unserer Regeln zu achten. ` +
                            `Bitte beachten Sie, dass bei wiederholten Verstößen Ihr Benutzerkonto temporär oder dauerhaft gesperrt werden kann.\n\n` +
                            `Bitte prüfen Sie den Inhalt Ihres Rezeptes. Falls Sie der Meinung sind, dass dies ein Fehler war, kontaktieren Sie uns bitte.`;

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
                                <p>Bitte prüfen Sie den Inhalt Ihres Rezeptes. Falls Sie der Meinung sind, dass dies ein Fehler war, kontaktieren Sie uns bitte.</p>
                            </div>
                        `;

                        sendSystemEmail({
                            to: targetUser.email,
                            subject: warningSubject,
                            text: warningText,
                            html: warningHtml
                        }).then(success => {
                            if (success) logger.logSystem(`[Compliance] Warning email sent to Creator (${targetUser.email})`);
                            else logger.logError(`[Compliance] Failed to send warning email to Creator (${targetUser.email})`);
                        });
                    }
                } catch (warnErr) {
                    logger.logError('[Compliance] Failed to process warning email:', warnErr);
                }
            }
            const emailText = `Guten Tag ${report.reporterName},\n\nDer Status Ihrer Meldung hat sich geändert: ${status === 'resolved' ? 'Gelöst' : 'Abgeschlossen'}\n\nErgebnis: ${actionText}\n\nBegründung: ${resolutionNote || 'Keine Begründung angegeben.'}`;

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
                </div>
            `;

            sendSystemEmail({
                to: report.reporterEmail,
                subject: emailSubject,
                text: emailText,
                html: emailHtml
            }).then(success => {
                if (success) logger.logSystem(`[Compliance] Resolution email sent to ${report.reporterEmail}`);
                else logger.logError(`[Compliance] Failed to send resolution email to ${report.reporterEmail}`);
            });
        }

        res.json(report);
    } catch (err) {
        logger.logError('Error updating compliance report:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
