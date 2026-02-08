const jwt = require('jsonwebtoken');
const { User } = require('../models');

const auth = async (req, res, next) => {
    try {
        if (!User) {
            console.error('CRITICAL: User model is undefined in auth middleware. Check models/index.js');
            return res.status(500).json({ error: 'Internal Server Error: Database model missing' });
        }

        const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
        if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id);

            if (!user) {
                console.warn(`Auth failed: User ${decoded.id} not found in DB`);
                return res.status(401).json({ error: 'User no longer exists.' });
            }

            req.user = user;
            // Use householdId if set, otherwise fallback to own id for data scoping
            req.user.effectiveId = user.householdId || user.id;
            next();
        } catch (ex) {
            console.error('Token verification failed:', ex.message);
            res.status(401).json({ error: 'Invalid or expired token.' });
        }
    } catch (criticalError) {
        console.error('Critical Auth Middleware Error:', criticalError);
        res.status(500).json({ error: 'Internal Auth Service Error' });
    }
};

const admin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied. Admin only.' });
    next();
};

module.exports = { auth, admin };
