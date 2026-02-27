const fs = require('fs');
const path = require('path');
const file = 'c:/Users/fleis/.gemini/antigravity/scratch/listenuebersicht/server/src/routes/recipes.js';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
for (let i = 344; i <= 354; i++) {
    console.log(`${i + 1}: ${lines[i].replace(/\r/g, '\\r')}`);
    console.log(`Codes: ${Array.from(lines[i]).map(c => c.charCodeAt(0)).join(',')}`);
}
