const fs = require('fs');

const csvPath = '/Users/2302-n0214/Downloads/비즈케어 내 대웅 건강제도 정리_최종_다나아.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// CSV 파싱 함수
function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(cell);
            cell = '';
        } else if (char === '\n' && !inQuotes) {
            row.push(cell);
            if (row.some(c => c.trim())) {
                rows.push(row);
            }
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }
    
    if (cell || row.length > 0) {
        row.push(cell);
        if (row.some(c => c.trim())) {
            rows.push(row);
        }
    }
    
    return rows;
}

const rows = parseCSV(csvContent);
const dataRows = rows.slice(3); // 헤더 3줄 건너뛰기

console.log('='.repeat(80));
console.log('CSV 파일의 목적/취지 데이터');
console.log('='.repeat(80));
console.log();

let lastCategory = '';
dataRows.forEach((row, index) => {
    if (row.length >= 9 && row[1] && row[1].trim()) {
        const category = row[0] ? row[0].trim() : lastCategory;
        const subcategory = row[1].trim();
        const purpose = row[2] ? row[2].trim() : '';
        
        if (category) lastCategory = category;
        
        console.log(`[${index + 1}] ${category} > ${subcategory}`);
        console.log(`목적/취지: ${purpose || '(없음)'}`);
        console.log('-'.repeat(80));
    }
});
