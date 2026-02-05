const fs = require('fs');
const path = 'c:\\Users\\fleis\\.gemini\\antigravity\\scratch\\listenuebersicht\\client\\src\\pages\\Recipes.jsx';

try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split('\n');

    // Create backup
    fs.writeFileSync(path + '.bak', content);

    // Lines to remove: 179 to 200 (1-based) -> indices 178 to 199
    // Verify line 178 is "    return (" and line 201 starts with "<div"
    // Index 177 is line 178.

    console.log('Line 178:', lines[177]);
    console.log('Line 200:', lines[199]);
    console.log('Line 201:', lines[200]);

    if (lines[177].trim() === 'return (' && lines[200].trim().startsWith('<div')) {
        console.log('Anchors match. Modifying...');
        // Remove lines 179 (index 178) to 200 (index 199)
        // Count: 200 - 179 + 1 = 22 lines.
        lines.splice(178, 22);

        fs.writeFileSync(path, lines.join('\n'));
        console.log('Success.');
    } else {
        console.error('Anchors do not match! Aborting.');
        console.log('Expected 178="return (", found:', lines[177]);
        console.log('Expected 201="<div...", found:', lines[200]);
    }

} catch (e) {
    console.error(e);
}
