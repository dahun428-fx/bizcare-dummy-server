const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = 8300;

// 업로드 디렉토리 설정
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const THUMBNAILS_DIR = path.join(UPLOAD_DIR, 'thumbnails');
const ATTACHMENTS_DIR = path.join(UPLOAD_DIR, 'attachments');

// 디렉토리 생성
if (!fsSync.existsSync(UPLOAD_DIR)) fsSync.mkdirSync(UPLOAD_DIR);
if (!fsSync.existsSync(THUMBNAILS_DIR)) fsSync.mkdirSync(THUMBNAILS_DIR);
if (!fsSync.existsSync(ATTACHMENTS_DIR)) fsSync.mkdirSync(ATTACHMENTS_DIR);

// 안전한 파일명 생성 함수 (한글, 특수문자 처리)
function generateSafeFileName(originalName) {
    const ext = path.extname(originalName);
    const hash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    // 확장자만 유지하고 고유한 해시 파일명 생성
    return `${timestamp}-${hash}${ext}`;
}

// Multer 설정 (파일 저장)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ATTACHMENTS_DIR); // attachments 폴더에 저장
    },
    filename: (req, file, cb) => {
        // 안전한 파일명 생성 (한글 깨짐 방지)
        const safeFileName = generateSafeFileName(file.originalname);
        cb(null, safeFileName);
    },
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 정적 파일 제공 (업로드된 파일 접근용)
app.use('/uploads', express.static(UPLOAD_DIR));

// 요청 로깅
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${ip}`);
    next();
});

// 파일 경로
const BOARD_DATA_FILE = path.join(__dirname, 'board-data.json');

// 외부 URL에서 파일 다운로드 함수
async function downloadFile(url, destinationPath) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000 // 30초 타임아웃
        });

        const writer = fsSync.createWriteStream(destinationPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(destinationPath));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`파일 다운로드 실패: ${url}`, error.message);
        throw error;
    }
}

// 파일명 생성 함수 (랜덤 해시 + 확장자)
function generateFileName(originalUrl) {
    const ext = path.extname(new URL(originalUrl).pathname) || '.jpg';
    const hash = crypto.randomBytes(16).toString('hex');
    return `${hash}${ext}`;
}

// JSON 파일 읽기 (락 적용)
async function readJsonFile(filePath) {
    let release;
    try {
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
        if (release) {
            try {
                await release();
            } catch (e) {
                console.error('Error releasing lock:', e);
            }
        }
    }
}

// JSON 파일 쓰기 (락 적용)
async function writeJsonFile(filePath, data) {
    let release;
    try {
        release = await lockfile.lock(filePath, {
            retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
            stale: 10000
        });
        await fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf-8');
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        throw error;
    } finally {
        if (release) {
            try {
                await release();
            } catch (e) {
                console.error('Error releasing lock:', e);
            }
        }
    }
}

// ==================== API 엔드포인트 ====================

// 0. 현재 사용자 정보 조회
app.get('/api/auth/current-user', async (req, res) => {
    try {
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

// 1-1. 사용자 게시글 목록 조회 (GET /api/board) - is_public=true만 조회
app.get('/api/board', async (req, res) => {
    try {
        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const { board_type, tag, search, page, limit, company_no, category, category_code, sort_by, order } = req.query;

        // 디버깅: 받은 쿼리 파라미터 로깅
        console.log('Query params:', { board_type, category, category_code, sort_by, order });
        if (category) {
            console.log('Category value:', category, 'Type:', typeof category, 'Length:', category.length);
        }
        if (category_code) {
            console.log('Category code value:', category_code, 'Type:', typeof category_code);
        }

        let filteredList = Object.values(boardData);

        // user용: 삭제되지 않고 공개된 게시글만
        filteredList = filteredList.filter(item => !item.is_deleted && item.is_public === true);

        // board_type 필터링
        if (board_type) {
            filteredList = filteredList.filter(item => item.board_type === board_type);
        }

        // company_no 필터링
        if (company_no) {
            filteredList = filteredList.filter(item => item.company_no === parseInt(company_no));
        }

        // category_code 필터링 (health-policy만 해당)
        if (category_code) {
            const decodedCategoryCode = decodeURIComponent(category_code);
            console.log('Before category_code filter:', filteredList.length);
            console.log('Looking for category_code:', decodedCategoryCode);
            filteredList = filteredList.filter(item => {
                const match = item.category_code === decodedCategoryCode;
                if (match) console.log('Matched item:', item.id, item.category_code);
                return match;
            });
            console.log('After category_code filter:', filteredList.length);
        }

        // category 필터링 (health-policy만 해당)
        if (category) {
            const decodedCategory = decodeURIComponent(category);
            console.log('Before category filter:', filteredList.length);
            console.log('Original category:', category);
            console.log('Decoded category:', decodedCategory);
            console.log('Sample categories:', filteredList.slice(0, 3).map(item => item.category_name));
            filteredList = filteredList.filter(item => {
                const match = item.category_name === decodedCategory;
                if (match) console.log('Matched:', item.category_name);
                return match;
            });
            console.log('After category filter:', filteredList.length);
        }

        // tag 필터링
        if (tag) {
            const decodedTag = decodeURIComponent(tag);
            filteredList = filteredList.filter(item => {
                try {
                    const tags = JSON.parse(item.tag || '[]');
                    return tags.includes(decodedTag);
                } catch {
                    return false;
                }
            });
        }

        // 검색 (제목, 내용, 작성자 이름)
        if (search) {
            const decodedSearch = decodeURIComponent(search);
            filteredList = filteredList.filter(item =>
                item.title.includes(decodedSearch) ||
                item.content.includes(decodedSearch) ||
                item.author_name.includes(decodedSearch)
            );
        }

        // 정렬 처리
        const sortBy = sort_by || 'created_at'; // 기본값: created_at
        const sortOrder = order || 'desc'; // 기본값: desc

        filteredList.sort((a, b) => {
            let compareResult = 0;

            switch (sortBy) {
                case 'created_at':
                    compareResult = new Date(a.created_at) - new Date(b.created_at);
                    break;
                case 'like_count':
                    compareResult = (a.like_count || 0) - (b.like_count || 0);
                    break;
                case 'view_count':
                    compareResult = (a.view_count || 0) - (b.view_count || 0);
                    break;
                case 'comment_count':
                    compareResult = (a.comment_count || 0) - (b.comment_count || 0);
                    break;
                default:
                    compareResult = b.id - a.id;
            }

            return sortOrder === 'asc' ? compareResult : -compareResult;
        });

        const total = filteredList.length;

        // 현재 요청의 도메인 정보 생성
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // 각 게시글의 thumbnail과 attachments URL에 도메인 추가
        filteredList = filteredList.map(item => {
            const updatedItem = { ...item };

            // thumbnail URL 처리
            if (updatedItem.thumbnail && updatedItem.thumbnail.startsWith('/')) {
                updatedItem.thumbnail = `${baseUrl}${updatedItem.thumbnail}`;
            }

            // attachments URL 처리
            if (updatedItem.attachments && updatedItem.attachments.length > 0) {
                updatedItem.attachments = updatedItem.attachments.map(att => ({
                    ...att,
                    url: att.url && att.url.startsWith('/') ? `${baseUrl}${att.url}` : att.url,
                    download_url: att.download_url && att.download_url.startsWith('/') ? `${baseUrl}${att.download_url}` : att.download_url
                }));
            }

            return updatedItem;
        });

        // 페이지네이션 처리
        if (page && limit) {
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;

            const paginatedList = filteredList.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: paginatedList,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(total / limitNum),
                    totalCount: total,
                    pageSize: limitNum,
                    hasNext: endIndex < total,
                    hasPrev: pageNum > 1
                },
                message: "Success"
            });
        } else {
            res.json({
                success: true,
                data: filteredList,
                total: total,
                message: "Success"
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 목록 조회 실패',
            error: error.message
        });
    }
});

// 1-2. 관리자 게시글 목록 조회 (GET /api/admin/board) - 모든 게시글 조회
app.get('/api/admin/board', async (req, res) => {
    try {
        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const { board_type, tag, search, is_public, is_deleted, page, limit, company_no, category, category_code, sort_by, order } = req.query;

        let filteredList = Object.values(boardData);

        // admin용: is_deleted 필터링 (기본값: 삭제되지 않은 항목만)
        if (is_deleted === 'true') {
            filteredList = filteredList.filter(item => item.is_deleted === true);
        } else {
            // is_deleted 파라미터가 없거나 'false'인 경우 삭제되지 않은 항목만
            filteredList = filteredList.filter(item => !item.is_deleted);
        }

        if (is_public === 'true') {
            filteredList = filteredList.filter(item => item.is_public === true);
        } else if (is_public === 'false') {
            filteredList = filteredList.filter(item => item.is_public === false);
        }
        // is_public 파라미터가 없으면 공개 여부 관계없이 모두 조회

        // board_type 필터링
        if (board_type) {
            filteredList = filteredList.filter(item => item.board_type === board_type);
        }

        // company_no 필터링
        if (company_no) {
            filteredList = filteredList.filter(item => item.company_no === parseInt(company_no));
        }

        // category_code 필터링 (health-policy만 해당)
        if (category_code) {
            const decodedCategoryCode = decodeURIComponent(category_code);
            filteredList = filteredList.filter(item => item.category_code === decodedCategoryCode);
        }

        // category 필터링 (health-policy만 해당)
        if (category) {
            const decodedCategory = decodeURIComponent(category);
            filteredList = filteredList.filter(item => item.category_name === decodedCategory);
        }

        // tag 필터링
        if (tag) {
            const decodedTag = decodeURIComponent(tag);
            filteredList = filteredList.filter(item => {
                try {
                    const tags = JSON.parse(item.tag || '[]');
                    return tags.includes(decodedTag);
                } catch {
                    return false;
                }
            });
        }

        // 검색 (제목, 내용, 작성자 이름)
        if (search) {
            const decodedSearch = decodeURIComponent(search);
            filteredList = filteredList.filter(item =>
                item.title.includes(decodedSearch) ||
                item.content.includes(decodedSearch) ||
                item.author_name.includes(decodedSearch)
            );
        }

        // 정렬 처리
        const sortBy = sort_by || 'created_at'; // 기본값: created_at
        const sortOrder = order || 'desc'; // 기본값: desc

        filteredList.sort((a, b) => {
            let compareResult = 0;

            switch (sortBy) {
                case 'created_at':
                    compareResult = new Date(a.created_at) - new Date(b.created_at);
                    break;
                case 'like_count':
                    compareResult = (a.like_count || 0) - (b.like_count || 0);
                    break;
                case 'view_count':
                    compareResult = (a.view_count || 0) - (b.view_count || 0);
                    break;
                case 'comment_count':
                    compareResult = (a.comment_count || 0) - (b.comment_count || 0);
                    break;
                default:
                    compareResult = b.id - a.id;
            }

            return sortOrder === 'asc' ? compareResult : -compareResult;
        });

        const total = filteredList.length;

        // 현재 요청의 도메인 정보 생성
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // 각 게시글의 thumbnail과 attachments URL에 도메인 추가
        filteredList = filteredList.map(item => {
            const updatedItem = { ...item };

            // thumbnail URL 처리
            if (updatedItem.thumbnail && updatedItem.thumbnail.startsWith('/')) {
                updatedItem.thumbnail = `${baseUrl}${updatedItem.thumbnail}`;
            }

            // attachments URL 처리
            if (updatedItem.attachments && updatedItem.attachments.length > 0) {
                updatedItem.attachments = updatedItem.attachments.map(att => ({
                    ...att,
                    url: att.url && att.url.startsWith('/') ? `${baseUrl}${att.url}` : att.url,
                    download_url: att.download_url && att.download_url.startsWith('/') ? `${baseUrl}${att.download_url}` : att.download_url
                }));
            }

            return updatedItem;
        });

        // 페이지네이션 처리
        if (page && limit) {
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;

            const paginatedList = filteredList.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: paginatedList,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(total / limitNum),
                    totalCount: total,
                    pageSize: limitNum,
                    hasNext: endIndex < total,
                    hasPrev: pageNum > 1
                },
                message: "Success"
            });
        } else {
            res.json({
                success: true,
                data: filteredList,
                total: total,
                message: "Success"
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 목록 조회 실패',
            error: error.message
        });
    }
});

// 2. 게시글 상세 조회 (GET /api/board/:id)
app.get('/api/board/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // user용: 공개되고 삭제되지 않은 게시글만 조회 가능
        if (post.is_deleted || !post.is_public) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // 조회수 증가
        post.view_count = (post.view_count || 0) + 1;
        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        // 현재 요청의 도메인 정보 생성
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // thumbnail URL에 도메인 추가
        if (post.thumbnail && post.thumbnail.startsWith('/')) {
            post.thumbnail = `${baseUrl}${post.thumbnail}`;
        }

        // attachments URL에 도메인 추가
        if (post.attachments && post.attachments.length > 0) {
            post.attachments = post.attachments.map(att => {
                const updatedAtt = { ...att };

                // download_url이 없는 경우 생성
                if (!updatedAtt.download_url && updatedAtt.url) {
                    if (updatedAtt.url.includes('localhost') || updatedAtt.url.startsWith('/uploads')) {
                        const fileName = updatedAtt.url.split('/').pop();
                        updatedAtt.download_url = `/api/download/${fileName}`;
                    }
                }

                // URL에 도메인 추가
                if (updatedAtt.url && updatedAtt.url.startsWith('/')) {
                    updatedAtt.url = `${baseUrl}${updatedAtt.url}`;
                }
                if (updatedAtt.download_url && updatedAtt.download_url.startsWith('/')) {
                    updatedAtt.download_url = `${baseUrl}${updatedAtt.download_url}`;
                }

                return updatedAtt;
            });
        }

        res.json({
            success: true,
            data: post,
            message: "Success"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 상세 조회 실패',
            error: error.message
        });
    }
});

// 2-1. 관리자 게시글 상세 조회 (GET /api/admin/board/:id)
app.get('/api/admin/board/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // admin용: 삭제/비공개 여부와 관계없이 모든 게시글 조회 가능
        // 조회수 증가
        post.view_count = (post.view_count || 0) + 1;

        // step을 1로 변경 (읽음 처리)
        post.step = 1;

        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        // 현재 요청의 도메인 정보 생성
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // thumbnail URL에 도메인 추가
        if (post.thumbnail && post.thumbnail.startsWith('/')) {
            post.thumbnail = `${baseUrl}${post.thumbnail}`;
        }

        // attachments URL에 도메인 추가
        if (post.attachments && post.attachments.length > 0) {
            post.attachments = post.attachments.map(att => {
                const updatedAtt = { ...att };

                // download_url이 없는 경우 생성
                if (!updatedAtt.download_url && updatedAtt.url) {
                    if (updatedAtt.url.includes('localhost') || updatedAtt.url.startsWith('/uploads')) {
                        const fileName = updatedAtt.url.split('/').pop();
                        updatedAtt.download_url = `/api/download/${fileName}`;
                    }
                }

                // URL에 도메인 추가
                if (updatedAtt.url && updatedAtt.url.startsWith('/')) {
                    updatedAtt.url = `${baseUrl}${updatedAtt.url}`;
                }
                if (updatedAtt.download_url && updatedAtt.download_url.startsWith('/')) {
                    updatedAtt.download_url = `${baseUrl}${updatedAtt.download_url}`;
                }

                return updatedAtt;
            });
        }

        res.json({
            success: true,
            data: post,
            message: "Success"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 상세 조회 실패',
            error: error.message
        });
    }
});

// 3. 게시글 생성 (POST /api/admin/board) - admin만 생성 가능
app.post('/api/admin/board', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
    console.log('req.files:', req);
    try {
        const { title, board_type, company_name, company_no, content, author_name, author_id, tag, category_code, category_name, thumbnail, attachments } = req.body;

        if (!title || !content || !author_name || !author_id || !board_type) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요. (title, content, author_name, author_id, board_type)'
            });
        }

        const boardData = await readJsonFile(BOARD_DATA_FILE);

        // 새 ID 생성
        const existingIds = Object.keys(boardData).map(id => parseInt(id));
        const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const now = new Date().toISOString(); // 날짜 + 시간 포함 (YYYY-MM-DDTHH:mm:ss.sssZ)

        // 첨부파일 ID 생성을 위한 최대값 찾기
        let maxAttachmentId = 0;
        Object.values(boardData).forEach(post => {
            if (post.attachments && post.attachments.length > 0) {
                post.attachments.forEach(att => {
                    if (att.id && att.id > maxAttachmentId) {
                        maxAttachmentId = att.id;
                    }
                });
            }
        });

        // attachments 파싱 및 다운로드
        let parsedAttachments = [];

        // 1. req.files로 업로드된 파일 처리 (attachments 필드만)
        if (req.files && req.files['attachments']) {
            for (const file of req.files['attachments']) {
                maxAttachmentId++;
                parsedAttachments.push({
                    id: maxAttachmentId,
                    name: file.originalname,
                    size: file.size,
                    url: `/uploads/attachments/${file.filename}`,
                    download_url: `/api/download/${file.filename}`,
                    created_at: new Date().toISOString()
                });
            }
        }

        // 2. attachments 파라미터로 전달된 외부 URL 처리
        if (attachments) {
            try {
                const attachmentsArray = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;

                // 첨부파일 다운로드 및 로컬 저장
                for (const attachment of attachmentsArray) {
                    if (attachment.url && attachment.url.startsWith('http')) {
                        try {
                            maxAttachmentId++;
                            const fileName = generateFileName(attachment.url);
                            const localPath = path.join(ATTACHMENTS_DIR, fileName);
                            await downloadFile(attachment.url, localPath);

                            const fileStats = fsSync.statSync(localPath);
                            parsedAttachments.push({
                                id: maxAttachmentId,
                                name: attachment.name || fileName,
                                size: fileStats.size,
                                url: `/uploads/attachments/${fileName}`,
                                download_url: `/api/download/${fileName}`,
                                created_at: new Date().toISOString()
                            });
                        } catch (err) {
                            console.error('첨부파일 다운로드 실패:', err);
                            // 다운로드 실패 시 원본 정보 유지
                            maxAttachmentId++;
                            parsedAttachments.push({
                                id: maxAttachmentId,
                                name: attachment.name || 'unknown',
                                size: attachment.size || 0,
                                url: attachment.url,
                                download_url: attachment.download_url || attachment.url,
                                created_at: new Date().toISOString()
                            });
                        }
                    } else if (attachment.url) {
                        // 이미 로컬 파일인 경우
                        maxAttachmentId++;
                        parsedAttachments.push({
                            id: maxAttachmentId,
                            name: attachment.name || 'file',
                            size: attachment.size || 0,
                            url: attachment.url,
                            download_url: attachment.download_url || attachment.url,
                            created_at: new Date().toISOString()
                        });
                    }
                }
            } catch (e) {
                console.error('attachments 파싱 실패:', e);
            }
        }

        // thumbnail 처리
        let localThumbnail = thumbnail || '';
        console.log('처리 전 thumbnail:', localThumbnail);
        // 1. req.files에서 thumbnail 필드로 업로드된 파일 찾기
        if (req.files && req.files['thumbnail'] && req.files['thumbnail'].length > 0) {
            const thumbnailFile = req.files['thumbnail'][0];
            // 업로드된 파일을 thumbnails 폴더로 이동
            const safeFileName = generateSafeFileName(thumbnailFile.originalname);
            const thumbnailPath = path.join(THUMBNAILS_DIR, safeFileName);
            fsSync.renameSync(thumbnailFile.path, thumbnailPath);
            localThumbnail = `/uploads/thumbnails/${safeFileName}`;
        }

        // 2. thumbnail이 외부 URL인 경우 다운로드
        if (!localThumbnail && thumbnail && thumbnail.startsWith('http')) {
            try {
                const fileName = generateFileName(thumbnail);
                const localPath = path.join(THUMBNAILS_DIR, fileName);
                await downloadFile(thumbnail, localPath);
                localThumbnail = `/uploads/thumbnails/${fileName}`;
            } catch (err) {
                console.error('썸네일 다운로드 실패:', err);
                localThumbnail = thumbnail; // 실패 시 원본 URL 유지
            }
        }

        const newPost = {
            id: newId,
            title,
            content,
            author_name,
            author_id,
            company_name,
            company_no,
            created_at: now,
            updated_at: now,
            view_count: 0,
            comment_count: 0,
            like_count: 0,
            board_type,
            tag: tag || "[]",
            attachments: parsedAttachments,
            comments: [],
            is_public: true,
            is_deleted: false,
            thumbnail: localThumbnail // 모든 게시글 타입에 thumbnail 추가
        };

        // policy 게시판의 경우 추가 필드
        if (board_type === 'health-policy') {
            newPost.category_code = category_code || '';
            newPost.category_name = category_name || '';
        }

        boardData[newId] = newPost;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.status(201).json({
            success: true,
            message: '게시글이 생성되었습니다.',
            data: newPost
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 생성 실패',
            error: error.message
        });
    }
});

// 3. 게시글 생성 (POST /api/board) -
app.post('/api/board', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
    try {
        const { title, board_type, company_name, company_no, content, author_name, author_id, tag, category_code, category_name, thumbnail, attachments, is_public } = req.body;

        if (!title || !content || !author_name || !author_id || !board_type) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요. (title, content, author_name, author_id, board_type)'
            });
        }

        const boardData = await readJsonFile(BOARD_DATA_FILE);

        // 새 ID 생성
        const existingIds = Object.keys(boardData).map(id => parseInt(id));
        const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const now = new Date().toISOString(); // 날짜 + 시간 포함 (YYYY-MM-DDTHH:mm:ss.sssZ)

        // 첨부파일 ID 생성을 위한 최대값 찾기
        let maxAttachmentId = 0;
        Object.values(boardData).forEach(post => {
            if (post.attachments && post.attachments.length > 0) {
                post.attachments.forEach(att => {
                    if (att.id && att.id > maxAttachmentId) {
                        maxAttachmentId = att.id;
                    }
                });
            }
        });

        // attachments 파싱 및 다운로드
        let parsedAttachments = [];

        // 1. req.files로 업로드된 파일 처리 (attachments 필드만)
        if (req.files && req.files['attachments']) {
            for (const file of req.files['attachments']) {
                maxAttachmentId++;
                parsedAttachments.push({
                    id: maxAttachmentId,
                    name: file.originalname,
                    size: file.size,
                    url: `/uploads/attachments/${file.filename}`,
                    download_url: `/api/download/${file.filename}`,
                    created_at: new Date().toISOString()
                });
            }
        }

        // 2. attachments 파라미터로 전달된 외부 URL 처리
        if (attachments) {
            try {
                const attachmentsArray = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;

                // 첨부파일 다운로드 및 로컬 저장
                for (const attachment of attachmentsArray) {
                    if (attachment.url && attachment.url.startsWith('http')) {
                        try {
                            maxAttachmentId++;
                            const fileName = generateFileName(attachment.url);
                            const localPath = path.join(ATTACHMENTS_DIR, fileName);
                            await downloadFile(attachment.url, localPath);

                            const fileStats = fsSync.statSync(localPath);
                            parsedAttachments.push({
                                id: maxAttachmentId,
                                name: attachment.name || fileName,
                                size: fileStats.size,
                                url: `/uploads/attachments/${fileName}`,
                                download_url: `/api/download/${fileName}`,
                                created_at: new Date().toISOString()
                            });
                        } catch (err) {
                            console.error('첨부파일 다운로드 실패:', err);
                            // 다운로드 실패 시 원본 정보 유지
                            maxAttachmentId++;
                            parsedAttachments.push({
                                id: maxAttachmentId,
                                name: attachment.name || 'unknown',
                                size: attachment.size || 0,
                                url: attachment.url,
                                download_url: attachment.download_url || attachment.url,
                                created_at: new Date().toISOString()
                            });
                        }
                    } else if (attachment.url) {
                        // 이미 로컬 파일인 경우
                        maxAttachmentId++;
                        parsedAttachments.push({
                            id: maxAttachmentId,
                            name: attachment.name || 'file',
                            size: attachment.size || 0,
                            url: attachment.url,
                            download_url: attachment.download_url || attachment.url,
                            created_at: new Date().toISOString()
                        });
                    }
                }
            } catch (e) {
                console.error('attachments 파싱 실패:', e);
            }
        }

        // thumbnail 처리
        let localThumbnail = thumbnail || '';

        // 1. req.files에서 thumbnail 필드로 업로드된 파일 찾기
        if (req.files && req.files['thumbnail'] && req.files['thumbnail'].length > 0) {
            const thumbnailFile = req.files['thumbnail'][0];
            // 업로드된 파일을 thumbnails 폴더로 이동
            const safeFileName = generateSafeFileName(thumbnailFile.originalname);
            const thumbnailPath = path.join(THUMBNAILS_DIR, safeFileName);
            fsSync.renameSync(thumbnailFile.path, thumbnailPath);
            localThumbnail = `/uploads/thumbnails/${safeFileName}`;
        }

        // 2. thumbnail이 외부 URL인 경우 다운로드
        if (!localThumbnail && thumbnail && thumbnail.startsWith('http')) {
            try {
                const fileName = generateFileName(thumbnail);
                const localPath = path.join(THUMBNAILS_DIR, fileName);
                await downloadFile(thumbnail, localPath);
                localThumbnail = `/uploads/thumbnails/${fileName}`;
            } catch (err) {
                console.error('썸네일 다운로드 실패:', err);
                localThumbnail = thumbnail; // 실패 시 원본 URL 유지
            }
        }

        const newPost = {
            id: newId,
            title,
            content,
            author_name,
            author_id,
            company_name,
            company_no,
            created_at: now,
            updated_at: now,
            view_count: 0,
            comment_count: 0,
            like_count: 0,
            board_type,
            tag: tag || "[]",
            attachments: parsedAttachments,
            comments: [],
            is_public: is_public === "false" ? false : true,
            is_deleted: false,
            thumbnail: localThumbnail // 모든 게시글 타입에 thumbnail 추가
        };

        // policy 게시판의 경우 추가 필드
        if (board_type === 'health-policy') {
            newPost.category_code = category_code || '';
            newPost.category_name = category_name || '';
        }

        boardData[newId] = newPost;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.status(201).json({
            success: true,
            message: '게시글이 생성되었습니다.',
            data: newPost
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 생성 실패',
            error: error.message
        });
    }
});

// 4. 게시글 수정 (PUT /api/board/:id) - 사용자도 수정 가능
app.put('/api/board/:id', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, board_type, content, tag, company_name, company_no, category_code, category_name, thumbnail, attachments } = req.body;

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const now = new Date().toISOString(); // 날짜 + 시간 포함

        // 수정
        if (title) post.title = title;
        if (board_type) post.board_type = board_type;
        if (content) post.content = content;
        if (tag) post.tag = tag;
        if (company_name !== undefined) post.company_name = company_name;
        if (company_no !== undefined) post.company_no = company_no;
        if (category_code !== undefined) post.category_code = category_code;
        if (category_name !== undefined) post.category_name = category_name;

        // thumbnail 처리
        // 1. req.files에서 thumbnail 필드로 업로드된 파일 처리
        if (req.files && req.files['thumbnail'] && req.files['thumbnail'].length > 0) {
            const thumbnailFile = req.files['thumbnail'][0];
            // 업로드된 파일을 thumbnails 폴더로 이동
            const safeFileName = generateSafeFileName(thumbnailFile.originalname);
            const thumbnailPath = path.join(THUMBNAILS_DIR, safeFileName);
            fsSync.renameSync(thumbnailFile.path, thumbnailPath);
            post.thumbnail = `/uploads/thumbnails/${safeFileName}`;
        }
        // 2. thumbnail이 외부 URL인 경우 다운로드
        else if (thumbnail !== undefined) {
            if (thumbnail && thumbnail.startsWith('http')) {
                try {
                    const fileName = generateFileName(thumbnail);
                    const localPath = path.join(THUMBNAILS_DIR, fileName);
                    await downloadFile(thumbnail, localPath);
                    post.thumbnail = `/uploads/thumbnails/${fileName}`;
                } catch (err) {
                    console.error('썸네일 다운로드 실패:', err);
                    post.thumbnail = thumbnail; // 실패 시 원본 URL 유지
                }
            } else {
                post.thumbnail = thumbnail;
            }
        }

        // attachments 처리
        // 1. req.files에서 attachments 필드로 업로드된 파일 처리
        let uploadedAttachments = [];
        if (req.files && req.files['attachments']) {
            // 기존 첨부파일의 최대 ID 찾기
            let maxAttachmentId = 0;
            if (post.attachments && post.attachments.length > 0) {
                maxAttachmentId = Math.max(...post.attachments.map(att => att.id || 0));
            }

            for (const file of req.files['attachments']) {
                maxAttachmentId++;
                uploadedAttachments.push({
                    id: maxAttachmentId,
                    name: file.originalname,
                    size: file.size,
                    url: `/uploads/attachments/${file.filename}`,
                    download_url: `/api/download/${file.filename}`,
                    created_at: new Date().toISOString()
                });
            }
        }

        // 2. attachments 파라미터로 전달된 데이터 처리 (외부 URL 다운로드)
        if (attachments !== undefined) {
            try {
                const attachmentsArray = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
                const downloadedAttachments = [];

                for (const attachment of attachmentsArray) {
                    if (attachment.url && attachment.url.startsWith('http') && !attachment.url.includes('localhost')) {
                        try {
                            const fileName = generateFileName(attachment.url);
                            const localPath = path.join(ATTACHMENTS_DIR, fileName);
                            await downloadFile(attachment.url, localPath);

                            downloadedAttachments.push({
                                ...attachment,
                                original_url: attachment.url,
                                local_path: `/uploads/attachments/${fileName}`,
                                url: `/uploads/attachments/${fileName}`,
                                download_url: `/api/download/${fileName}`
                            });
                        } catch (err) {
                            console.error('첨부파일 다운로드 실패:', err);
                            downloadedAttachments.push(attachment);
                        }
                    } else if (attachment.url) {
                        // 로컬 파일인 경우 파일 존재 여부 확인
                        const fileName = attachment.url.split('/').pop();
                        const localPath = path.join(ATTACHMENTS_DIR, fileName);

                        if (fsSync.existsSync(localPath)) {
                            // 파일이 존재하면 리스트에 추가
                            downloadedAttachments.push(attachment);
                        } else {
                            console.log(`파일이 존재하지 않아 제거됨: ${fileName}`);
                            // 파일이 없으면 리스트에 추가하지 않음 (자동 제거)
                        }
                    } else {
                        downloadedAttachments.push(attachment);
                    }
                }

                // 업로드된 파일과 기존/다운로드된 파일 병합
                post.attachments = [...uploadedAttachments, ...downloadedAttachments];
            } catch (e) {
                // 파싱 실패 시 업로드된 파일만 추가
                post.attachments = uploadedAttachments.length > 0 ? uploadedAttachments : post.attachments;
            }
        } else if (uploadedAttachments.length > 0) {
            // attachments 파라미터 없고 업로드된 파일만 있는 경우
            post.attachments = [...(post.attachments || []), ...uploadedAttachments];
        }

        // attachments가 업데이트되지 않은 경우에도 기존 파일 존재 여부 확인
        if (attachments === undefined && uploadedAttachments.length === 0 && post.attachments && post.attachments.length > 0) {
            const validAttachments = [];
            for (const attachment of post.attachments) {
                if (attachment.url) {
                    const fileName = attachment.url.split('/').pop();
                    const localPath = path.join(ATTACHMENTS_DIR, fileName);

                    if (fsSync.existsSync(localPath)) {
                        validAttachments.push(attachment);
                    } else {
                        console.log(`파일이 존재하지 않아 제거됨: ${fileName}`);
                    }
                }
            }
            post.attachments = validAttachments;
        }

        post.updated_at = now;

        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        // 현재 요청의 도메인 정보 생성
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // 응답용 post 복사본 생성
        const responsePost = { ...post };

        // thumbnail URL에 도메인 추가
        if (responsePost.thumbnail && responsePost.thumbnail.startsWith('/')) {
            responsePost.thumbnail = `${baseUrl}${responsePost.thumbnail}`;
        }

        // attachments URL에 도메인 추가
        if (responsePost.attachments && responsePost.attachments.length > 0) {
            responsePost.attachments = responsePost.attachments.map(att => ({
                ...att,
                url: att.url && att.url.startsWith('/') ? `${baseUrl}${att.url}` : att.url,
                download_url: att.download_url && att.download_url.startsWith('/') ? `${baseUrl}${att.download_url}` : att.download_url
            }));
        }

        res.json({
            success: true,
            message: '게시글이 수정되었습니다.',
            data: responsePost
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 수정 실패',
            error: error.message
        });
    }
});

// 5. 게시글 삭제 (DELETE /api/admin/board/:id) - admin만 삭제 가능 (논리 삭제)
app.delete('/api/board/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { permanent } = req.query; // ?permanent=true 시 물리 삭제

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        if (permanent === 'true') {
            // 물리 삭제
            delete boardData[id];
        } else {
            // 논리 삭제
            post.is_deleted = true;
            post.updated_at = new Date().toISOString(); // 날짜 + 시간 포함
            boardData[id] = post;
        }

        await writeJsonFile(BOARD_DATA_FILE, boardData);

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

// 4. 게시글 수정 (PUT /api/admin/board/:id) - admin만 수정 가능
app.put('/api/admin/board/:id', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, board_type, content, tag, company_name, company_no, category_code, category_name, thumbnail, attachments } = req.body;

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const now = new Date().toISOString(); // 날짜 + 시간 포함

        // 수정
        if (title) post.title = title;
        if (board_type) post.board_type = board_type;
        if (content) post.content = content;
        if (tag) post.tag = tag;
        if (company_name !== undefined) post.company_name = company_name;
        if (company_no !== undefined) post.company_no = company_no;
        if (category_code !== undefined) post.category_code = category_code;
        if (category_name !== undefined) post.category_name = category_name;

        // thumbnail 처리
        // 1. req.files에서 thumbnail 필드로 업로드된 파일 처리
        if (req.files && req.files['thumbnail'] && req.files['thumbnail'].length > 0) {
            const thumbnailFile = req.files['thumbnail'][0];
            // 업로드된 파일을 thumbnails 폴더로 이동
            const safeFileName = generateSafeFileName(thumbnailFile.originalname);
            const thumbnailPath = path.join(THUMBNAILS_DIR, safeFileName);
            fsSync.renameSync(thumbnailFile.path, thumbnailPath);
            post.thumbnail = `/uploads/thumbnails/${safeFileName}`;
        }
        // 2. thumbnail이 외부 URL인 경우 다운로드
        else if (thumbnail !== undefined) {
            if (thumbnail && thumbnail.startsWith('http')) {
                try {
                    const fileName = generateFileName(thumbnail);
                    const localPath = path.join(THUMBNAILS_DIR, fileName);
                    await downloadFile(thumbnail, localPath);
                    post.thumbnail = `/uploads/thumbnails/${fileName}`;
                } catch (err) {
                    console.error('썸네일 다운로드 실패:', err);
                    post.thumbnail = thumbnail; // 실패 시 원본 URL 유지
                }
            } else {
                post.thumbnail = thumbnail;
            }
        }

        // attachments 처리
        // 1. req.files에서 attachments 필드로 업로드된 파일 처리
        let uploadedAttachments = [];
        if (req.files && req.files['attachments']) {
            // 기존 첨부파일의 최대 ID 찾기
            let maxAttachmentId = 0;
            if (post.attachments && post.attachments.length > 0) {
                maxAttachmentId = Math.max(...post.attachments.map(att => att.id || 0));
            }

            for (const file of req.files['attachments']) {
                maxAttachmentId++;
                uploadedAttachments.push({
                    id: maxAttachmentId,
                    name: file.originalname,
                    size: file.size,
                    url: `/uploads/attachments/${file.filename}`,
                    download_url: `/api/download/${file.filename}`,
                    created_at: new Date().toISOString()
                });
            }
        }

        // 2. attachments 파라미터로 전달된 데이터 처리 (외부 URL 다운로드)
        if (attachments !== undefined) {
            try {
                const attachmentsArray = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
                const downloadedAttachments = [];

                for (const attachment of attachmentsArray) {
                    if (attachment.url && attachment.url.startsWith('http') && !attachment.url.includes('localhost')) {
                        try {
                            const fileName = generateFileName(attachment.url);
                            const localPath = path.join(ATTACHMENTS_DIR, fileName);
                            await downloadFile(attachment.url, localPath);

                            downloadedAttachments.push({
                                ...attachment,
                                original_url: attachment.url,
                                local_path: `/uploads/attachments/${fileName}`,
                                url: `/uploads/attachments/${fileName}`,
                                download_url: `/api/download/${fileName}`
                            });
                        } catch (err) {
                            console.error('첨부파일 다운로드 실패:', err);
                            downloadedAttachments.push(attachment);
                        }
                    } else if (attachment.url) {
                        // 로컬 파일인 경우 파일 존재 여부 확인
                        const fileName = attachment.url.split('/').pop();
                        const localPath = path.join(ATTACHMENTS_DIR, fileName);

                        if (fsSync.existsSync(localPath)) {
                            // 파일이 존재하면 리스트에 추가
                            downloadedAttachments.push(attachment);
                        } else {
                            console.log(`파일이 존재하지 않아 제거됨: ${fileName}`);
                            // 파일이 없으면 리스트에 추가하지 않음 (자동 제거)
                        }
                    } else {
                        downloadedAttachments.push(attachment);
                    }
                }

                // 업로드된 파일과 기존/다운로드된 파일 병합
                post.attachments = [...uploadedAttachments, ...downloadedAttachments];
            } catch (e) {
                // 파싱 실패 시 업로드된 파일만 추가
                post.attachments = uploadedAttachments.length > 0 ? uploadedAttachments : post.attachments;
            }
        } else if (uploadedAttachments.length > 0) {
            // attachments 파라미터 없고 업로드된 파일만 있는 경우
            post.attachments = [...(post.attachments || []), ...uploadedAttachments];
        }

        // attachments가 업데이트되지 않은 경우에도 기존 파일 존재 여부 확인
        if (attachments === undefined && uploadedAttachments.length === 0 && post.attachments && post.attachments.length > 0) {
            const validAttachments = [];
            for (const attachment of post.attachments) {
                if (attachment.url) {
                    const fileName = attachment.url.split('/').pop();
                    const localPath = path.join(ATTACHMENTS_DIR, fileName);

                    if (fsSync.existsSync(localPath)) {
                        validAttachments.push(attachment);
                    } else {
                        console.log(`파일이 존재하지 않아 제거됨: ${fileName}`);
                    }
                }
            }
            post.attachments = validAttachments;
        }

        post.updated_at = now;

        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        // 현재 요청의 도메인 정보 생성
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // 응답용 post 복사본 생성
        const responsePost = { ...post };

        // thumbnail URL에 도메인 추가
        if (responsePost.thumbnail && responsePost.thumbnail.startsWith('/')) {
            responsePost.thumbnail = `${baseUrl}${responsePost.thumbnail}`;
        }

        // attachments URL에 도메인 추가
        if (responsePost.attachments && responsePost.attachments.length > 0) {
            responsePost.attachments = responsePost.attachments.map(att => ({
                ...att,
                url: att.url && att.url.startsWith('/') ? `${baseUrl}${att.url}` : att.url,
                download_url: att.download_url && att.download_url.startsWith('/') ? `${baseUrl}${att.download_url}` : att.download_url
            }));
        }

        res.json({
            success: true,
            message: '게시글이 수정되었습니다.',
            data: responsePost
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 수정 실패',
            error: error.message
        });
    }
});

// 5. 게시글 삭제 (DELETE /api/admin/board/:id) - admin만 삭제 가능 (논리 삭제)
app.delete('/api/admin/board/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { permanent } = req.query; // ?permanent=true 시 물리 삭제

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        if (permanent === 'true') {
            // 물리 삭제
            delete boardData[id];
        } else {
            // 논리 삭제
            post.is_deleted = true;
            post.updated_at = new Date().toISOString(); // 날짜 + 시간 포함
            boardData[id] = post;
        }

        await writeJsonFile(BOARD_DATA_FILE, boardData);

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

// 5-1. 게시글 공개 설정 (PATCH /api/admin/board/:id/public) - admin만 가능
app.patch('/api/admin/board/:id/public', async (req, res) => {
    try {
        const { id } = req.params;

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        post.is_public = true;
        post.updated_at = new Date().toISOString(); // 날짜 + 시간 포함
        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.json({
            success: true,
            message: '게시글이 공개되었습니다.',
            data: post
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 공개 설정 실패',
            error: error.message
        });
    }
});

// 5-2. 게시글 비공개 설정 (PATCH /api/admin/board/:id/private) - admin만 가능
app.patch('/api/admin/board/:id/private', async (req, res) => {
    try {
        const { id } = req.params;

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        post.is_public = false;
        post.updated_at = new Date().toISOString(); // 날짜 + 시간 포함
        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.json({
            success: true,
            message: '게시글이 비공개되었습니다.',
            data: post
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 비공개 설정 실패',
            error: error.message
        });
    }
});

// 5-3. 게시글 삭제 처리 (PATCH /api/admin/board/:id/deleted) - admin만 가능
app.patch('/api/admin/board/:id/deleted', async (req, res) => {
    try {
        const { id } = req.params;

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        post.is_deleted = true;
        post.updated_at = new Date().toISOString(); // 날짜 + 시간 포함
        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.json({
            success: true,
            message: '게시글이 삭제되었습니다.',
            data: post
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 삭제 처리 실패',
            error: error.message
        });
    }
});

// 5-4. 게시글 복구 (PATCH /api/admin/board/:id/restore) - admin만 가능
app.patch('/api/admin/board/:id/restore', async (req, res) => {
    try {
        const { id } = req.params;

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        post.is_deleted = false;
        post.updated_at = new Date().toISOString(); // 날짜 + 시간 포함
        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.json({
            success: true,
            message: '게시글이 복구되었습니다.',
            data: post
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '게시글 복구 실패',
            error: error.message
        });
    }
});

// 6. 댓글 추가 (POST /api/board/comments)
app.post('/api/board/comments', async (req, res) => {
    try {
        const { post_id, author_id, author_name, content } = req.body;

        if (!post_id || !author_id || !author_name || !content) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요. (post_id, author_id, author_name, content)'
            });
        }

        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[post_id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // 새 댓글 ID 생성 (전체 댓글 중 최대값)
        let maxCommentId = 0;
        Object.values(boardData).forEach(p => {
            if (p.comments && p.comments.length > 0) {
                const maxInPost = Math.max(...p.comments.map(c => c.id));
                if (maxInPost > maxCommentId) maxCommentId = maxInPost;
            }
        });
        const newCommentId = maxCommentId + 1;

        // created_at 생성
        const now = new Date();
        const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newComment = {
            id: newCommentId,
            post_id: parseInt(post_id),
            author_id,
            author_name,
            content,
            created_at: createdAt,
            is_deleted: false
        };

        post.comments.push(newComment);
        post.comment_count = post.comments.filter(c => !c.is_deleted).length;
        boardData[post_id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

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
    }
});

// 7. 댓글 수정 (PUT /api/board/comments/:commentId)
app.put('/api/board/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: '댓글 내용을 입력해주세요.'
            });
        }

        const boardData = await readJsonFile(BOARD_DATA_FILE);

        // 모든 게시글에서 해당 댓글 찾기
        let foundPost = null;
        let commentIndex = -1;

        for (const [postId, post] of Object.entries(boardData)) {
            const idx = post.comments.findIndex(c => c.id === parseInt(commentId));
            if (idx !== -1) {
                foundPost = post;
                commentIndex = idx;
                break;
            }
        }

        if (!foundPost || commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다.'
            });
        }

        foundPost.comments[commentIndex].content = content;
        boardData[foundPost.id] = foundPost;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.json({
            success: true,
            message: '댓글이 수정되었습니다.',
            data: foundPost.comments[commentIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '댓글 수정 실패',
            error: error.message
        });
    }
});

// 8. 댓글 삭제 (DELETE /api/board/comments/:commentId)
app.delete('/api/board/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { permanent } = req.query; // ?permanent=true 시 물리 삭제

        const boardData = await readJsonFile(BOARD_DATA_FILE);

        // 모든 게시글에서 해당 댓글 찾기
        let foundPost = null;
        let commentIndex = -1;

        for (const [postId, post] of Object.entries(boardData)) {
            const idx = post.comments.findIndex(c => c.id === parseInt(commentId));
            if (idx !== -1) {
                foundPost = post;
                commentIndex = idx;
                break;
            }
        }

        if (!foundPost || commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다.'
            });
        }

        if (permanent === 'true') {
            // 물리 삭제
            foundPost.comments.splice(commentIndex, 1);
        } else {
            // 논리 삭제
            foundPost.comments[commentIndex].is_deleted = true;
        }

        foundPost.comment_count = foundPost.comments.filter(c => !c.is_deleted).length;
        boardData[foundPost.id] = foundPost;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

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

// 8-1. 댓글 삭제 상태 설정 (PATCH /api/board/comments/:commentId/deleted)
app.patch('/api/board/comments/:commentId/deleted', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { is_deleted } = req.body;

        if (is_deleted === undefined) {
            return res.status(400).json({
                success: false,
                message: 'is_deleted 값을 입력해주세요. (true 또는 false)'
            });
        }

        const boardData = await readJsonFile(BOARD_DATA_FILE);

        // 모든 게시글에서 해당 댓글 찾기
        let foundPost = null;
        let commentIndex = -1;

        for (const [postId, post] of Object.entries(boardData)) {
            const idx = post.comments.findIndex(c => c.id === parseInt(commentId));
            if (idx !== -1) {
                foundPost = post;
                commentIndex = idx;
                break;
            }
        }

        if (!foundPost || commentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다.'
            });
        }

        foundPost.comments[commentIndex].is_deleted = is_deleted;
        foundPost.comment_count = foundPost.comments.filter(c => !c.is_deleted).length;
        boardData[foundPost.id] = foundPost;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.json({
            success: true,
            message: `댓글이 ${is_deleted ? '삭제' : '복구'}되었습니다.`,
            data: foundPost.comments[commentIndex]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '댓글 삭제 상태 설정 실패',
            error: error.message
        });
    }
});

// 8-2. 건강게시판 읽지 않은 게시글 수 조회 (GET /api/board/health-programs/check)
app.get('/api/board/health-programs/check', async (req, res) => {
    try {
        const boardData = await readJsonFile(BOARD_DATA_FILE);

        // health-programs 타입이고, step이 0인 게시글 개수 카운트
        const unreadCount = Object.values(boardData).filter(post =>
            post.board_type === 'health-programs' &&
            !post.is_deleted &&
            post.step === 0
        ).length;

        res.json({
            success: true,
            data: {
                count: unreadCount
            },
            message: ""
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '읽지 않은 게시글 수 조회 실패',
            error: error.message
        });
    }
});

// 9. 좋아요 증가 (POST /api/board/:id/like)
app.post('/api/board/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        post.like_count = (post.like_count || 0) + 1;
        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.json({
            success: true,
            message: '좋아요가 추가되었습니다.',
            like_count: post.like_count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '좋아요 추가 실패',
            error: error.message
        });
    }
});

// 9-1. 좋아요 감소 (DELETE /api/board/:id/like)
app.delete('/api/board/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const boardData = await readJsonFile(BOARD_DATA_FILE);
        const post = boardData[id];

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        // 좋아요 수가 0보다 클 때만 감소
        if (post.like_count > 0) {
            post.like_count = post.like_count - 1;
        } else {
            post.like_count = 0;
        }

        boardData[id] = post;
        await writeJsonFile(BOARD_DATA_FILE, boardData);

        res.json({
            success: true,
            message: '좋아요가 취소되었습니다.',
            like_count: post.like_count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '좋아요 취소 실패',
            error: error.message
        });
    }
});

// ==================== 파일 업로드/다운로드 ====================

// 10. 파일 업로드 (POST /api/upload)
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: '파일이 존재하지 않습니다.'
            });
        }

        // 클라이언트에게 저장된 파일 정보 전달
        res.json({
            success: true,
            message: '파일 업로드 성공',
            data: {
                fileName: file.filename,
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
                url: `/uploads/attachments/${file.filename}`,
                downloadUrl: `/api/download/${file.filename}`
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '파일 업로드 실패',
            error: error.message
        });
    }
});

// 11. 다중 파일 업로드 (POST /api/upload-multiple)
app.post('/api/upload-multiple', upload.array('files', 10), (req, res) => {
    try {
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '파일이 존재하지 않습니다.'
            });
        }

        const uploadedFiles = files.map(file => ({
            fileName: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            url: `/uploads/attachments/${file.filename}`,
            downloadUrl: `/api/download/${file.filename}`
        }));

        res.json({
            success: true,
            message: `${files.length}개 파일 업로드 성공`,
            data: uploadedFiles
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '파일 업로드 실패',
            error: error.message
        });
    }
});

// 12. 파일 다운로드 (GET /api/download/:fileName)
app.get('/api/download/:fileName', async (req, res) => {
    try {
        const fileName = req.params.fileName;
        const filePath = path.join(ATTACHMENTS_DIR, fileName);

        // 파일 존재 여부 체크
        if (!fsSync.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: '파일을 찾을 수 없습니다.'
            });
        }

        // board-data.json에서 원본 파일명 찾기
        let originalName = fileName;
        try {
            const boardData = await readJsonFile(BOARD_DATA_FILE);
            outerLoop: for (const post of Object.values(boardData)) {
                if (post.attachments && post.attachments.length > 0) {
                    for (const att of post.attachments) {
                        if (att.url && att.url.includes(fileName)) {
                            originalName = att.name || fileName;
                            break outerLoop;
                        }
                    }
                }
            }
        } catch (err) {
            console.error('원본 파일명 찾기 실패:', err);
        }

        // UTF-8 인코딩된 파일명으로 다운로드 (RFC 5987)
        const encodedFileName = encodeURIComponent(originalName);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // 파일 전송
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: '파일 다운로드 중 오류가 발생했습니다.'
                    });
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '파일 다운로드 실패',
            error: error.message
        });
    }
});

// 13. 파일 삭제 (DELETE /api/files/:fileName)
app.delete('/api/files/:fileName', async (req, res) => {
    try {
        const fileName = req.params.fileName;
        const filePath = path.join(ATTACHMENTS_DIR, fileName);

        // 파일 존재 여부 체크
        if (!fsSync.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: '파일을 찾을 수 없습니다.'
            });
        }

        // 파일 삭제
        await fs.unlink(filePath);

        res.json({
            success: true,
            message: '파일이 삭제되었습니다.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '파일 삭제 실패',
            error: error.message
        });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 통합 게시판 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`\n📌 사용 가능한 API 엔드포인트:`);
    console.log(`\n[인증]`);
    console.log(`  GET    /api/auth/current-user              - 현재 사용자 정보 조회`);
    console.log(`\n[게시판] - board_type으로 구분 (health-board, health-policy, etc.)`);
    console.log(`  GET    /api/board                          - 게시글 목록 조회`);
    console.log(`         ?board_type=health-board            - 특정 게시판만`);
    console.log(`         &tag=태그&search=검색어              - 필터링`);
    console.log(`         &page=1&limit=10                    - 페이지네이션`);
    console.log(`  GET    /api/board/:id                      - 게시글 상세 조회`);
    console.log(`  POST   /api/board                          - 게시글 생성`);
    console.log(`  PUT    /api/board/:id                      - 게시글 수정`);
    console.log(`  DELETE /api/board/:id                      - 게시글 삭제 (논리)`);
    console.log(`  DELETE /api/board/:id?permanent=true       - 게시글 삭제 (물리)`);
    console.log(`  PATCH  /api/board/:id/public               - 게시글 공개 설정`);
    console.log(`  PATCH  /api/board/:id/private              - 게시글 비공개 설정`);
    console.log(`  PATCH  /api/board/:id/deleted              - 게시글 삭제 처리`);
    console.log(`  PATCH  /api/board/:id/restore              - 게시글 복구`);
    console.log(`\n[댓글]`);
    console.log(`  POST   /api/board/comments                       - 댓글 추가 (body: post_id, author_id, author_name, content)`);
    console.log(`  PUT    /api/board/comments/:commentId            - 댓글 수정`);
    console.log(`  DELETE /api/board/comments/:commentId            - 댓글 삭제 (논리)`);
    console.log(`  DELETE /api/board/comments/:commentId?permanent=true - 댓글 삭제 (물리)`);
    console.log(`  PATCH  /api/board/comments/:commentId/deleted    - 댓글 삭제 상태 설정`);
    console.log(`\n[좋아요]`);
    console.log(`  POST   /api/board/:id/like                 - 좋아요 증가`);
    console.log(`  DELETE /api/board/:id/like                 - 좋아요 감소`);
    console.log(`\n[파일 업로드/다운로드]`);
    console.log(`  POST   /api/upload                         - 단일 파일 업로드 (input name="file")`);
    console.log(`  POST   /api/upload-multiple                - 다중 파일 업로드 (input name="files", max 10개)`);
    console.log(`  GET    /api/download/:fileName             - 파일 다운로드`);
    console.log(`  DELETE /api/files/:fileName                - 파일 삭제`);
    console.log(`  GET    /uploads/attachments/:fileName      - 파일 직접 접근\n`);
});

module.exports = app;
