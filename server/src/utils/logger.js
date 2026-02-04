const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'alexa.jsonl');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Log an Alexa event
 * @param {string} level 'INFO', 'WARN', 'ERROR'
 * @param {string} type 'AUTH', 'REQUEST', 'ITEM_ADDED', 'ITEM_UPDATED', 'PRODUCT_CREATED'
 * @param {string} message Human readable message
 * @param {object} meta Additional data (e.g., product name, quantity)
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

    fs.appendFile(LOG_FILE, line, (err) => {
        if (err) console.error('Failed to write to alexa log:', err);
    });
};

/**
 * Read the last N lines of the log file
 * @param {number} limit Number of lines to return
 * @returns {Promise<Array>} Array of log entries (newest first)
 */
const readAlexaLogs = (limit = 100) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(LOG_FILE)) {
            return resolve([]);
        }

        // Reading the whole file is inefficient for very large files, 
        // but for this scale (jsonl), it's acceptable. 
        // A better approach for huge files would be reading backwards chunk by chunk.
        // Given typically < 1MB log file, reading all is fine.

        fs.readFile(LOG_FILE, 'utf8', (err, data) => {
            if (err) return reject(err);

            const lines = data.trim().split('\n');
            const entries = lines
                .slice(-limit) // Take last N
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(e => e !== null)
                .reverse(); // Newest first

            resolve(entries);
        });
    });
};

module.exports = {
    logAlexa,
    readAlexaLogs
};
