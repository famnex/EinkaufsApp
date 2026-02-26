const express = require('express');
const router = express.Router();
const { auth, admin } = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');
const { readAlexaLogs } = require('../utils/logger');
const { Settings, Recipe, User, Store, ComplianceReport } = require('../models');

// Helper to run a command and return promise (for non-streaming checks)
const runCommand = (cmd, args, cwd) => {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { cwd });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => stdout += data.toString());
        proc.stderr.on('data', (data) => stderr += data.toString());

        proc.on('close', (code) => {
            if (code === 0) resolve(stdout.trim());
            else reject(new Error(stderr || stdout));
        });
    });
};

const { Op } = require('sequelize');

// ... (existing helper)

// Get global system settings (Public for branding purposes)
router.get('/settings', async (req, res) => {
    try {
        const settings = await Settings.findAll({
            where: { UserId: null }
        });

        const settingsMap = {};

        const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
        let isAdmin = false;

        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findByPk(decoded.id);
                if (user && user.role === 'admin') {
                    isAdmin = true;
                }
            } catch (err) {
                // Ignore invalid token, treat as public request
            }
        }

        const publicKeys = [
            'system_accent_color',
            'system_secondary_color',
            'system_debug_mode',
            'registration_enabled',
            'legal_privacy', 'legal_imprint', 'legal_terms',
            'stripe_publishable_key'
        ];

        const secretKeys = [
            'stripe_webhook_secret',
            'stripe_secret_key',
            'openai_key',
            'alexa_key',
            'smtp_password',
            'imap_password'
        ];

        settings.forEach(s => {
            if (isAdmin) {
                // Admin gets everything, but mask secrets
                if (secretKeys.includes(s.key) || s.key.includes('password') || s.key.includes('secret') || s.key.includes('_key')) {
                    if (s.key === 'stripe_publishable_key' || s.key.includes('public')) {
                        settingsMap[s.key] = s.value;
                    } else if (s.value) {
                        settingsMap[s.key] = '***';
                    } else {
                        settingsMap[s.key] = s.value;
                    }
                } else {
                    settingsMap[s.key] = s.value;
                }
            } else {
                // Public only gets public keys
                if (publicKeys.includes(s.key)) {
                    settingsMap[s.key] = s.value;
                }
            }
        });

        res.json(settingsMap);
    } catch (err) {
        console.error('Failed to get system settings:', err);
        res.status(500).json({ error: 'Failed to get system settings' });
    }
});

// DEBUG Endpoint to inspect DB state


// FIX Endpoint: Migrate User-Bound settings to Global
router.post('/fix-legacy-settings', auth, admin, async (req, res) => {
    try {
        const legacySettings = await Settings.findAll({
            where: { UserId: { [Op.ne]: null } }
        });

        const fixed = [];
        for (const s of legacySettings) {
            // Identify system keys
            if (s.key.startsWith('system_') || ['openai_key', 'alexa_key', 'registration_enabled'].includes(s.key)) {

                // Check if a global one already exists (conflict)
                const globalExists = await Settings.findOne({ where: { key: s.key, UserId: null } });

                if (globalExists) {
                    // Conflict: We assume the User-bound one is the 'latest' attempt by admin, 
                    // or we keep the global one? 
                    // Logic: If global is empty/default and user has value, take user.
                    // Safer: Delete global, promote user one.
                    await globalExists.destroy();
                }

                s.UserId = null;
                await s.save();
                fixed.push(s.key);
            }
        }
        res.json({ message: 'Fixed legacy settings', fixed, count: fixed.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update global system settings (Admin only)
router.post('/settings', auth, admin, async (req, res) => {
    try {
        const { key, value } = req.body;
        console.log(`[SYSTEM] Update Request: ${key} = ${value} (User: ${req.user.username})`);

        if (!key) return res.status(400).json({ error: 'Key is required' });

        if (value === '***') {
            console.log(`[SYSTEM] Skipping update for ${key} because value is masked.`);
            return res.json({ message: 'Setting update skipped (masked)', key, value });
        }

        const stringValue = value !== undefined ? String(value) : null;

        // "Self-Healing" Logic:
        // 1. Check for legacy user-bound setting first
        let legacy = await Settings.findOne({ where: { key, UserId: { [Op.ne]: null } } });
        let global = await Settings.findOne({ where: { key, UserId: null } });

        if (legacy) {
            console.log(`[SYSTEM] Found legacy setting ${legacy.id} (User ${legacy.UserId}), converting to Global...`);
            // Convert legacy to global
            if (global) {
                console.log(`[SYSTEM] Removing conflicting global setting ${global.id}...`);
                await global.destroy();
            }
            legacy.UserId = null;
            legacy.value = stringValue;
            await legacy.save();
        } else if (global) {
            console.log(`[SYSTEM] Found existing global setting ${global.id}, updating...`);
            global.value = stringValue;
            await global.save();
        } else {
            console.log(`[SYSTEM] Creating new global setting...`);
            try {
                await Settings.create({
                    key,
                    value: stringValue,
                    UserId: null
                });
            } catch (createErr) {
                if (createErr.name === 'SequelizeUniqueConstraintError') {
                    // Retry verify
                    const retry = await Settings.findOne({ where: { key, UserId: null } });
                    if (retry) {
                        retry.value = stringValue;
                        await retry.save();
                    }
                } else {
                    throw createErr;
                }
            }
        }

        console.log(`[SYSTEM] Setting ${key} updated successfully.`);
        res.json({ message: 'Setting updated', key, value: stringValue });
    } catch (err) {
        console.error('SYSTEM_SETTINGS_UPDATE_ERROR:', err);
        res.status(500).json({
            error: 'Failed to update system setting',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Check for updates
// ...
router.get('/check', auth, admin, async (req, res) => {
    try {
        const rootDir = path.join(__dirname, '../../..'); // Project Root

        // 1. Fetch latest info from remote
        await runCommand('git', ['fetch'], rootDir);

        // 2. Check how many commits behind we are
        // git rev-list HEAD..origin/main --count
        // Note: Assumes 'origin' and 'main'. Might need adjustment if branch is different.
        const behindCount = await runCommand('git', ['rev-list', 'HEAD..origin/main', '--count'], rootDir);

        // 3. Get current hash and message
        const currentHash = await runCommand('git', ['rev-parse', '--short', 'HEAD'], rootDir);

        res.json({
            updates_available: parseInt(behindCount) > 0,
            commits_behind: parseInt(behindCount),
            current_version: currentHash
        });
    } catch (err) {
        console.error('Update check failed:', err);
        res.status(500).json({ error: 'Failed to check for updates: ' + err.message });
    }
});

// Get Alexa Logs
router.get('/alexa-logs', auth, admin, async (req, res) => {
    try {
        const logs = await readAlexaLogs(100);
        res.json(logs);
    } catch (err) {
        console.error('Failed to read logs:', err);
        res.status(500).json({ error: 'Failed to read logs' });
    }
});

// Get System Logs
router.get('/logs', auth, admin, async (req, res) => {
    try {
        const { readLogs } = require('../utils/logger');
        const logs = await readLogs(path.join(__dirname, '../../logs/system.log'), 200);
        res.json(logs);
    } catch (err) {
        console.error('Failed to read system logs:', err);
        res.status(500).json({ error: 'Failed to read system logs' });
    }
});

// Stream update process
router.get('/stream-update', auth, admin, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const rootDir = path.join(__dirname, '../../..');

    // Command chain to execute
    // 1. git pull 
    // 2. npm install (server)
    // 3. npm install (client)
    // 4. npm run build (client)
    // 5. supervisorctl restart einkaufsliste (or all)

    // We will run a shell script to chain these easily, or spawn them sequentially.
    // Spawning a shell is easier for chaining.
    // NOTE: 'supervisorctl restart einkaufsliste' will kill THIS process. 
    // The client needs to handle the connection close gracefully.

    // Default to supervisorctl (Uberspace default)
    const restartCmd = process.env.RESTART_COMMAND || 'supervisorctl restart einkaufsliste';

    const command = `
        echo ">>> DIAGNOSTICS:" &&
        echo "User: $(whoami)" &&
        echo "Dir: $(pwd)" &&
        echo "Path: $PATH" &&
        echo ">>> Starting Update Process..." &&
        git checkout client/package-lock.json server/package-lock.json || true &&
        git pull &&
        echo ">>> Installing Server Dependencies..." &&
        cd server && npm install &&
        echo ">>> Installing Client Dependencies..." &&
        cd ../client && npm install &&
        echo ">>> Building Frontend..." &&
        npm run build &&
        echo ">>> Running Database Migrations..." &&
        cd .. && node update.js &&
        echo ">>> Restarting Service using: ${restartCmd}" &&
        sleep 3 &&
        ${restartCmd}
    `;

    // DEBUG: Log the environment and command to the server console
    console.log('--- SYSTEM UPDATE START ---');
    console.log('CWD:', rootDir);
    console.log('PATH:', process.env.PATH);
    console.log('Command:', command);

    // Use shell execution
    const child = spawn(command, [], {
        shell: true,
        cwd: rootDir,
        env: { ...process.env } // Ensure env vars are passed
    });

    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) send({ type: 'stdout', message: line });
        });
    });

    child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) send({ type: 'stderr', message: line });
        });
    });

    child.on('close', (code) => {
        console.log('--- SYSTEM UPDATE END (Code: ' + code + ') ---');
        send({ type: 'done', code });
        res.end();
    });

    child.on('error', (err) => {
        console.error('--- SYSTEM UPDATE SPAWN ERROR ---', err);
        const errorDetails = `code: ${err.code}, syscall: ${err.syscall}, path: ${err.path}`;
        send({ type: 'error', message: `Spawn Error: ${err.message} (${errorDetails})` });
        res.end();
    });

    // If client disconnects, we normally might want to kill the update, 
    // BUT for an update process, we probably want it to finish even if the browser closes.
    // So we might NOT kill the child process here.
    req.on('close', () => {
        // console.log('Client disconnected from update stream');
    });
});

// Helper for recursive image scan
const scanImages = (dir, baseDir, results = { count: 0, totalSize: 0, largestFile: { name: '', size: 0 }, allFiles: [] }) => {
    if (!fs.existsSync(dir)) return results;
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanImages(fullPath, baseDir, results);
        } else {
            const ext = path.extname(file).toLowerCase();
            const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

            if (imageExts.includes(ext)) {
                results.count++;
                results.totalSize += stat.size;

                // Path relative to public/uploads
                const relPath = fullPath.replace(baseDir, '').replace(/\\/g, '/').replace(/^\//, '');

                results.allFiles.push({
                    path: relPath,
                    size: stat.size,
                    name: file
                });

                if (stat.size > results.largestFile.size) {
                    results.largestFile = {
                        name: file,
                        size: stat.size,
                        path: `/uploads/${relPath}`
                    };
                }
            }
        }
    });
    return results;
};

// Get Cleanup Stats (Admin only)
router.get('/cleanup/stats', auth, admin, async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, '../../public/uploads');
        // We need the base path to normalize relative paths
        const stats = scanImages(uploadsDir, uploadsDir);

        // Fetch all image references from DB
        const [recipes, users, stores, compliance] = await Promise.all([
            Recipe.findAll({ attributes: ['image_url'], raw: true }),
            User.findAll({ attributes: ['cookbookImage'], raw: true }),
            Store.findAll({ attributes: ['logo_url'], raw: true }),
            ComplianceReport.findAll({ attributes: ['screenshotPath'], raw: true })
        ]);

        // Normalize DB paths: remove leading slashes and 'uploads/' prefix
        const normalize = (p) => {
            if (!p) return null;
            return p.replace(/^\/*uploads\//, '').replace(/^\//, '');
        };

        const dbPaths = new Set([
            ...recipes.map(r => normalize(r.image_url)),
            ...users.map(u => normalize(u.cookbookImage)),
            ...stores.map(s => normalize(s.logo_url)),
            ...compliance.map(c => normalize(c.screenshotPath))
        ].filter(Boolean));

        // Identify orphaned files
        const orphanedFiles = [];
        let orphanedCount = 0;
        let orphanedSize = 0;

        stats.allFiles.forEach(file => {
            if (!dbPaths.has(file.path)) {
                orphanedCount++;
                orphanedSize += file.size;
                orphanedFiles.push(file);
            }
        });

        res.json({
            count: stats.count,
            totalSize: stats.totalSize,
            largestFile: stats.largestFile,
            orphanedCount,
            orphanedSize,
            orphanedFiles,
            allFiles: stats.allFiles,
            uploadsDir
        });
    } catch (err) {
        console.error('Failed to get cleanup stats:', err);
        res.status(500).json({ error: 'Failed to get cleanup stats' });
    }
});

// Delete a single file from uploads (Admin only)
router.delete('/cleanup/file', auth, admin, async (req, res) => {
    try {
        const { filePath } = req.query;
        if (!filePath) return res.status(400).json({ error: 'filePath is required' });

        // Security: ensure path is within uploads
        const uploadsDir = path.join(__dirname, '../../public/uploads');
        const fullPath = path.normalize(path.join(uploadsDir, filePath));

        if (!fullPath.startsWith(uploadsDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (err) {
        console.error('Delete file error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Resize or optimize an image (Admin only)
router.post('/cleanup/resize-file', auth, admin, async (req, res) => {
    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'filePath is required' });

        const uploadsDir = path.join(__dirname, '../../public/uploads');
        const fullPath = path.normalize(path.join(uploadsDir, filePath));

        if (!fullPath.startsWith(uploadsDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const ext = path.extname(fullPath).toLowerCase();
        const isPng = ext === '.png';
        let currentPath = fullPath;
        let currentRelPath = filePath;
        let converted = false;
        let resized = false;

        const image = await Jimp.read(fullPath);

        // Resize if needed
        if (image.bitmap.width > 800) {
            image.resize(800, Jimp.AUTO);
            resized = true;
        }

        // Convert PNG to JPG
        if (isPng) {
            const newRelPath = filePath.replace(/\.png$/i, '.jpg');
            const newFullPath = fullPath.replace(/\.png$/i, '.jpg');

            await image.quality(80).writeAsync(newFullPath);

            // Delete old PNG
            fs.unlinkSync(fullPath);

            // Update Database References
            const { Op } = require('sequelize');

            const updateRefs = async (Model, column) => {
                // Find records that contain the filename part
                // We use Op.or to search for both slash versions
                const slashPath = filePath.replace(/\\/g, '/');
                const backslashPath = filePath.replace(/\//g, '\\');

                const records = await Model.findAll({
                    where: {
                        [Op.or]: [
                            { [column]: { [Op.like]: `%${slashPath}%` } },
                            { [column]: { [Op.like]: `%${backslashPath}%` } }
                        ]
                    }
                });

                for (const record of records) {
                    const oldValue = record[column];
                    // Replace whichever one is found
                    let newValue = oldValue.replace(slashPath, newRelPath.replace(/\\/g, '/'))
                        .replace(backslashPath, newRelPath.replace(/\//g, '\\'));

                    if (oldValue !== newValue) {
                        await record.update({ [column]: newValue });
                    }
                }
            };

            await Promise.all([
                updateRefs(Recipe, 'image_url'),
                updateRefs(User, 'cookbookImage'),
                updateRefs(Store, 'logo_url'),
                updateRefs(ComplianceReport, 'screenshotPath')
            ]);

            converted = true;
            currentRelPath = newRelPath;
        } else if (resized) {
            // Just save the resized version of non-PNG (or already JPG)
            await image.writeAsync(fullPath);
        }

        res.json({
            success: true,
            resized,
            converted,
            newPath: currentRelPath
        });
    } catch (err) {
        console.error('Optimize file error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
