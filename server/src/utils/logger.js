const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const ALEXA_LOG_FILE = path.join(LOG_DIR, 'alexa.jsonl');
const SYSTEM_LOG_FILE = path.join(LOG_DIR, 'system.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Local cache for debug mode to avoid excessive DB queries
let isDebugModeEnabled = null;
let lastCheck = 0;

/**
 * Check if system debug mode is enabled (Sync version using cache)
 */
const isDebugEnabledSync = () => {
    return !!isDebugModeEnabled;
};

/**
 * Update debug mode cache (Async)
 */
const updateDebugModeCache = async () => {
    const now = Date.now();
    if (now - lastCheck < 10000) return isDebugModeEnabled;

    try {
        const { Settings } = require('../models');
        const setting = await Settings.findOne({ where: { key: 'system_debug_mode', UserId: null } });
        isDebugModeEnabled = setting ? setting.value === 'true' : false;
        lastCheck = now;
    } catch (err) {
        // Fallback or silent fail during init
        if (isDebugModeEnabled === null) isDebugModeEnabled = false;
    }
    return isDebugModeEnabled;
};

/**
 * Check if system debug mode is enabled
 */
const shouldLogDebug = async () => {
    return await updateDebugModeCache();
};

/**
 * Log an Alexa event
 */
const logAlexa = (level, type, message, meta = {}) => {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        type,
        message,
        meta
    };

    const line = JSON.stringify(entry) + '\n';

    fs.appendFile(ALEXA_LOG_FILE, line, (err) => {
        if (err) console.error('Failed to write to alexa log:', err);
    });
};

/**
 * Log a system message or error
 */
const logSystem = async (level, message, meta = null) => {
    const isDebug = level === 'DEBUG';

    // Non-blocking filter check
    if (isDebug && !isDebugEnabledSync()) return;

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;

    if (meta) {
        if (meta instanceof Error) {
            logMessage += `\nStack: ${meta.stack}`;
        } else {
            logMessage += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
        }
    }
    logMessage += '\n';

    // Output to stdout/stderr as requested
    const isError = level === 'ERROR' || level === 'FATAL';
    if (isError) {
        process.stderr.write(logMessage);
    } else {
        process.stdout.write(logMessage);
    }

    // Append to file
    fs.appendFile(SYSTEM_LOG_FILE, logMessage, (err) => {
        if (err) console.error('Failed to write to system log:', err);
    });
};

/**
 * Convenience wrapper for logging errors
 */
const logError = async (message, err) => {
    await logSystem('ERROR', message, err);
};

/**
 * Convenience wrapper for logging warnings
 */
const logWarn = async (message, meta = null) => {
    await logSystem('WARN', message, meta);
};

/**
 * Read the last N lines of a log file
 */
const readLogs = (file, limit = 100) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(file)) {
            return resolve([]);
        }

        fs.readFile(file, 'utf8', (err, data) => {
            if (err) return reject(err);

            const lines = data.trim().split('\n');
            const entries = lines.slice(-limit).reverse();
            resolve(entries);
        });
    });
};

const readAlexaLogs = (limit = 100) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(ALEXA_LOG_FILE)) {
            return resolve([]);
        }

        fs.readFile(ALEXA_LOG_FILE, 'utf8', (err, data) => {
            if (err) return reject(err);

            const lines = data.trim().split('\n');
            const entries = lines
                .slice(-limit)
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(e => e !== null)
                .reverse();

            resolve(entries);
        });
    });
};

module.exports = {
    logAlexa,
    readAlexaLogs,
    logSystem,
    logError,
    logWarn,
    shouldLogDebug,
    isDebugEnabledSync,
    updateDebugModeCache
};
