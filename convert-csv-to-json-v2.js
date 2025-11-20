const fs = require('fs');
const path = require('path');

// CSV 파일 읽기
const csvPath = '/Users/2302-n0214/Downloads/비즈케어 내 대웅 건강제도 정리_최종_다나아.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// CSV 전체를 파싱 (줄바꿈이 셀 안에 있을 수 있음)
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
                i++; // 다음 따옴표 건너뛰기
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
    
    // 마지막 셀과 행 추가
    if (cell || row.length > 0) {
        row.push(cell);
        if (row.some(c => c.trim())) {
            rows.push(row);
        }
    }
    
    return rows;
}

const rows = parseCSV(csvContent);

// 헤더 찾기 (3번째 줄)
const headerRow = rows[2];
console.log('Headers:', headerRow);

// 데이터 행들
const dataRows = rows.slice(3);

const data = [];
dataRows.forEach((row, index) => {
    if (row.length >= 9 && row[1] && row[1].trim()) {
        const item = {
            category: row[0] ? row[0].trim() : '',
            subcategory: row[1] ? row[1].trim() : '',
            purpose: row[2] ? row[2].trim() : '',
            target: row[3] ? row[3].trim() : '',
            detail: row[4] ? row[4].trim() : '',
            method: row[5] ? row[5].trim() : '',
            url: row[6] ? row[6].trim() : '',
            document: row[7] ? row[7].trim() : '',
            department: row[8] ? row[8].trim() : ''
        };
        
        // 카테고리가 비어있으면 이전 항목의 카테고리 사용
        if (!item.category && data.length > 0) {
            item.category = data[data.length - 1].category;
        }
        
        data.push(item);
        console.log(`${index + 1}. ${item.category} - ${item.subcategory}`);
    }
});

console.log(`\n총 ${data.length}개의 항목이 파싱되었습니다.\n`);

// board-data.json 읽기
const boardDataPath = path.join(__dirname, 'board-data.json');
const boardData = JSON.parse(fs.readFileSync(boardDataPath, 'utf-8'));

// 기존 health-policy 게시글 삭제 처리
const healthPolicyIds = Object.keys(boardData).filter(id => 
    boardData[id].board_type === 'health-policy' && !boardData[id].is_deleted
);

healthPolicyIds.forEach(id => {
    boardData[id].is_deleted = true;
});

// 카테고리 매핑
const categoryMap = {
    '신체건강': 'PHYSICAL',
    '정신건강': 'MENTAL',
    '기타': 'WELFARE'
};

// 새로운 게시글 생성
let currentId = Math.max(...Object.keys(boardData).map(id => parseInt(id))) + 1;
const now = new Date().toISOString();

data.forEach((item, index) => {
    const categoryCode = categoryMap[item.category] || 'WELFARE';
    
    // HTML 컨텐츠 생성
    let content = `<div style="padding-top:50px; height:0px; overflow:hidden;"></div>`;
    content += `<p style="text-align: center;"><span style="font-family:Nanum Gothic;"><span style="font-size:20px;"><b>${item.subcategory}</b></span></span></p>`;
    content += `<p style="text-align: center;">&nbsp;</p>`;
    
    if (item.purpose) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>📌 목적/취지</b></span></span></h3>`;
        content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.purpose.replace(/\n/g, '<br>')}</span></span></p>`;
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.target) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>👥 제공대상</b></span></span></h3>`;
        content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.target.replace(/\n/g, '<br>')}</span></span></p>`;
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.detail) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>�� 상세 내용</b></span></span></h3>`;
        const details = item.detail.split('\n').map(d => d.trim()).filter(d => d);
        if (details.length > 1) {
            content += `<ul>`;
            details.forEach(d => {
                content += `<li><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${d}</span></span></li>`;
            });
            content += `</ul>`;
        } else {
            content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.detail.replace(/\n/g, '<br>')}</span></span></p>`;
        }
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.method && item.method !== '상시') {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>🔄 진행방식</b></span></span></h3>`;
        content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.method.replace(/\n/g, '<br>')}</span></span></p>`;
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.url && item.url.trim() && item.url !== '-') {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>📝 신청방법</b></span></span></h3>`;
        const urls = item.url.split('\n').map(u => u.trim()).filter(u => u);
        urls.forEach(url => {
            if (url.startsWith('http')) {
                content += `<p><a href="${url}" target="_blank"><span style="font-family:Nanum Gothic;"><span style="font-size:16px;"><u>${url}</u></span></span></a></p>`;
            } else {
                content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${url}</span></span></p>`;
            }
        });
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.department && item.department.trim()) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>☎️ 담당부서</b></span></span></h3>`;
        content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.department.replace(/\n/g, '<br>')}</span></span></p>`;
    }
    
    const newPost = {
        id: currentId,
        title: item.subcategory,
        content: content,
        author_name: "관리자",
        author_id: "admin",
        created_at: now,
        updated_at: now,
        company_name: "대웅제약",
        company_no: 45,
        view_count: Math.floor(Math.random() * 1000) + 200,
        comment_count: 0,
        like_count: Math.floor(Math.random() * 500),
        board_type: "health-policy",
        tag: `["${item.category}","건강제도","복지"]`,
        category_code: categoryCode,
        category_name: item.category,
        thumbnail: "",
        attachments: [],
        comments: [],
        is_public: true,
        is_deleted: false
    };
    
    boardData[currentId] = newPost;
    currentId++;
});

// 저장
fs.writeFileSync(boardDataPath, JSON.stringify(boardData, null, 4), 'utf-8');
console.log(`\n✅ 총 ${data.length}개의 새로운 게시글이 생성되었습니다.`);
console.log(`✅ 기존 ${healthPolicyIds.length}개의 health-policy 게시글이 삭제 처리되었습니다.`);
