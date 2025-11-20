const fs = require('fs');
const path = require('path');

// CSV 파싱 함수
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

// CSV 파일 읽기
const csvPath = '/Users/2302-n0214/Downloads/비즈케어 내 대웅 건강제도 정리_최종_다나아.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// CSV 파싱
const lines = parseCSV(csvContent);

// 실제 헤더 찾기 (분류라는 단어가 있는 행)
let headerIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i][0] === '분류') {
        headerIndex = i;
        break;
    }
}

if (headerIndex === -1) {
    console.error('헤더를 찾을 수 없습니다.');
    process.exit(1);
}

const headers = lines[headerIndex];
console.log('Headers found at line', headerIndex + 1, ':', headers);

// 목적/취지 추출 (헤더 다음 줄부터)
const purposes = [];
for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length >= 3 && row[0] && row[0] !== '분류') { // 분류가 있고, "분류"라는 단어가 아닌 행만 처리
        const category = row[0] || '';
        const subcategory = row[1] || '';
        const purpose = row[2] || ''; // 목적/취지는 3번째 열 (index 2)

        purposes.push({
            category,
            subcategory,
            purpose: purpose || '(목적/취지 없음)'
        });

        console.log(`[${purposes.length}] ${category} > ${subcategory}`);
        console.log(`    목적/취지: ${purpose || '(없음)'}`);
    }
}

console.log(`\n총 ${purposes.length}개의 목적/취지 추출됨\n`);

// board-data.json 읽기
const boardDataPath = path.join(__dirname, 'board-data.json');
const boardData = JSON.parse(fs.readFileSync(boardDataPath, 'utf-8'));

// health-policy 게시글만 필터링 (is_deleted가 false인 것만)
const healthPolicyPosts = [];
for (const key in boardData) {
    const post = boardData[key];
    if (post.board_type === 'health-policy' && !post.is_deleted) {
        healthPolicyPosts.push({ post, key });
    }
}

// ID 순으로 정렬
healthPolicyPosts.sort((a, b) => a.post.id - b.post.id);

console.log(`health-policy 게시글 ${healthPolicyPosts.length}개 발견\n`);

// 타이틀 업데이트
let updateCount = 0;
for (let i = 0; i < Math.min(healthPolicyPosts.length, purposes.length); i++) {
    const { post, key } = healthPolicyPosts[i];
    const purpose = purposes[i].purpose;

    console.log(`[${i + 1}] ID ${post.id}: "${post.title}" → "${purpose}"`);

    boardData[key].title = purpose;
    updateCount++;
}

// 파일 저장
fs.writeFileSync(boardDataPath, JSON.stringify(boardData, null, 4), 'utf-8');

console.log(`\n✅ 총 ${updateCount}개의 게시글 title이 업데이트되었습니다.`);
