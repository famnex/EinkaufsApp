const express = require('express');
const router = express.Router();
const { auth, admin } = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');
const { readAlexaLogs } = require('../utils/logger');
const { Settings } = require('../models');

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
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        res.json(settingsMap);
    } catch (err) {
        console.error('Failed to get system settings:', err);
        res.status(500).json({ error: 'Failed to get system settings' });
    }
});

// DEBUG Endpoint to inspect DB state
router.get('/debug-settings', async (req, res) => {
    try {
        const all = await Settings.findAll();
        res.json({ count: all.length, rows: all });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

module.exports = router;
