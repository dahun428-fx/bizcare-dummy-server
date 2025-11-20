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

// CSV 데이터를 map으로 만들기 (소분류 -> 목적/취지)
const csvMap = {};
let lastCategory = '';
dataRows.forEach((row) => {
    if (row.length >= 9 && row[1] && row[1].trim()) {
        const category = row[0] ? row[0].trim() : lastCategory;
        const subcategory = row[1].trim();
        const purpose = row[2] ? row[2].trim() : '';

        if (category) lastCategory = category;

        csvMap[subcategory] = purpose || '(목적/취지 없음)';
    }
});

console.log('CSV Map created:');
Object.keys(csvMap).forEach(key => {
    console.log(`  "${key}" → "${csvMap[key].substring(0, 50)}..."`);
});

// board-data.json 읽기
const boardData = JSON.parse(fs.readFileSync('./board-data.json', 'utf-8'));

const posts = [];
for (const k in boardData) {
    if (boardData[k].board_type === 'health-policy' && !boardData[k].is_deleted) {
        posts.push({ key: k, post: boardData[k] });
    }
}
posts.sort((a, b) => a.post.id - b.post.id);

console.log(`\n\nMatching ${posts.length} posts with CSV data...\n`);

let matchCount = 0;
let noMatchCount = 0;

posts.forEach(({ key, post }) => {
    // content에서 소분류 제목 추출
    const match = post.content.match(/<b>([^<]+)<\/b>/);
    if (match) {
        const contentTitle = match[1].trim();

        // CSV에서 목적/취지 찾기
        const purpose = csvMap[contentTitle];

        if (purpose && purpose !== '(목적/취지 없음)') {
            console.log(`✓ ID ${post.id}: "${contentTitle}" → "${purpose.substring(0, 50)}..."`);
            boardData[key].title = purpose;
            matchCount++;
        } else {
            console.log(`✗ ID ${post.id}: "${contentTitle}" → NO MATCH`);
            noMatchCount++;
        }
    }
});

// 파일 저장
fs.writeFileSync('./board-data.json', JSON.stringify(boardData, null, 4), 'utf-8');

console.log(`\n✅ ${matchCount}개 매칭 성공`);
console.log(`⚠️  ${noMatchCount}개 매칭 실패`);
