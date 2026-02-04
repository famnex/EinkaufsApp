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

// Mount API on standard path
app.use('/api', apiRouter);
// Mount API on subdirectory path (for production)
app.use('/EinkaufsApp/api', apiRouter);

// --- Server-Side Rendering for Shared Recipes (Open Graph Tags) ---
const serveSharedRecipe = async (req, res) => {
    try {
        const recipeId = req.params.id;
        const recipe = await Recipe.findByPk(recipeId, {
            include: [{ model: sequelize.models.Image, as: 'Images' }] // Ensure Images are loaded if needed for og:image
        });

        const filePath = path.join(__dirname, '../client/dist/index.html');

        fs.readFile(filePath, 'utf8', (err, htmlData) => {
            if (err) {
                console.error('Error reading index.html', err);
                return res.status(500).send('Error loading page');
            }

            if (!recipe) {
                // If recipe not found, just send standard HTML (client will handle 404 UI)
                return res.send(htmlData);
            }

            // Construct OG Data
            const title = recipe.title || 'Rezept teilen';
            // Use locally hosted image if available, or a fallback. 
            // Note: WhatsApp requires absolute URLs with https (or http if allowed).
            // We'll try to construct a full URL based on the request host.
            const protocol = req.protocol;
            const host = req.get('host');
            const baseUrl = `${protocol}://${host}`;

            let imageUrl = `${baseUrl}/EinkaufsApp/icon-192.png`; // Default fallback
            if (recipe.image_url) {
                // Check if it's already an absolute URL
                if (recipe.image_url.startsWith('http')) {
                    imageUrl = recipe.image_url;
                } else {
                    // It's a relative path (e.g. /uploads/...)
                    // Ensure leading slash
                    const cleanPath = recipe.image_url.startsWith('/') ? recipe.image_url : `/${recipe.image_url}`;
                    // If servig under /EinkaufsApp prefix, usually uploads are at root /uploads or handled via proxy?
                    // Based on app.use('/uploads'), they are at root.
                    imageUrl = `${baseUrl}${cleanPath}`;
                }
            }

            const description = `Schau dir dieses leckere Rezept an: ${title}`;

            // Inject tags into <head>
            // We'll replace the <title> tag and add meta tags after it
            let injectedHtml = htmlData.replace(
                '<title>Einkaufsliste</title>',
                `<title>${title}</title>
                 <meta property="og:title" content="${title}" />
                 <meta property="og:description" content="${description}" />
                 <meta property="og:image" content="${imageUrl}" />
                 <meta property="og:type" content="article" />`
            );

            // Also replace generic description if present
            // (Optional, simplistic replacement)

            res.send(injectedHtml);
        });
    } catch (error) {
        console.error('SSR Error:', error);
        // Fallback to static file
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