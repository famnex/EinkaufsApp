const crypto = require('crypto');
const { PublicVisit } = require('../models');
const { Op } = require('sequelize');

/**
 * Tracks a public visit to a recipe or cookbook.
 * Uses SHA-256(IP + DailySalt) for anonymity.
 * Returns true if the count should be incremented (first visit in 1 hour).
 */
async function recordVisit(req, type, id) {
    try {
        // 1. Get IP Address
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

        // 2. Daily Salt (changes every calendar day at midnight)
        const dailySalt = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

        // 3. Create Anonymous Identifier Hash
        const hash = crypto.createHash('sha256')
            .update(ip + dailySalt)
            .digest('hex');

        // 4. Check for existing visit within the last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const [visit, created] = await PublicVisit.findOrCreate({
            where: {
                identifierHash: hash,
                targetType: type,
                targetId: id
            },
            defaults: {
                lastVisitAt: new Date()
            }
        });

        if (created) {
            // New visitor for this target today
            return true;
        }

        // Existing visitor: Check if last visit was more than 1 hour ago
        if (visit.lastVisitAt < oneHourAgo) {
            await visit.update({ lastVisitAt: new Date() });
            return true;
        }

        // Within 1 hour window -> do not increment
        return false;
    } catch (err) {
        console.error('VisitorTracker Error:', err);
        return false; // Fail safe: don't increment if tracking fails
    }
}

module.exports = { recordVisit };
