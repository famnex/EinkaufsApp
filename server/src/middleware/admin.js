const isAdmin = (req, res, next) => {
    // req.user is populated by the auth middleware (verifyToken)
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
};

module.exports = isAdmin;
