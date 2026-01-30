const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize } = require('./src/models');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Listenübersicht API is running' });
});

const authRoutes = require('./src/routes/auth');
const listRoutes = require('./src/routes/lists');
const productRoutes = require('./src/routes/products');

app.use('/api/auth', authRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/products', productRoutes);

sequelize.sync().then(() => {
    console.log('Database synced');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to sync database:', err);
});
