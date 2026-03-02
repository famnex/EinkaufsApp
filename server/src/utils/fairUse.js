// In-Memory Fair Use Tracking
const fairUseLog = new Map();

function checkFairUse(userId, limit = 10, windowMinutes = 60) {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    let userLog = fairUseLog.get(userId) || [];

    // Remove timestamps outside the window
    userLog = userLog.filter(ts => (now - ts) < windowMs);

    if (userLog.length >= limit) {
        fairUseLog.set(userId, userLog);
        return false;
    }

    userLog.push(now);
    fairUseLog.set(userId, userLog);
    return true;
}

module.exports = {
    checkFairUse
};
