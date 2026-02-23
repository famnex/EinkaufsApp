const fs = require('fs');
const path = require('path');

const scanImages = (dir, results = { count: 0, totalSize: 0, largestFile: { name: '', size: 0 } }) => {
    if (!fs.existsSync(dir)) return results;
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanImages(fullPath, results);
        } else {
            const ext = path.extname(file).toLowerCase();
            const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

            if (imageExts.includes(ext)) {
                results.count++;
                results.totalSize += stat.size;
                if (stat.size > results.largestFile.size) {
                    results.largestFile = {
                        name: file,
                        size: stat.size,
                        path: fullPath
                    };
                }
            }
        }
    });
    return results;
};

const uploadsDir = path.join(__dirname, '../public/uploads');
console.log('Testing image scan in:', uploadsDir);
const stats = scanImages(uploadsDir);
console.log('Results:', JSON.stringify(stats, null, 2));

if (stats.count > 0) {
    console.log('SUCCESS: Images found.');
} else {
    console.log('NOTE: No images found (this might be normal for a fresh dev environment).');
}
