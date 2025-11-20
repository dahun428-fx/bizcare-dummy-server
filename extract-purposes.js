const fs = require('fs');

// CSV 파싱 함수 (show-purpose.js와 동일)
function parseCSV(text) {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentField.trim());
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            currentLine.push(currentField.trim());
            if (currentLine.some(field => field.length > 0)) {
                lines.push(currentLine);
            }
            currentLine = [];
            currentField = '';
        } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
            currentLine.push(currentField.trim());
            if (currentLine.some(field => field.length > 0)) {
                lines.push(currentLine);
            }
            currentLine = [];
            currentField = '';
            i++;
        } else {
            currentField += char;
        }
    }

    if (currentField || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        if (currentLine.some(field => field.length > 0)) {
            lines.push(currentLine);
        }
    }

    return lines;
}

const csvPath = '/Users/2302-n0214/Downloads/비즈케어 내 대웅 건강제도 정리_최종_다나아.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = parseCSV(csvContent);

// 헤더 찾기
let headerIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 2 && lines[i][2] && lines[i][2].includes('목적')) {
        headerIndex = i;
        break;
    }
}

// 데이터 추출
const purposes = [];
let lastCategory = '';
for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length >= 9 && row[1] && row[1].trim()) {
        const category = row[0] ? row[0].trim() : lastCategory;
        const subcategory = row[1].trim();
        const purpose = row[2] ? row[2].trim() : '';

        if (category) lastCategory = category;

        purposes.push(purpose || '(목적/취지 없음)');
        console.log(`[${purposes.length}] ${category} > ${subcategory} → ${purpose || '(없음)'}`);
    }
}

console.log(`\n총 ${purposes.length}개 추출`);

// JSON으로 저장
fs.writeFileSync('purposes.json', JSON.stringify(purposes, null, 2), 'utf-8');
console.log('purposes.json 파일로 저장됨');
