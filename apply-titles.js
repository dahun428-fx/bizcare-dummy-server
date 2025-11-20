const fs = require('fs');
const path = require('path');

// purposes.json 읽기
const purposes = JSON.parse(fs.readFileSync('purposes.json', 'utf-8'));
console.log(`${purposes.length}개의 목적/취지 로드됨\n`);

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
for (let i = 0; i < healthPolicyPosts.length && i < purposes.length; i++) {
    const { post, key } = healthPolicyPosts[i];
    const purpose = purposes[i];

    // (없음)이 아닌 경우만 업데이트
    if (purpose && purpose !== '(없음)' && purpose !== '(목적/취지 없음)') {
        console.log(`[${i + 1}] ID ${post.id}: "${post.title.substring(0, 50)}..." → "${purpose.substring(0, 50)}..."`);
        boardData[key].title = purpose;
        updateCount++;
    } else {
        console.log(`[${i + 1}] ID ${post.id}: 목적/취지 없음 - 건너뜀`);
    }
}

// 파일 저장
fs.writeFileSync(boardDataPath, JSON.stringify(boardData, null, 4), 'utf-8');

console.log(`\n✅ 총 ${updateCount}개의 게시글 title이 업데이트되었습니다.`);
