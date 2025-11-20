const axios = require('axios');

// API 베이스 URL
const BASE_URL = 'http://localhost:8300';

// ==================== Axios 인스턴스 생성 ====================

// 공통 Axios 인스턴스
const createApiInstance = (endpoint) => {
    return axios.create({
        baseURL: `${BASE_URL}${endpoint}`,
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

// 각 엔드포인트별 인스턴스
const boardApi = createApiInstance('/api/health/board');
const policyApi = createApiInstance('/api/health/policy');
const authApi = createApiInstance('/auth');

// ==================== 공통 API 유틸리티 함수 ====================

/**
 * CRUD 작업을 위한 공통 함수 생성 팩토리
 * @param {Object} apiInstance - Axios 인스턴스
 * @param {String} resourceName - 리소스 이름 (로깅용)
 */
const createCrudOperations = (apiInstance, resourceName) => {
    return {
        // 목록 조회
        getList: async (query = {}) => {
            try {
                console.log(`\n📋 ${resourceName} 목록 조회...`);
                const response = await apiInstance.get('/', { params: query });
                console.log('✅ 성공:', response.data);
                return response.data;
            } catch (error) {
                console.error('❌ 실패:', error.response?.data || error.message);
                throw error;
            }
        },

        // 상세 조회
        getDetail: async (id) => {
            try {
                console.log(`\n📄 ${resourceName} 상세 조회 (ID: ${id})...`);
                const response = await apiInstance.get(`/${id}`);
                console.log('✅ 성공:', response.data);
                return response.data;
            } catch (error) {
                console.error('❌ 실패:', error.response?.data || error.message);
                throw error;
            }
        },

        // 생성
        create: async (data) => {
            try {
                console.log(`\n✍️ ${resourceName} 생성...`);
                const response = await apiInstance.post('/', data);
                console.log('✅ 성공:', response.data);
                return response.data;
            } catch (error) {
                console.error('❌ 실패:', error.response?.data || error.message);
                throw error;
            }
        },

        // 수정
        update: async (id, data) => {
            try {
                console.log(`\n✏️ ${resourceName} 수정 (ID: ${id})...`);
                const response = await apiInstance.put(`/${id}`, data);
                console.log('✅ 성공:', response.data);
                return response.data;
            } catch (error) {
                console.error('❌ 실패:', error.response?.data || error.message);
                throw error;
            }
        },

        // 삭제
        delete: async (id) => {
            try {
                console.log(`\n🗑️ ${resourceName} 삭제 (ID: ${id})...`);
                const response = await apiInstance.delete(`/${id}`);
                console.log('✅ 성공:', response.data);
                return response.data;
            } catch (error) {
                console.error('❌ 실패:', error.response?.data || error.message);
                throw error;
            }
        },

        // 좋아요
        like: async (id) => {
            try {
                console.log(`\n👍 ${resourceName} 좋아요 추가 (ID: ${id})...`);
                const response = await apiInstance.post(`/${id}/like`);
                console.log('✅ 성공:', response.data);
                return response.data;
            } catch (error) {
                console.error('❌ 실패:', error.response?.data || error.message);
                throw error;
            }
        }
    };
};

// ==================== 게시판 API ====================

const boardOperations = createCrudOperations(boardApi, '게시글');

// 게시글 전용 함수들
const getHealthBoardList = boardOperations.getList;
const getHealthBoardDetail = boardOperations.getDetail;
const createHealthBoard = boardOperations.create;
const updateHealthBoard = boardOperations.update;
const deleteHealthBoard = boardOperations.delete;
const addBoardLike = boardOperations.like;

// 댓글 추가 (게시글 전용)
async function addComment(id, commentData) {
    try {
        console.log(`\n💬 댓글 추가 (게시글 ID: ${id})...`);
        const response = await boardApi.post(`/${id}/comments`, commentData);
        console.log('✅ 성공:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ 실패:', error.response?.data || error.message);
        throw error;
    }
}

// ==================== 정책 API ====================

const policyOperations = createCrudOperations(policyApi, '정책');

// 정책 전용 함수들
const getHealthPolicyList = policyOperations.getList;
const getHealthPolicyDetail = policyOperations.getDetail;
const createHealthPolicy = policyOperations.create;
const updateHealthPolicy = policyOperations.update;
const deleteHealthPolicy = policyOperations.delete;
const addPolicyLike = policyOperations.like;

// ==================== 인증 API ====================

async function getCurrentUser() {
    try {
        console.log('\n👤 현재 사용자 정보 조회...');
        const response = await authApi.get('/current-user');
        console.log('✅ 성공:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ 실패:', error.response?.data || error.message);
        throw error;
    }
}

// ==================== API 호출 예제 함수들 (하위 호환성) ====================

// 하위 호환성을 위한 addLike 별칭
const addLike = addBoardLike;

// ==================== 테스트 실행 ====================

async function runBoardTests() {
    console.log('\n� ===== 게시판 API 테스트 =====');

    try {
        // 1. 목록 조회
        await getHealthBoardList();

        // 2. 특정 태그로 필터링
        await getHealthBoardList({ tag: '건강검진' });

        // 3. 상세 조회
        await getHealthBoardDetail(1);

        // 4. 새 게시글 생성
        const newPost = await createHealthBoard({
            title: '테스트 게시글',
            content: '<p>이것은 axios를 이용한 테스트 게시글입니다.</p>',
            author: '테스터',
            tags: ['테스트', '예제']
        });

        const newPostId = newPost.data.no;

        // 5. 게시글 수정
        await updateHealthBoard(newPostId, {
            title: '수정된 테스트 게시글',
            content: '<p>수정된 내용입니다.</p>'
        });

        // 6. 댓글 추가
        await addComment(newPostId, {
            userId: 'testuser',
            userName: '테스트유저',
            companyName: '테스트회사',
            content: '테스트 댓글입니다.'
        });

        // 7. 좋아요 추가
        await addLike(newPostId);

        // 8. 게시글 삭제
        await deleteHealthBoard(newPostId);

        console.log('\n✅ 게시판 테스트 완료!');
    } catch (error) {
        console.error('\n❌ 게시판 테스트 중 오류 발생');
    }
}

async function runPolicyTests() {
    console.log('\n🟢 ===== 정책 API 테스트 =====');

    try {
        // 1. 정책 목록 조회 (공개된 정책만)
        await getHealthPolicyList();

        // 2. 카테고리로 필터링 (신체건강)
        await getHealthPolicyList({ categoryCode: 'PHYSICAL' });

        // 3. 태그로 필터링
        await getHealthPolicyList({ tag: '신체건강' });

        // 4. 카테고리와 검색어 조합
        await getHealthPolicyList({
            categoryCode: 'MENTAL',
            search: '스트레스'
        });

        // 5. 정책 상세 조회
        await getHealthPolicyDetail(2263);

        // 6. 새 정책 생성
        const newPolicy = await createHealthPolicy({
            title: '테스트 정책 - 건강한 아침 식사의 중요성',
            content: '아침 식사는 하루를 시작하는 가장 중요한 식사입니다. 균형잡힌 영양소 섭취로 활력찬 하루를 시작하세요.',
            author: '테스터',
            categoryCode: 'PHYSICAL',
            categoryName: '신체건강',
            tags: ['신체건강', '영양', '식습관', '테스트'],
            thumbnail: '/img/test_breakfast.jpg'
        });

        const newPolicyId = newPolicy.data.id;
        console.log(`\n📝 생성된 정책 ID: ${newPolicyId}`);

        // 7. 정책 수정
        await updateHealthPolicy(newPolicyId, {
            title: '수정됨 - 건강한 아침 식사 가이드',
            content: '수정된 내용: 전문가가 추천하는 아침 식사 메뉴와 시간대별 영양 섭취 팁을 소개합니다.',
            tags: ['신체건강', '영양', '식습관', '아침식사', '테스트']
        });

        // 8. 정책 좋아요 추가
        await addPolicyLike(newPolicyId);

        // 9. 정책 삭제
        await deleteHealthPolicy(newPolicyId);

        // 10. 편의 함수 테스트
        console.log('\n📊 편의 함수 테스트 시작...');

        // 인기 정책 TOP 3
        await getPopularPolicies(3);

        // 최신 정책 TOP 3
        await getLatestPolicies(3);

        // 신체건강 카테고리 정책
        await getPoliciesByCategory.physical();

        // 마음건강 카테고리 정책
        await getPoliciesByCategory.mental();

        // 태그로 검색
        await getPoliciesByTag('스트레스관리');

        // 키워드로 검색
        await searchPolicies('건강');

        console.log('\n✅ 정책 테스트 완료!');
    } catch (error) {
        console.error('\n❌ 정책 테스트 중 오류 발생');
    }
}

async function runAuthTests() {
    console.log('\n🟡 ===== 인증 API 테스트 =====');

    try {
        // 현재 사용자 정보 조회
        await getCurrentUser();

        console.log('\n✅ 인증 테스트 완료!');
    } catch (error) {
        console.error('\n❌ 인증 테스트 중 오류 발생');
    }
}

async function runTests() {
    console.log('🚀 API 테스트 시작...\n');
    console.log('⚠️  서버가 http://localhost:8300 에서 실행 중인지 확인하세요!\n');

    try {
        await runAuthTests();
        await runBoardTests();
        await runPolicyTests();

        console.log('\n\n🎉 모든 테스트 완료!');
    } catch (error) {
        console.error('\n❌ 테스트 중 오류 발생');
    }
}

// ==================== 편의 함수 (Helper Functions) ====================

/**
 * 카테고리별 정책 조회
 */
const getPoliciesByCategory = {
    physical: () => getHealthPolicyList({ categoryCode: 'PHYSICAL' }),
    mental: () => getHealthPolicyList({ categoryCode: 'MENTAL' }),
    welfare: () => getHealthPolicyList({ categoryCode: 'WELFARE' })
};

/**
 * 인기 정책 조회 (좋아요 수 기준 상위 N개)
 * @param {number} limit - 조회할 개수
 */
async function getPopularPolicies(limit = 5) {
    try {
        console.log(`\n🔥 인기 정책 상위 ${limit}개 조회...`);
        const result = await getHealthPolicyList();
        const sorted = result.data.sort((a, b) => b.likeCount - a.likeCount);
        const popular = sorted.slice(0, limit);

        console.log('✅ 성공:', {
            success: true,
            data: popular,
            total: popular.length
        });

        return {
            success: true,
            data: popular,
            total: popular.length
        };
    } catch (error) {
        console.error('❌ 실패:', error.message);
        throw error;
    }
}

/**
 * 최신 정책 조회 (생성일 기준 상위 N개)
 * @param {number} limit - 조회할 개수
 */
async function getLatestPolicies(limit = 5) {
    try {
        console.log(`\n🆕 최신 정책 ${limit}개 조회...`);
        const result = await getHealthPolicyList();
        const sorted = result.data.sort((a, b) =>
            new Date(b.createDate) - new Date(a.createDate)
        );
        const latest = sorted.slice(0, limit);

        console.log('✅ 성공:', {
            success: true,
            data: latest,
            total: latest.length
        });

        return {
            success: true,
            data: latest,
            total: latest.length
        };
    } catch (error) {
        console.error('❌ 실패:', error.message);
        throw error;
    }
}

/**
 * 특정 태그가 포함된 정책 조회
 * @param {string} tag - 태그명
 */
async function getPoliciesByTag(tag) {
    return getHealthPolicyList({ tag });
}

/**
 * 검색어로 정책 조회
 * @param {string} keyword - 검색 키워드
 */
async function searchPolicies(keyword) {
    return getHealthPolicyList({ search: keyword });
}

// ==================== Export ====================

module.exports = {
    // 인증 API
    getCurrentUser,

    // 게시판 API
    getHealthBoardList,
    getHealthBoardDetail,
    createHealthBoard,
    updateHealthBoard,
    deleteHealthBoard,
    addComment,
    addLike,
    addBoardLike,

    // 정책 API
    getHealthPolicyList,
    getHealthPolicyDetail,
    createHealthPolicy,
    updateHealthPolicy,
    deleteHealthPolicy,
    addPolicyLike,

    // 정책 편의 함수
    getPoliciesByCategory,
    getPopularPolicies,
    getLatestPolicies,
    getPoliciesByTag,
    searchPolicies,

    // API 인스턴스 (고급 사용자용)
    boardApi,
    policyApi,
    authApi
};

// 이 파일을 직접 실행하면 테스트 실행
if (require.main === module) {
    runTests();
}
