const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

/**
 * Optimizes an image file:
 * 1. Resizes to max-width 800px (maintaining aspect ratio).
 * 2. Converts PNG to JPG (80% quality).
 * 3. Deletes the original file if it was converted.
 * 
 * @param {string} fullPath - Absolute path to the image file.
 * @returns {Promise<{path: string, optimized: boolean, converted: boolean}>} - The (possibly new) absolute path.
 */
async function optimizeImage(fullPath) {
    if (!fs.existsSync(fullPath)) {
        throw new Error('File not found for optimization');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const isPng = ext === '.png';
    let currentPath = fullPath;
    let optimized = false;
    let converted = false;

    try {
        const image = await Jimp.read(fullPath);

        // 1. Resize if too wide
        if (image.bitmap.width > 800) {
            image.resize(800, Jimp.AUTO);
            optimized = true;
        }

        // 2. Convert PNG to JPG or just save if optimized
        if (isPng) {
            const newFullPath = fullPath.replace(/\.png$/i, '.jpg');

            await image.quality(80).writeAsync(newFullPath);

            // Delete original PNG
            fs.unlinkSync(fullPath);

            currentPath = newFullPath;
            converted = true;
            optimized = true; // Conversion is a form of optimization here
        } else if (optimized) {
            // If it was already a JPG but we resized it, save it back with quality reduction
            await image.quality(80).writeAsync(fullPath);
        }

        return {
            path: currentPath,
            optimized,
            converted
        };
    } catch (err) {
        console.error('Error during image optimization:', err);
        // Return original path if optimization fails to avoid breaking flows
        return {
            path: fullPath,
            optimized: false,
            converted: false
        };
    }
}

module.exports = { optimizeImage };
