const fs = require('fs');
const path = require('path');

const csvPath = 'BCC Consolidated VOIP data.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');

const extMap = new Map(); // extension -> [{line, name}]
const nameMap = new Map(); // name (lowercase) -> [{line, ext}]
const emptyExts = [];
const emptyNames = [];

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    const name = (parts[0] || '').trim();
    const ext = (parts[1] || '').trim();

    // Track empty fields
    if (!name) emptyNames.push({ line: i + 1, data: line });
    if (!ext) emptyExts.push({ line: i + 1, name });

    // Track extensions
    if (ext) {
        if (!extMap.has(ext)) extMap.set(ext, []);
        extMap.get(ext).push({ line: i + 1, name });
    }

    // Track names (case insensitive)
    if (name) {
        const nLower = name.toLowerCase();
        if (!nameMap.has(nLower)) nameMap.set(nLower, []);
        nameMap.get(nLower).push({ line: i + 1, ext });
    }
}

const duplicateExts = Array.from(extMap.entries())
    .filter(([ext, entries]) => entries.length > 1)
    .map(([ext, entries]) => ({ ext, entries }));

const duplicateNames = Array.from(nameMap.entries())
    .filter(([name, entries]) => entries.length > 1)
    .map(([name, entries]) => ({ name, entries }));

const report = {
    duplicateExts,
    duplicateNames,
    emptyExts,
    emptyNames
};

fs.writeFileSync('csv_final_analysis.json', JSON.stringify(report, null, 2));
console.log('Final analysis complete.');
