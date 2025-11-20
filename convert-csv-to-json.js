const fs = require('fs');
const path = require('path');

// CSV 파일 읽기
const csvPath = '/Users/2302-n0214/Downloads/비즈케어 내 대웅 건강제도 정리_최종_다나아.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// CSV 파싱
const lines = csvContent.split('\n').slice(3); // 헤더 3줄 건너뛰기
const headers = ['category', 'subcategory', 'purpose', 'target', 'detail', 'method', 'url', 'document', 'department'];

const data = [];
lines.forEach(line => {
    if (!line.trim()) return;
    
    // CSV 파싱 (쉼표로 구분, 따옴표 처리)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    
    if (values.length >= 9) {
        const item = {
            category: values[0],
            subcategory: values[1],
            purpose: values[2],
            target: values[3],
            detail: values[4],
            method: values[5],
            url: values[6],
            document: values[7],
            department: values[8]
        };
        
        if (item.subcategory && item.subcategory.trim()) {
            data.push(item);
        }
    }
});

// board-data.json 읽기
const boardDataPath = path.join(__dirname, 'board-data.json');
const boardData = JSON.parse(fs.readFileSync(boardDataPath, 'utf-8'));

// 기존 health-policy 게시글 ID 찾기
const healthPolicyIds = Object.keys(boardData).filter(id => 
    boardData[id].board_type === 'health-policy' && !boardData[id].is_deleted
);

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
    const categoryName = item.category === '복리후생' ? '복리후생' : item.category;
    
    // HTML 컨텐츠 생성
    let content = `<div style="padding-top:50px; height:0px; overflow:hidden;"></div>`;
    content += `<p style="text-align: center;"><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>${item.subcategory}</b></span></span></p>`;
    content += `<p style="text-align: center;">&nbsp;</p>`;
    
    if (item.purpose) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>목적/취지</b></span></span></h3>`;
        content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.purpose}</span></span></p>`;
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.target) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>제공대상</b></span></span></h3>`;
        content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.target}</span></span></p>`;
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.detail) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>상세 내용</b></span></span></h3>`;
        const details = item.detail.split('\n').filter(d => d.trim());
        if (details.length > 1) {
            content += `<ul>`;
            details.forEach(d => {
                content += `<li><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${d.trim()}</span></span></li>`;
            });
            content += `</ul>`;
        } else {
            content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.detail}</span></span></p>`;
        }
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.method) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>진행방식</b></span></span></h3>`;
        content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.method}</span></span></p>`;
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.url && item.url.trim() && item.url !== '-') {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>신청방법</b></span></span></h3>`;
        if (item.url.startsWith('http')) {
            content += `<p><a href="${item.url}" target="_blank"><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.url}</span></span></a></p>`;
        } else {
            content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.url}</span></span></p>`;
        }
        content += `<p>&nbsp;</p>`;
    }
    
    if (item.department && item.department.trim()) {
        content += `<h3><span style="font-family:Nanum Gothic;"><span style="font-size:18px;"><b>담당부서</b></span></span></h3>`;
        content += `<p><span style="font-family:Nanum Gothic;"><span style="font-size:16px;">${item.department}</span></span></p>`;
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
        view_count: Math.floor(Math.random() * 500) + 100,
        comment_count: 0,
        like_count: Math.floor(Math.random() * 300),
        board_type: "health-policy",
        tag: `["${item.category}","건강제도","복지"]`,
        category_code: categoryCode,
        category_name: categoryName,
        thumbnail: "",
        attachments: [],
        comments: [],
        is_public: true,
        is_deleted: false
    };
    
    boardData[currentId] = newPost;
    currentId++;
});

// 기존 health-policy 게시글 삭제
healthPolicyIds.forEach(id => {
    if (boardData[id]) {
        boardData[id].is_deleted = true;
    }
});

// 저장
fs.writeFileSync(boardDataPath, JSON.stringify(boardData, null, 4), 'utf-8');
console.log(`총 ${data.length}개의 새로운 게시글이 생성되었습니다.`);
console.log(`기존 ${healthPolicyIds.length}개의 health-policy 게시글이 삭제 처리되었습니다.`);
