const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// 데이터 파일 경로
const DATA_FILE = path.join(__dirname, '../data/health-care-data.json');

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
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            return { boards: [], companies: [], categories: {}, contentTypeNames: {} };
        }
        throw error;
    }
}

// 유저용 필드 필터링 함수
function filterUserFields(item) {
    return {
        id: item.id,
        board_type: item.board_type,
        category_code: item.category_code,
        category_name: item.category_name,
        title: item.title,
        summary: item.summary,
        thumbnail_url: item.thumbnail_url,
        icon_url: item.icon_url,
        description: item.description, // 상세 조회 시에만 필요하지만 목록에서도 포함해도 무방 (목록에서는 제외하는게 일반적이나 요구사항에 따라)
        button_name: item.button_name,
        button_url: item.button_url,
        tag: item.tag,
        contents: item.contents, // 상세 조회 시에만 필요
        company_no: item.company_no,
        company_name: item.company_name,
        created_at: item.created_at
        // author_id, author_name, is_public, is_deleted, updated_at 제외
    };
}

// 목록용 필드 필터링 (description, contents, button 정보 등 상세 정보 제외)
function filterUserListFields(item) {
    return {
        id: item.id,
        board_type: item.board_type,
        category_code: item.category_code,
        category_name: item.category_name,
        title: item.title,
        summary: item.summary, // 목록에 summary 포함
        thumbnail_url: item.thumbnail_url,
        icon_url: item.icon_url,
        tag: item.tag,
        button_name: item.button_name,
        button_url: item.button_url,
        company_no: item.company_no,
        company_name: item.company_name,
        created_at: item.created_at
    };
}

// 1. 콘텐츠 목록 조회 (GET /)
router.get('/', async (req, res) => {
    try {
        const { company_no, board_type, category_code, page = 1, size = 10 } = req.query;
        const data = await readData();

        // 공개되고 삭제되지 않은 콘텐츠만 조회
        let list = data.boards.filter(item => item.is_public && !item.is_deleted);

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

        // 필드 필터링 (목록용) 및 도메인 추가
        const responseList = pagedList.map(item => {
            const filteredItem = filterUserListFields(item);
            if (filteredItem.thumbnail_url && filteredItem.thumbnail_url.startsWith('/')) {
                filteredItem.thumbnail_url = `${baseUrl}${filteredItem.thumbnail_url}`;
            }
            if (filteredItem.icon_url && filteredItem.icon_url.startsWith('/')) {
                filteredItem.icon_url = `${baseUrl}${filteredItem.icon_url}`;
            }
            return filteredItem;
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

        // 존재하지 않거나, 비공개거나, 삭제된 경우 404
        if (!item || !item.is_public || item.is_deleted) {
            return res.status(404).json({ success: false, message: "Content not found" });
        }

        // 필드 필터링 (상세용)
        const responseItem = filterUserFields(item);

        // 현재 요청의 도메인 정보 생성
        const protocol = 'http';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

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

module.exports = router;
