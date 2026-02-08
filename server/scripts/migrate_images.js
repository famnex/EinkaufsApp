
const fs = require('fs');
const path = require('path');
const { Recipe, User } = require('../src/models');

async function migrateImages() {
    try {
        console.log('Starting image migration to user-specific folders...');

        // 1. Get the primary user (or the user we assigned existing data to)
        // In our migration script scripts/migrate_to_multiuser.js, we assigned to the first user.
        const primaryUser = await User.findOne({ order: [['id', 'ASC']] });
        if (!primaryUser) {
            console.error('No users found. Please run scripts/migrate_to_multiuser.js first.');
            return;
        }
        const userId = primaryUser.id;
        const baseUploadDir = path.resolve(__dirname, '..', 'public', 'uploads');
        const userUploadDir = path.join(baseUploadDir, 'users', String(userId), 'recipes');

        if (!fs.existsSync(userUploadDir)) {
            fs.mkdirSync(userUploadDir, { recursive: true });
        }

        // 2. Find all recipes that have a local image and STILL point to the old path
        // Old paths look like "uploads/recipes/..." or just filename if relative
        // Actually, let's look at what's in the DB.
        const recipes = await Recipe.findAll();

        for (const recipe of recipes) {
            if (recipe.image_url && !recipe.image_url.includes('/users/')) {
                // Determine source filename
                // image_url could be "uploads/recipes/abc.jpg" or "https://..."
                if (recipe.image_url.startsWith('http')) continue;

                const filename = path.basename(recipe.image_url);
                const oldPath = path.join(baseUploadDir, 'recipes', filename);
                const newPath = path.join(userUploadDir, filename);

                if (fs.existsSync(oldPath)) {
                    console.log(`Moving ${filename} for recipe "${recipe.title}" to user ${userId}`);
                    fs.renameSync(oldPath, newPath);

                    // Update database
                    await recipe.update({
                        image_url: `uploads/users/${userId}/recipes/${filename}`
                    });
                } else {
                    console.warn(`File not found: ${oldPath} for recipe ${recipe.id}`);
                }
            }
        }

        console.log('Image migration completed.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrateImages();
