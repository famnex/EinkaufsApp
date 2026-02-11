const express = require('express'); // v0.14.2 Trigger
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { sequelize, User, Recipe } = require('./src/models');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const BASE_PATH = process.env.BASE_PATH || ''; // e.g. '/EinkaufsApp'

// Serve static files
app.use(`${BASE_PATH}/uploads`, express.static(path.join(__dirname, 'public/uploads')));

app.get('/', (req, res) => {
    res.json({ message: 'GabelGuru API is running' });
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

// Mount API
app.use(`${BASE_PATH}/api`, apiRouter);

// Fallback for root if BASE_PATH is set
if (BASE_PATH && BASE_PATH !== '/') {
    app.use('/api', apiRouter);
}

// --- Helper: Serve SSR Page ---
const serveSSR = async (req, res, meta = {}) => {
    const filePath = path.join(__dirname, '../client/dist/index.html');

    // In dev mode, we might not have dist/index.html, but we should handle it
    if (!fs.existsSync(filePath)) {
        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="de">
            <head>
                <meta charset="UTF-8">
                <title>${meta.title || 'GabelGuru'}</title>
                <meta property="og:title" content="${meta.title || 'GabelGuru'}" />
                <meta property="og:description" content="${meta.description || 'Dein Kochbuch'}" />
                <meta property="og:image" content="${meta.image || ''}" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
                <div id="root">Lade... (Frontend nicht gebaut, Vorschau aktiv)</div>
            </body>
            </html>
        `);
    }

    fs.readFile(filePath, 'utf8', (err, htmlData) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Error loading page');
        }

        let injectedHtml = htmlData;
        const title = meta.title || 'GabelGuru';
        const description = meta.description || 'Deine Rezepte & Einkaufslisten';
        const imageUrl = meta.image || '';

        // 1. Replace Title
        injectedHtml = injectedHtml.replace(/<title>.*?<\/title>/i, `<title>${title} | GabelGuru</title>`);

        // 2. Clear existing dynamic meta tags
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
    <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="GabelGuru" />
`;
        injectedHtml = injectedHtml.replace('</head>', `${ogTags}</head>`);

        res.send(injectedHtml);
    });
};

const renderErrorPage = (res, message = 'Dieser Link ist ungültig oder abgelaufen. Frag am besten noch einmal nach einem aktuellen Link.') => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Halt da! 🛑</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; color: #111827; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                .card { background: white; padding: 2rem; border-radius: 1.5rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); max-width: 400px; width: 90%; }
                h1 { font-size: 2rem; margin-bottom: 1rem; }
                p { color: #4b5563; line-height: 1.5; margin-bottom: 2rem; }
                a { display: inline-block; background: #4f46e5; color: white; padding: 0.75rem 1.5rem; border-radius: 0.75rem; text-decoration: none; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Halt da! 🛑</h1>
                <p>${message}</p>
                <a href="/">Zur Startseite</a>
            </div>
        </body>
        </html>
    `);
};

// SSR for Shared Recipe
const serveSharedRecipe = async (req, res) => {
    try {
        const { sharingKey, id } = req.params;
        const user = await User.findOne({ where: { sharingKey } });
        if (!user) return renderErrorPage(res);

        // CHECK PUBLIC FLAG
        if (!user.isPublicCookbook) return renderErrorPage(res, 'Dieses Kochbuch ist privat.');

        const recipe = await Recipe.findOne({ where: { id, UserId: user.householdId || user.id } });
        if (!recipe) return renderErrorPage(res);

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Construct absolute Image URL
        let image = `${baseUrl}${BASE_PATH}/icon-192x192.png`;
        if (recipe.image_url) {
            image = recipe.image_url.startsWith('http') ? recipe.image_url : `${baseUrl}${BASE_PATH}${recipe.image_url.startsWith('/') ? '' : '/'}${recipe.image_url}`;
        }

        await serveSSR(req, res, {
            title: recipe.title,
            description: recipe.category ? `${recipe.category} Rezept aus dem Kochbuch von ${user.username}` : `Ein Rezept aus dem Kochbuch von ${user.username}`,
            image: image
        });
    } catch (error) {
        console.error('SSR Recipe Error:', error);
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    }
};

// SSR for Shared Cookbook
const serveSharedCookbook = async (req, res) => {
    try {
        const { sharingKey } = req.params;
        const user = await User.findOne({ where: { sharingKey } });
        if (!user) return renderErrorPage(res);

        // CHECK PUBLIC FLAG
        if (!user.isPublicCookbook) return renderErrorPage(res, 'Dieses Kochbuch ist privat.');

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        let image = `${baseUrl}${BASE_PATH}/icon-192x192.png`;
        if (user.cookbookImage) {
            image = user.cookbookImage.startsWith('http') ? user.cookbookImage : `${baseUrl}${BASE_PATH}${user.cookbookImage.startsWith('/') ? '' : '/'}${user.cookbookImage}`;
        }

        await serveSSR(req, res, {
            title: user.cookbookTitle || 'MEIN KOCHBUCH',
            description: `Entdecke leckere Rezepte im Kochbuch von ${user.username}.`,
            image: image,
            UserId: user.householdId || user.id
        });
    } catch (error) {
        console.error('SSR Cookbook Error:', error);
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    }
};

app.get(`${BASE_PATH}/shared/:sharingKey/recipe/:id`, serveSharedRecipe);
app.get(`${BASE_PATH}/shared/:sharingKey/cookbook`, serveSharedCookbook);

if (BASE_PATH && BASE_PATH !== '/') {
    app.get('/shared/:sharingKey/recipe/:id', serveSharedRecipe);
    app.get('/shared/:sharingKey/cookbook', serveSharedCookbook);
}

// Serve static files from React app
// Serve static files from React app
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    // Mount static files at the subdirectory path
    if (BASE_PATH && BASE_PATH !== '/') {
        app.use(BASE_PATH, express.static(path.join(__dirname, '../client/dist')));
    }

    // Also handle root requests if needed, or just let wildcard catch them
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // --- Improved Catch-all for SPA (Express 5 compatible regex) ---
    app.get(/.*/, (req, res) => {
        // If it's an API request or an asset (has extension), don't serve index.html
        const isApi = req.path.startsWith('/api') || (BASE_PATH && req.path.startsWith(`${BASE_PATH}/api`));
        const hasExtension = path.extname(req.path) !== '';

        if (isApi || (hasExtension && !req.path.endsWith('.html'))) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn(`[404] Resource not found: ${req.path}`);
            }
            return res.status(404).send('Not Found');
        }

        // Diagnostic log for production white page issues
        if (process.env.DEBUG_SPA === 'true') {
            console.log(`[SPA] Serving index.html for: ${req.path} (BASE_PATH: ${BASE_PATH || 'not set'})`);
        }

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