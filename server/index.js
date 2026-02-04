const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { sequelize, Recipe } = require('./src/models');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/EinkaufsApp/uploads', express.static(path.join(__dirname, 'public/uploads')));

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
apiRouter.use('/users', require('./src/routes/users'));
apiRouter.use('/system', require('./src/routes/system'));
apiRouter.use('/alexa', require('./src/routes/alexa'));

// Mount API on standard path
app.use('/api', apiRouter);
// Mount API on subdirectory path (for production)
app.use('/EinkaufsApp/api', apiRouter);

// --- Server-Side Rendering for Shared Recipes (Open Graph Tags) ---
const serveSharedRecipe = async (req, res) => {
    try {
        const recipeId = req.params.id;
        const recipe = await Recipe.findByPk(recipeId);

        // Path to built index.html
        let filePath = path.join(__dirname, '../client/dist/index.html');

        // Fallback for development if dist doesn't exist (helpful for testing)
        if (!fs.existsSync(filePath)) {
            filePath = path.join(__dirname, '../client/index.html');
        }

        if (!fs.existsSync(filePath)) {
            console.error('index.html not found at:', filePath);
            return res.status(500).send('Frontend not built or index.html missing');
        }

        fs.readFile(filePath, 'utf8', (err, htmlData) => {
            if (err) {
                console.error('Error reading index.html', err);
                return res.status(500).send('Error loading page');
            }

            if (!recipe) {
                return res.send(htmlData);
            }

            // Construct OG Data
            const title = recipe.title || 'Rezept';
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.get('host');
            const baseUrl = `${protocol}://${host}`;
            const appSubDir = '/EinkaufsApp';

            // Construct absolute Image URL
            // Default fallback icon
            let imageUrl = `${baseUrl}${appSubDir}/icon-192x192.png`;
            if (recipe.image_url) {
                if (recipe.image_url.startsWith('http')) {
                    imageUrl = recipe.image_url;
                } else {
                    const cleanPath = recipe.image_url.startsWith('/') ? recipe.image_url : `/${recipe.image_url}`;
                    imageUrl = `${baseUrl}${appSubDir}${cleanPath}`;
                }
            }

            const description = recipe.category ? `${recipe.category} Rezept: ${title}` : `Schau dir dieses leckere Rezept an: ${title}`;

            // Robust injection using regex
            let injectedHtml = htmlData;

            // 1. Replace Title
            injectedHtml = injectedHtml.replace(/<title>.*?<\/title>/i, `<title>${title} | EinkaufsApp</title>`);

            // 2. Clear existing dynamic meta tags if any (to avoid duplicates)
            injectedHtml = injectedHtml.replace(/<meta property="og:.*?" content=".*?" \/>/g, '');

            // 3. Replace or inject description
            const metaDescriptionRegex = /<meta name="description" content=".*?" \/>/i;
            if (metaDescriptionRegex.test(injectedHtml)) {
                injectedHtml = injectedHtml.replace(metaDescriptionRegex, `<meta name="description" content="${description}" />`);
            }

            // 4. Inject OG tags before </head>
            const ogTags = `
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${baseUrl}${appSubDir}/shared/recipe/${recipeId}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="EinkaufsApp" />
`;
            injectedHtml = injectedHtml.replace('</head>', `${ogTags}</head>`);

            res.send(injectedHtml);
        });
    } catch (error) {
        console.error('SSR Error:', error);
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    }
};

app.get('/shared/recipe/:id', serveSharedRecipe);
app.get('/EinkaufsApp/shared/recipe/:id', serveSharedRecipe);

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