const fs = require('fs');
const path = require('path');

const boardDataPath = path.join(__dirname, 'board-data.json');
const boardData = JSON.parse(fs.readFileSync(boardDataPath, 'utf-8'));

let updatedCount = 0;

Object.keys(boardData).forEach(id => {
    const post = boardData[id];
    
    // health-policy 게시글만 수정
    if (post.board_type === 'health-policy') {
        // 기존 "기타" -> "복리후생"으로 변경
        if (post.category_name === '기타') {
            post.category_name = '복리후생';
            post.category_code = 'WELFARE';
            updatedCount++;
        }
        
        // "정신건강" -> "마음건강"으로 변경
        if (post.category_name === '정신건강') {
            post.category_name = '마음건강';
            post.category_code = 'MENTAL';
            updatedCount++;
        }
        
        // 태그도 업데이트
        if (post.tag) {
            try {
                let tags = JSON.parse(post.tag);
                tags = tags.map(tag => {
                    if (tag === '기타') return '복리후생';
                    if (tag === '정신건강') return '마음건강';
                    return tag;
                });
                post.tag = JSON.stringify(tags);
            } catch (e) {
                // 태그 파싱 실패 시 무시
            }
        }
        
        boardData[id] = post;
    }
});

// 저장
fs.writeFileSync(boardDataPath, JSON.stringify(boardData, null, 4), 'utf-8');
console.log(`✅ ${updatedCount}개의 게시글 카테고리가 수정되었습니다.`);
console.log(`   - "기타" → "복리후생" (WELFARE)`);
console.log(`   - "정신건강" → "마음건강" (MENTAL)`);
