const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

// 데이터 파일 경로
const DATA_FILE = path.join(__dirname, '../data/health-care-data.json');

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        // 디렉토리 존재 여부 확인 로직은 server.js에서 처리한다고 가정하거나 여기서 처리
        // 여기서는 간단히 uploads 폴더 사용
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// 유틸리티: JSON 읽기
// 유틸리티: JSON 읽기
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const result = JSON.parse(data);

        // 필수 필드가 없는 경우 초기화
        if (!result.boards) result.boards = [];
        if (!result.companies) result.companies = [];
        if (!result.categories) result.categories = {};
        if (!result.contentTypeNames) result.contentTypeNames = {};

        return result;
    } catch (error) {
        // 파일이 없거나 문법 오류인 경우 초기 구조 반환
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            return { boards: [], companies: [], categories: {}, contentTypeNames: {} };
        }
        throw error;
    }
}

// 유틸리티: JSON 쓰기
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
}

// 카테고리 매핑
const CATEGORY_MAP = {
    CUSTOM_FIT: "개인 맞춤 체력관리",
    MUSCULOSKELETAL: "근골격계 대사성 질환",
    HEALTH_CHECK: "건강검진 데이터 서비스",
    RECOVERY: "일상 활력 피로회복"
};

// 1. 콘텐츠 목록 조회 (GET /)
router.get('/', async (req, res) => {
    try {
        const { company_no, board_type, category_code, title, page = 1, size = 10 } = req.query;
        const data = await readData();
        let list = data.boards.filter(item => !item.is_deleted); // 삭제되지 않은 것만

        // 필터링
        if (company_no) {
            list = list.filter(item => item.company_no === parseInt(company_no));
        }
        if (board_type && board_type !== 'ALL') {
            list = list.filter(item => item.board_type === board_type);
        }
        if (category_code && board_type === 'PHYSICAL') {
            list = list.filter(item => item.category_code === category_code);
        }
        if (title) {
            list = list.filter(item => item.title.includes(title));
        }

        // 정렬 (최신순)
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // 페이지네이션
        const pageNum = parseInt(page);
        const sizeNum = parseInt(size);
        const totalElements = list.length;
        const totalPages = Math.ceil(totalElements / sizeNum);
        const startIndex = (pageNum - 1) * sizeNum;
        const pagedList = list.slice(startIndex, startIndex + sizeNum);

        // 현재 요청의 도메인 정보 생성
        const protocol = 'http';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // 이미지 URL에 도메인 추가
        const responseList = pagedList.map(item => {
            const updatedItem = { ...item };
            if (updatedItem.thumbnail_url && updatedItem.thumbnail_url.startsWith('/')) {
                updatedItem.thumbnail_url = `${baseUrl}${updatedItem.thumbnail_url}`;
            }
            if (updatedItem.icon_url && updatedItem.icon_url.startsWith('/')) {
                updatedItem.icon_url = `${baseUrl}${updatedItem.icon_url}`;
            }
            return updatedItem;
        });

        res.json({
            success: true,
            data: {
                content: responseList,
                page: pageNum,
                size: sizeNum,
                total_elements: totalElements,
                total_pages: totalPages
            },
            message: "Success"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. 콘텐츠 상세 조회 (GET /:id)
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = await readData();
        const item = data.boards.find(b => b.id === id);

        if (!item) {
            return res.status(404).json({ success: false, message: "Content not found" });
        }

        // 현재 요청의 도메인 정보 생성
        const protocol = 'http';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        const responseItem = { ...item };
        if (responseItem.thumbnail_url && responseItem.thumbnail_url.startsWith('/')) {
            responseItem.thumbnail_url = `${baseUrl}${responseItem.thumbnail_url}`;
        }
        if (responseItem.icon_url && responseItem.icon_url.startsWith('/')) {
            responseItem.icon_url = `${baseUrl}${responseItem.icon_url}`;
        }

        res.json({ success: true, data: responseItem, message: "Success" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. 콘텐츠 등록 (POST /)
router.post('/', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]), async (req, res) => {
    try {
        const data = await readData();
        const body = req.body;

        // ID 생성
        const maxId = data.boards.reduce((max, item) => item.id > max ? item.id : max, 0);
        const newId = maxId + 1;

        // 파일 처리
        const thumbnail = req.files['thumbnail'] ? `/uploads/${req.files['thumbnail'][0].filename}` : "";
        const icon = req.files['icon'] ? `/uploads/${req.files['icon'][0].filename}` : "";

        // JSON 파싱 (tag, contents)
        let tag = [];
        let contents = [];
        try {
            if (body.tag) tag = JSON.parse(body.tag);
            if (body.contents) contents = JSON.parse(body.contents);
        } catch (e) {
            console.error("JSON parse error:", e);
        }

        // 카테고리 이름 매핑
        const categoryName = body.board_type === 'PHYSICAL' ? CATEGORY_MAP[body.category_code] : null;

        const newItem = {
            id: newId,
            board_type: body.board_type,
            category_code: body.category_code || null,
            category_name: categoryName,
            title: body.title,
            summary: body.summary,
            thumbnail_url: thumbnail,
            icon_url: icon,
            description: body.description,
            button_name: body.button_name,
            button_url: body.button_url,
            tag: tag,
            contents: contents,
            company_no: parseInt(body.company_no),
            company_name: "대웅제약", // 임시 고정 또는 조회 필요
            author_id: "admin",
            author_name: "관리자",
            is_public: body.is_public === 'true' || body.is_public === true,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        data.boards.push(newItem);
        await writeData(data);

        res.json({ success: true, data: { id: newId }, message: "등록되었습니다." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7. 노출 상태 변경 (PUT /visibility) - 순서 중요: /:id보다 먼저 정의해야 함
router.put('/visibility', async (req, res) => {
    try {
        const { ids, is_public } = req.body;
        if (!ids || !Array.isArray(ids) || is_public === undefined) {
            return res.status(400).json({ success: false, message: "Invalid parameters" });
        }

        const data = await readData();
        let updatedCount = 0;

        data.boards = data.boards.map(item => {
            if (ids.includes(item.id)) {
                item.is_public = is_public;
                updatedCount++;
            }
            return item;
        });

        await writeData(data);

        res.json({ success: true, data: { updated_count: updatedCount }, message: "노출 상태가 변경되었습니다." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. 콘텐츠 수정 (PUT /:id)
router.put('/:id', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = await readData();
        const index = data.boards.findIndex(b => b.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: "Content not found" });
        }

        const body = req.body;
        const item = data.boards[index];

        // 파일 처리 (새 파일이 있으면 교체, 없으면 유지)
        if (req.files['thumbnail']) {
            item.thumbnail_url = `/uploads/${req.files['thumbnail'][0].filename}`;
        }
        if (req.files['icon']) {
            item.icon_url = `/uploads/${req.files['icon'][0].filename}`;
        }

        // 필드 업데이트
        if (body.board_type) item.board_type = body.board_type;
        if (body.category_code !== undefined) {
            item.category_code = body.category_code;
            item.category_name = item.board_type === 'PHYSICAL' ? CATEGORY_MAP[body.category_code] : null;
        }
        if (body.title) item.title = body.title;
        if (body.summary) item.summary = body.summary;
        if (body.description) item.description = body.description;
        if (body.button_name) item.button_name = body.button_name;
        if (body.button_url) item.button_url = body.button_url;
        if (body.is_public !== undefined) item.is_public = body.is_public === 'true' || body.is_public === true;

        // JSON 파싱 업데이트
        try {
            if (body.tag) item.tag = JSON.parse(body.tag);
            if (body.contents) item.contents = JSON.parse(body.contents);
        } catch (e) {
            console.error("JSON parse error:", e);
        }

        item.updated_at = new Date().toISOString();

        data.boards[index] = item;
        await writeData(data);

        res.json({ success: true, data: { id: id }, message: "수정되었습니다." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. 다중 삭제 (DELETE /)
router.delete('/', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ success: false, message: "Invalid ids" });
        }

        const data = await readData();
        let deletedCount = 0;

        data.boards = data.boards.map(item => {
            if (ids.includes(item.id)) {
                item.is_deleted = true;
                deletedCount++;
            }
            return item;
        });

        await writeData(data);

        res.json({ success: true, data: { deleted_count: deletedCount }, message: "삭제되었습니다." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. 단일 삭제 (DELETE /:id)
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = await readData();
        const index = data.boards.findIndex(b => b.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: "Content not found" });
        }

        data.boards[index].is_deleted = true;
        await writeData(data);

        res.json({ success: true, data: { id: id }, message: "삭제되었습니다." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});



module.exports = router;
