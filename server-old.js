const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const lockfile = require('proper-lockfile');

const app = express();
const PORT = 8300;

// Multer 설정 (메모리에 저장)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${ip}`);
    next();
});

// 파일 경로
const BOARD_LIST_FILE = path.join(__dirname, 'health-board-dummy.json');
const BOARD_DETAIL_FILE = path.join(__dirname, 'health-board-detail-dummy.json');
const POLICY_LIST_FILE = path.join(__dirname, 'policy-list.json');
const POLICY_DETAIL_FILE = path.join(__dirname, 'policy-detail.json');

// 유틸리티 함수: JSON 파일 읽기 (락 적용)
async function readJsonFile(filePath) {
    let release;
    try {
        // 파일 락 획득 (최대 5초 대기)
        release = await lockfile.lock(filePath, {
            retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
            stale: 10000
        });

        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    } finally {
        // 락 해제
        if (release) {
            try {
                await release();
            } catch (e) {
                console.error('Error releasing lock:', e);
            }
        }
    }
}

// 유틸리티 함수: JSON 파일 쓰기 (락 적용)
async function writeJsonFile(filePath, data) {
    let release;
    try {
        // 파일 락 획득 (최대 5초 대기)
        release = await lockfile.lock(filePath, {
            retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
            stale: 10000
        });

        await fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf-8');
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        throw error;
    } finally {
        // 락 해제
        if (release) {
            try {
                await release();
            } catch (e) {
                console.error('Error releasing lock:', e);
            }
        }
    }
}

// ==================== REST API 엔드포인트 ====================

// 0. 현재 사용자 정보 조회 (GET /auth/current-user)
app.get('/api/auth/current-user', async (req, res) => {
    try {
        // 더미 사용자 정보 반환
        const currentUser = {
            id: 'user123',
            name: '홍길동',
            companyName: '대웅제약',
            email: 'hong@example.com'
        };

        res.json({
            success: true,
            data: currentUser
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '사용자 정보 조회 실패',
            error: error.message
        });
    }
});

// 1. 게시글 목록 조회 (GET /api/health/board)
app.get('/api/health/board', async (req, res) => {
    try {
        const boardList = await readJsonFile(BOARD_LIST_FILE);

        // 쿼리 파라미터로 필터링 (예: 태그, 작성자 등)
        const { tag, author, search } = req.query;
        let filteredList = boardList;

        if (tag) {
            filteredList = filteredList.filter(item =>
                item.tags.includes(tag)
            );
        }

        if (author) {
            filteredList = filteredList.filter(item =>
                item.author === author
            );
        }

        if (search) {
            filteredList = filteredList.filter(item =>
                item.title.includes(search) || item.content.includes(search)
            );
        }

        res.json({
            success: true,
            data: filteredList,
            total: filteredList.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 목록 조회 실패',
            error: error.message
        });
    }
});

// 2. 게시글 상세 조회 (GET /api/health/board/:id)
app.get('/api/health/board/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const boardDetails = await readJsonFile(BOARD_DETAIL_FILE);
        const boardList = await readJsonFile(BOARD_LIST_FILE);

        const detail = boardDetails[id];

        if (!detail) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // 조회수 증가
        const listItem = boardList.find(item => item.id === parseInt(id));
        if (listItem) {
            listItem.viewCount += 1;
            await writeJsonFile(BOARD_LIST_FILE, boardList);

            // detail의 viewCount도 업데이트
            detail.viewCount = listItem.viewCount;
            boardDetails[id] = detail;
            await writeJsonFile(BOARD_DETAIL_FILE, boardDetails);
        }

        res.json({
            success: true,
            data: detail
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 상세 조회 실패',
            error: error.message
        });
    }
});

// 3. 게시글 생성 (POST /api/health/board)
app.post('/api/health/board', upload.any(), async (req, res) => {
    try {
        const { title, board_type, content, author_name, author_id, tag } = req.body;

        if (!title || !content || !author_name || !author_id) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요. (title, content, author_name, author_id)'
            });
        }

        const boardList = await readJsonFile(BOARD_LIST_FILE);
        const boardDetails = await readJsonFile(BOARD_DETAIL_FILE);

        // 새 ID 생성
        const newId = Math.max(...boardList.map(item => item.id)) + 1;
        const now = new Date().toISOString().split('T')[0];

        // 목록에 추가할 데이터
        const newListItem = {
            id: newId,
            title,
            board_type,
            content: content.substring(0, 100), // 목록에는 요약만
            author_id,
            author_name,
            created_at: now,
            view_count: 0,
            comment_count: 0,
            like_count: 0,
            tag: tag || "[]",
            updated_at: now,
        };

        // 상세 데이터
        const newDetailItem = {
            id: newId,
            title,
            content,
            author_name,
            author_id,
            created_at: now,
            view_count: 0,
            tag: tag || "[]",
            attachments: [],
            comments: [],
            is_public: true,
            is_deleted: false,

        };

        boardList.unshift(newListItem); // 맨 앞에 추가
        boardDetails[newId] = newDetailItem;

        await writeJsonFile(BOARD_LIST_FILE, boardList);
        await writeJsonFile(BOARD_DETAIL_FILE, boardDetails);

        res.status(201).json({
            success: true,
            message: '게시글이 생성되었습니다.',
            data: newDetailItem
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 생성 실패',
            error: error.message
        });
    }
});

// 4. 게시글 수정 (PUT /api/health/board/:id)
app.put('/api/health/board/:id', upload.any(), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, board_type, content, tag } = req.body;

        const boardList = await readJsonFile(BOARD_LIST_FILE);
        const boardDetails = await readJsonFile(BOARD_DETAIL_FILE);

        const detail = boardDetails[id];
        const listItemIndex = boardList.findIndex(item => item.id === parseInt(id));

        if (!detail || listItemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const now = new Date().toISOString().split('T')[0];

        // 수정
        if (title) {
            detail.title = title;
            boardList[listItemIndex].title = title;
        }
        if (board_type) {
            boardList[listItemIndex].board_type = board_type;
        }
        if (content) {
            detail.content = content;
            boardList[listItemIndex].content = content.substring(0, 100);
        }
        if (tag) {
            detail.tag = tag;
            boardList[listItemIndex].tag = tag;
        }

        // updated_at 갱신
        boardList[listItemIndex].updated_at = now;

        boardDetails[id] = detail;
        await writeJsonFile(BOARD_LIST_FILE, boardList);
        await writeJsonFile(BOARD_DETAIL_FILE, boardDetails);

        res.json({
            success: true,
            message: '게시글이 수정되었습니다.',
            data: detail
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 수정 실패',
            error: error.message
        });
    }
});

// 5. 게시글 삭제 (DELETE /api/health/board/:id)
app.delete('/api/health/board/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const boardList = await readJsonFile(BOARD_LIST_FILE);
        const boardDetails = await readJsonFile(BOARD_DETAIL_FILE);

        const listItemIndex = boardList.findIndex(item => item.id === parseInt(id));

        if (!boardDetails[id] || listItemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // 삭제
        boardList.splice(listItemIndex, 1);
        delete boardDetails[id];

        await writeJsonFile(BOARD_LIST_FILE, boardList);
        await writeJsonFile(BOARD_DETAIL_FILE, boardDetails);

        res.json({
            success: true,
            message: '게시글이 삭제되었습니다.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 삭제 실패',
            error: error.message
        });
    }
});

// 6. 댓글 추가 (POST /api/health/board/:id/comments)
app.post('/api/health/board/:id/comments', async (req, res) => {
    console.log('req.params:', req.params);
    console.log('req.body:', req.body);
    try {
        const { id } = req.params;
        const { author_id, author_name, company_name, content, post_id } = req.body;

        if (!author_id || !author_name || !content) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요. (author_id, author_name, content)'
            });
        }

        const boardList = await readJsonFile(BOARD_LIST_FILE);
        const boardDetails = await readJsonFile(BOARD_DETAIL_FILE);

        const detail = boardDetails[id];
        const listItem = boardList.find(item => item.id === parseInt(id));

        if (!detail || !listItem) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // 새 댓글 ID 자동 생성
        const newCommentId = detail.comments.length > 0
            ? Math.max(...detail.comments.map(c => c.id)) + 1
            : 1;

        // createDate 자동 생성
        const now = new Date();
        const created_at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newComment = {
            id: newCommentId,
            post_id,
            author_id,
            author_name,
            company_name: company_name || '대웅제약',
            content,
            created_at
        };

        detail.comments.push(newComment);
        listItem.commentCount = detail.comments.length;

        boardDetails[id] = detail;
        await writeJsonFile(BOARD_LIST_FILE, boardList);
        await writeJsonFile(BOARD_DETAIL_FILE, boardDetails);

        res.status(201).json({
            success: true,
            message: '댓글이 추가되었습니다.',
            data: newComment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '댓글 추가 실패',
            error: error.message
        });
        console.log('errr---. ', error);
    }
});

// 6-1. 댓글 수정 (PUT /api/health/board/:id/comments/:commentId)
app.put('/api/health/board/:id/comments/:commentId', async (req, res) => {
    console.log(req.params, req.body)
    try {
        const { id, commentId } = req.params;
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({
                success: false,
                message: '댓글 내용을 입력해주세요.'
            });
        }
        const boardDetails = await readJsonFile(BOARD_DETAIL_FILE);
        const detail = boardDetails[id];

        if (!detail) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const commentIndex = detail.comments.findIndex(c => c.id === parseInt(commentId));
        if (commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다.'
            });
        }

        detail.comments[commentIndex].content = content;
        boardDetails[id] = detail;
        await writeJsonFile(BOARD_DETAIL_FILE, boardDetails);

        res.json({
            success: true,
            message: '댓글이 수정되었습니다.',
            data: detail.comments[commentIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '댓글 수정 실패',
            error: error.message
        });
    }
});

// 6-2. 댓글 삭제 (DELETE /api/health/board/:id/comments/:commentId)
app.delete('/api/health/board/:id/comments/:commentId', async (req, res) => {
    try {
        const { id, commentId } = req.params;

        const boardList = await readJsonFile(BOARD_LIST_FILE);
        const boardDetails = await readJsonFile(BOARD_DETAIL_FILE);

        const detail = boardDetails[id];
        const listItem = boardList.find(item => item.id === parseInt(id));

        if (!detail || !listItem) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const commentIndex = detail.comments.findIndex(c => c.id === parseInt(commentId));

        if (commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다.'
            });
        }

        detail.comments.splice(commentIndex, 1);
        listItem.commentCount = detail.comments.length;

        boardDetails[id] = detail;
        await writeJsonFile(BOARD_LIST_FILE, boardList);
        await writeJsonFile(BOARD_DETAIL_FILE, boardDetails);

        res.json({
            success: true,
            message: '댓글이 삭제되었습니다.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '댓글 삭제 실패',
            error: error.message
        });
    }
});

// 7. 좋아요 증가 (POST /api/health/board/:id/like)
app.post('/api/health/board/:id/like', async (req, res) => {
    try {
        const { id } = req.params;

        const boardList = await readJsonFile(BOARD_LIST_FILE);
        const listItem = boardList.find(item => item.id === parseInt(id));

        if (!listItem) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        listItem.likeCount += 1;
        await writeJsonFile(BOARD_LIST_FILE, boardList);

        res.json({
            success: true,
            message: '좋아요가 추가되었습니다.',
            likeCount: listItem.likeCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '좋아요 추가 실패',
            error: error.message
        });
    }
});

// ==================== 정책 API 엔드포인트 ====================

// 8. 정책 목록 조회 (GET /api/health/policy)
app.get('/api/health/policy', async (req, res) => {
    try {
        const policyList = await readJsonFile(POLICY_LIST_FILE);

        // 쿼리 파라미터로 필터링
        const { categoryCode, categoryName, tag, search, isVisible } = req.query;
        let filteredList = policyList;

        // isVisible 필터링 (기본값: true, 즉 공개된 정책만 표시)
        if (isVisible !== 'false') {
            filteredList = filteredList.filter(item => item.isVisible !== false);
        }

        if (categoryCode) {
            filteredList = filteredList.filter(item =>
                item.categoryCode === categoryCode
            );
        }

        if (categoryName) {
            filteredList = filteredList.filter(item =>
                item.categoryName === categoryName || item.category === categoryName
            );
        }

        if (tag) {
            filteredList = filteredList.filter(item =>
                item.tags && item.tags.includes(tag)
            );
        }

        if (search) {
            filteredList = filteredList.filter(item =>
                item.title.includes(search) || item.content.includes(search)
            );
        }

        res.json({
            success: true,
            data: filteredList,
            total: filteredList.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '정책 목록 조회 실패',
            error: error.message
        });
    }
});

// 9. 정책 상세 조회 (GET /api/health/policy/:id)
app.get('/api/health/policy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const policyList = await readJsonFile(POLICY_LIST_FILE);
        const policyDetails = await readJsonFile(POLICY_DETAIL_FILE);

        const detail = policyDetails[id];

        if (!detail) {
            return res.status(404).json({
                success: false,
                message: '정책을 찾을 수 없습니다.'
            });
        }

        // 조회수 증가 (목록과 상세 모두)
        const listItem = policyList.find(item => item.id === parseInt(id));
        if (listItem) {
            listItem.viewCount += 1;
            await writeJsonFile(POLICY_LIST_FILE, policyList);

            // detail의 viewCount도 업데이트
            detail.viewCount = listItem.viewCount;
            policyDetails[id] = detail;
            await writeJsonFile(POLICY_DETAIL_FILE, policyDetails);
        }

        res.json({
            success: true,
            data: detail
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '정책 상세 조회 실패',
            error: error.message
        });
    }
});

// 10. 정책 생성 (POST /api/health/policy)
app.post('/api/health/policy', upload.any(), async (req, res) => {
    try {
        const { title, content, author, categoryCode, categoryName, tags, thumbnail } = req.body;

        if (!title || !content || !author) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요. (title, content, author)'
            });
        }

        const policyList = await readJsonFile(POLICY_LIST_FILE);

        // 새 ID 생성
        const newId = Math.max(...policyList.map(item => item.id)) + 1;
        const now = new Date().toISOString().split('T')[0];

        const newPolicy = {
            id: newId,
            title,
            content,
            author,
            createDate: now,
            viewCount: 0,
            commentCount: 0,
            likeCount: 0,
            categoryCode: categoryCode || '',
            categoryName: categoryName || '',
            tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
            isVisible: true,
            thumbnail: thumbnail || '/img/main_bnr1.jpg'
        };

        policyList.unshift(newPolicy);
        await writeJsonFile(POLICY_LIST_FILE, policyList);

        res.status(201).json({
            success: true,
            message: '정책이 생성되었습니다.',
            data: newPolicy
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '정책 생성 실패',
            error: error.message
        });
    }
});

// 11. 정책 수정 (PUT /api/health/policy/:id)
app.put('/api/health/policy/:id', upload.any(), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, categoryCode, categoryName, tags, thumbnail } = req.body;

        const policyList = await readJsonFile(POLICY_LIST_FILE);
        const policyIndex = policyList.findIndex(item => item.id === parseInt(id));

        if (policyIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '정책을 찾을 수 없습니다.'
            });
        }

        const policy = policyList[policyIndex];

        // 수정
        if (title) policy.title = title;
        if (content) policy.content = content;
        if (categoryCode) policy.categoryCode = categoryCode;
        if (categoryName) policy.categoryName = categoryName;
        if (tags) policy.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
        if (thumbnail) policy.thumbnail = thumbnail;

        policyList[policyIndex] = policy;
        await writeJsonFile(POLICY_LIST_FILE, policyList);

        res.json({
            success: true,
            message: '정책이 수정되었습니다.',
            data: policy
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '정책 수정 실패',
            error: error.message
        });
    }
});

// 12. 정책 삭제 (DELETE /api/health/policy/:id)
app.delete('/api/health/policy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const policyList = await readJsonFile(POLICY_LIST_FILE);
        const policyIndex = policyList.findIndex(item => item.id === parseInt(id));

        if (policyIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '정책을 찾을 수 없습니다.'
            });
        }

        policyList.splice(policyIndex, 1);
        await writeJsonFile(POLICY_LIST_FILE, policyList);

        res.json({
            success: true,
            message: '정책이 삭제되었습니다.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '정책 삭제 실패',
            error: error.message
        });
    }
});

// 13. 정책 좋아요 증가 (POST /api/health/policy/:id/like)
app.post('/api/health/policy/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const policyList = await readJsonFile(POLICY_LIST_FILE);
        const policy = policyList.find(item => item.id === parseInt(id));

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: '정책을 찾을 수 없습니다.'
            });
        }

        policy.likeCount += 1;
        await writeJsonFile(POLICY_LIST_FILE, policyList);

        res.json({
            success: true,
            message: '좋아요가 추가되었습니다.',
            likeCount: policy.likeCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '좋아요 추가 실패',
            error: error.message
        });
    }
});

// 14. 정책 댓글 추가 (POST /api/health/policy/:id/comments)
app.post('/api/health/policy/:id/comments', async (req, res) => {
    console.log('req.params:', req.params);
    console.log('req.body:', req.body);
    try {
        const { id } = req.params;
        const { author_id, author_name, company_name, content, post_id } = req.body;

        if (!author_id || !author_name || !content) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요. (author_id, author_name, content)'
            });
        }

        const policyList = await readJsonFile(POLICY_LIST_FILE);
        const policyDetails = await readJsonFile(POLICY_DETAIL_FILE);

        const detail = policyDetails[id];
        const listItem = policyList.find(item => item.id === parseInt(id));

        if (!detail || !listItem) {
            return res.status(404).json({
                success: false,
                message: '정책을 찾을 수 없습니다.'
            });
        }

        // 새 댓글 ID 자동 생성
        const newCommentId = detail.comments.length > 0
            ? Math.max(...detail.comments.map(c => c.id)) + 1
            : 1;

        // createDate 자동 생성
        const now = new Date();
        const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newComment = {
            id: newCommentId,
            post_id,
            author_id,
            author_name,
            company_name: company_name || '대웅제약',
            content,
            createdAt
        };

        detail.comments.push(newComment);
        listItem.commentCount = detail.comments.length;

        policyDetails[id] = detail;
        await writeJsonFile(POLICY_LIST_FILE, policyList);
        await writeJsonFile(POLICY_DETAIL_FILE, policyDetails);

        res.status(201).json({
            success: true,
            message: '댓글이 추가되었습니다.',
            data: newComment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '댓글 추가 실패',
            error: error.message
        });
        console.log('errr---. ', error);
    }
});

// 15. 정책 댓글 수정 (PUT /api/health/policy/:id/comments/:commentId)
app.put('/api/health/policy/:id/comments/:commentId', async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: '댓글 내용을 입력해주세요.'
            });
        }
        const policyDetails = await readJsonFile(POLICY_DETAIL_FILE);
        const detail = policyDetails[id];

        if (!detail) {
            return res.status(404).json({
                success: false,
                message: '정책을 찾을 수 없습니다.'
            });
        }

        const commentIndex = detail.comments.findIndex(c => c.id === parseInt(commentId));

        if (commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다.'
            });
        }

        detail.comments[commentIndex].content = content;
        policyDetails[id] = detail;
        await writeJsonFile(POLICY_DETAIL_FILE, policyDetails);

        res.json({
            success: true,
            message: '댓글이 수정되었습니다.',
            data: detail.comments[commentIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '댓글 수정 실패',
            error: error.message
        });
    }
});

// 16. 정책 댓글 삭제 (DELETE /api/health/policy/:id/comments/:commentId)
app.delete('/api/health/policy/:id/comments/:commentId', async (req, res) => {
    try {
        const { id, commentId } = req.params;

        const policyList = await readJsonFile(POLICY_LIST_FILE);
        const policyDetails = await readJsonFile(POLICY_DETAIL_FILE);

        const detail = policyDetails[id];
        const listItem = policyList.find(item => item.id === parseInt(id));

        if (!detail || !listItem) {
            return res.status(404).json({
                success: false,
                message: '정책을 찾을 수 없습니다.'
            });
        }

        const commentIndex = detail.comments.findIndex(c => c.id === parseInt(commentId));

        if (commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다.'
            });
        }

        detail.comments.splice(commentIndex, 1);
        listItem.commentCount = detail.comments.length;

        policyDetails[id] = detail;
        await writeJsonFile(POLICY_LIST_FILE, policyList);
        await writeJsonFile(POLICY_DETAIL_FILE, policyDetails);

        res.json({
            success: true,
            message: '댓글이 삭제되었습니다.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '댓글 삭제 실패',
            error: error.message
        });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`\n📌 사용 가능한 API 엔드포인트:`);
    console.log(`\n[인증]`);
    console.log(`  GET    /auth/current-user          - 현재 사용자 정보 조회`);
    console.log(`\n[게시판]`);
    console.log(`  GET    /api/health/board           - 게시글 목록 조회`);
    console.log(`  GET    /api/health/board/:id       - 게시글 상세 조회`);
    console.log(`  POST   /api/health/board           - 게시글 생성`);
    console.log(`  PUT    /api/health/board/:id       - 게시글 수정`);
    console.log(`  DELETE /api/health/board/:id       - 게시글 삭제`);
    console.log(`  POST   /api/health/board/:id/comments - 댓글 추가`);
    console.log(`  PUT    /api/health/board/:id/comments/:commentId - 댓글 수정`);
    console.log(`  DELETE /api/health/board/:id/comments/:commentId - 댓글 삭제`);
    console.log(`  POST   /api/health/board/:id/like  - 좋아요 증가`);
    console.log(`\n[정책]`);
    console.log(`  GET    /api/health/policy          - 정책 목록 조회`);
    console.log(`  GET    /api/health/policy/:id      - 정책 상세 조회`);
    console.log(`  POST   /api/health/policy          - 정책 생성`);
    console.log(`  PUT    /api/health/policy/:id      - 정책 수정`);
    console.log(`  DELETE /api/health/policy/:id      - 정책 삭제`);
    console.log(`  POST   /api/health/policy/:id/comments - 댓글 추가`);
    console.log(`  PUT    /api/health/policy/:id/comments/:commentId - 댓글 수정`);
    console.log(`  DELETE /api/health/policy/:id/comments/:commentId - 댓글 삭제`);
    console.log(`  POST   /api/health/policy/:id/like - 좋아요 증가\n`);
});

module.exports = app;
