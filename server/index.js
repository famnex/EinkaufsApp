const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { sequelize } = require('./src/models');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.get('/', (req, res) => {
    res.json({ message: 'Listenübersicht API is running' });
});

const authRoutes = require('./src/routes/auth');
const listRoutes = require('./src/routes/lists');
const productRoutes = require('./src/routes/products');
const manufacturerRoutes = require('./src/routes/manufacturers');
const storeRoutes = require('./src/routes/stores');

const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/lists', listRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/manufacturers', manufacturerRoutes);
apiRouter.use('/stores', storeRoutes);
apiRouter.use('/recipes', require('./src/routes/recipes'));
apiRouter.use('/menus', require('./src/routes/menus'));
apiRouter.use('/settings', require('./src/routes/settings'));
apiRouter.use('/ai', require('./src/routes/ai'));

// Mount API on standard path
app.use('/api', apiRouter);
// Mount API on subdirectory path (for production)
app.use('/EinkaufsApp/api', apiRouter);

// Serve static files from React app
// Serve static files from React app
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    // Mount static files at the subdirectory path
    app.use('/EinkaufsApp', express.static(path.join(__dirname, '../client/dist')));

    // Also handle root requests if needed, or just let wildcard catch them
    app.use(express.static(path.join(__dirname, '../client/dist')));

    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
}

// { alter: true } might cause SQLITE_CONSTRAINT error if data violates new constraints, but needed for schema updates.
sequelize.sync({ alter: false }).then(() => {
    console.log('Database synced');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to sync database:', err);
});
