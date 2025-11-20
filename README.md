# 건강게시판 더미 서버 (Health Board Dummy Server)

Node.js Express 기반의 건강게시판 CRUD REST API 서버입니다.

## 📦 설치 방법

```bash
# 의존성 패키지 설치
npm install
```

## 🚀 실행 방법

```bash
# 서버 실행
npm start

# 개발 모드 (nodemon 사용)
npm run dev
```

서버는 기본적으로 `http://localhost:3000` 에서 실행됩니다.

## 📡 API 엔드포인트

### 인증 API

#### 현재 사용자 정보 조회
```
GET /auth/current-user
```

**예제:**
```bash
curl http://localhost:8300/auth/current-user
```

### 게시판 API

#### 1. 게시글 목록 조회
```
GET /api/health-board
```

**쿼리 파라미터 (옵션):**
- `tag`: 태그로 필터링 (예: `건강검진`)
- `author`: 작성자로 필터링 (예: `관리자`)
- `search`: 제목/내용 검색

**예제:**
```bash
# 전체 목록 조회
curl http://localhost:3000/api/health-board

# 태그로 필터링
curl http://localhost:3000/api/health-board?tag=건강검진

# 작성자로 필터링
curl http://localhost:3000/api/health-board?author=관리자
```

### 2. 게시글 상세 조회
```
GET /api/health-board/:id
```

**예제:**
```bash
curl http://localhost:3000/api/health-board/1
```

### 3. 게시글 생성
```
POST /api/health-board
```

**Body 파라미터:**
- `title` (필수): 제목
- `content` (필수): 내용
- `author` (필수): 작성자
- `tags` (옵션): 태그 배열

**예제:**
```bash
curl -X POST http://localhost:3000/api/health-board \
  -H "Content-Type: application/json" \
  -d '{
    "title": "새로운 건강 정보",
    "content": "<p>건강한 생활 습관을 소개합니다.</p>",
    "author": "홍길동",
    "tags": ["건강", "생활습관"]
  }'
```

### 4. 게시글 수정
```
PUT /api/health-board/:id
```

**Body 파라미터 (모두 옵션):**
- `title`: 제목
- `content`: 내용
- `tags`: 태그 배열

**예제:**
```bash
curl -X PUT http://localhost:3000/api/health-board/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "수정된 제목",
    "content": "<p>수정된 내용입니다.</p>"
  }'
```

### 5. 게시글 삭제
```
DELETE /api/health-board/:id
```

**예제:**
```bash
curl -X DELETE http://localhost:3000/api/health-board/1
```

### 6. 댓글 추가
```
POST /api/health-board/:id/comments
```

**Body 파라미터:**
- `userId` (필수): 사용자 ID
- `userName` (필수): 사용자 이름
- `companyName` (옵션): 회사명
- `content` (필수): 댓글 내용

**예제:**
```bash
curl -X POST http://localhost:3000/api/health-board/1/comments \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "userName": "김철수",
    "companyName": "대웅제약",
    "content": "유익한 정보 감사합니다!"
  }'
```

### 7. 좋아요 증가
```
POST /api/health-board/:id/like
```

**예제:**
```bash
curl -X POST http://localhost:8300/api/health/board/1/like
```

### 정책 API

#### 1. 정책 목록 조회
```
GET /api/health/policy
```

**쿼리 파라미터 (옵션):**
- `categoryCode`: 카테고리 코드로 필터링 (예: `PHYSICAL`, `MENTAL`, `WELFARE`)
- `categoryName`: 카테고리 이름으로 필터링
- `tag`: 태그로 필터링
- `search`: 제목/내용 검색
- `isVisible`: 공개 여부 필터링 (기본값: true, 비공개 포함 시 false)

**예제:**
```bash
# 전체 목록 조회
curl http://localhost:8300/api/health/policy

# 카테고리로 필터링
curl http://localhost:8300/api/health/policy?categoryCode=PHYSICAL

# 태그로 필터링
curl http://localhost:8300/api/health/policy?tag=신체건강

# 비공개 정책 포함 조회
curl http://localhost:8300/api/health/policy?isVisible=false
```

#### 2. 정책 상세 조회
```
GET /api/health/policy/:id
```

**예제:**
```bash
curl http://localhost:8300/api/health/policy/2263
```

#### 3. 정책 생성
```
POST /api/health/policy
```

**Body 파라미터:**
- `title` (필수): 제목
- `content` (필수): 내용
- `author` (필수): 작성자
- `categoryCode` (옵션): 카테고리 코드
- `categoryName` (옵션): 카테고리 이름
- `tags` (옵션): 태그 배열
- `thumbnail` (옵션): 썸네일 URL

**예제:**
```bash
curl -X POST http://localhost:8300/api/health/policy \
  -H "Content-Type: application/json" \
  -d '{
    "title": "새로운 건강 정책",
    "content": "정책 내용입니다.",
    "author": "관리자",
    "categoryCode": "PHYSICAL",
    "categoryName": "신체건강",
    "tags": ["건강", "정책"],
    "thumbnail": "/img/policy.jpg"
  }'
```

#### 4. 정책 수정
```
PUT /api/health/policy/:id
```

**예제:**
```bash
curl -X PUT http://localhost:8300/api/health/policy/2263 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "수정된 제목",
    "content": "수정된 내용"
  }'
```

#### 5. 정책 삭제
```
DELETE /api/health/policy/:id
```

**예제:**
```bash
curl -X DELETE http://localhost:8300/api/health/policy/2263
```

#### 6. 정책 좋아요 증가
```
POST /api/health/policy/:id/like
```

**예제:**
```bash
curl -X POST http://localhost:8300/api/health/policy/2263/like
```

## 💻 Axios 사용 예제

프로젝트에 포함된 `api-client.js` 파일을 사용하여 API를 테스트할 수 있습니다.

### 테스트 실행
```bash
# 서버를 먼저 실행한 후
npm start

# 다른 터미널에서 API 테스트 실행
node api-client.js
```

### 코드에서 사용하기

#### 인증 API
```javascript
const { getCurrentUser } = require('./api-client');

// 현재 사용자 정보 조회
const user = await getCurrentUser();
```

#### 게시판 API
```javascript
const {
  getHealthBoardList,
  getHealthBoardDetail,
  createHealthBoard,
  updateHealthBoard,
  deleteHealthBoard,
  addComment,
  addLike
} = require('./api-client');

// 게시글 목록 조회
const list = await getHealthBoardList();

// 특정 태그로 필터링
const filtered = await getHealthBoardList({ tag: '건강검진' });

// 게시글 상세 조회
const detail = await getHealthBoardDetail(1);

// 게시글 생성
const newPost = await createHealthBoard({
  title: '새 게시글',
  content: '<p>내용</p>',
  author: '작성자',
  tags: ['태그1', '태그2']
});

// 게시글 수정
await updateHealthBoard(1, {
  title: '수정된 제목'
});

// 댓글 추가
await addComment(1, {
  userId: 'user123',
  userName: '홍길동',
  content: '댓글 내용'
});

// 좋아요 추가
await addLike(1);

// 게시글 삭제
await deleteHealthBoard(1);
```

#### 정책 API
```javascript
const {
  getHealthPolicyList,
  getHealthPolicyDetail,
  createHealthPolicy,
  updateHealthPolicy,
  deleteHealthPolicy,
  addPolicyLike
} = require('./api-client');

// 정책 목록 조회
const policyList = await getHealthPolicyList();

// 카테고리로 필터링
const physicalPolicies = await getHealthPolicyList({ categoryCode: 'PHYSICAL' });

// 정책 상세 조회
const policyDetail = await getHealthPolicyDetail(2263);

// 정책 생성
const newPolicy = await createHealthPolicy({
  title: '새 정책',
  content: '정책 내용',
  author: '관리자',
  categoryCode: 'PHYSICAL',
  categoryName: '신체건강',
  tags: ['건강', '정책']
});

// 정책 수정
await updateHealthPolicy(2263, {
  title: '수정된 정책'
});

// 정책 좋아요
await addPolicyLike(2263);

// 정책 삭제
await deleteHealthPolicy(2263);

// === 편의 함수 사용 ===

// 인기 정책 TOP 5
const popularPolicies = await getPopularPolicies(5);

// 최신 정책 TOP 5
const latestPolicies = await getLatestPolicies(5);

// 카테고리별 정책 조회
const physicalPolicies = await getPoliciesByCategory.physical();
const mentalPolicies = await getPoliciesByCategory.mental();
const welfarePolicies = await getPoliciesByCategory.welfare();

// 태그로 정책 검색
const stressPolicies = await getPoliciesByTag('스트레스관리');

// 키워드로 정책 검색
const searchResults = await searchPolicies('운동');
```

## 📂 프로젝트 구조

```
bizcare-dummy-server/
├── server.js                          # Express 서버 메인 파일
├── api-client.js                      # Axios API 클라이언트 (리팩토링됨)
├── package.json                       # 프로젝트 설정 및 의존성
├── health-board-dummy.json            # 게시글 목록 데이터
├── health-board-detail-dummy.json     # 게시글 상세 데이터
├── policy-list.json                   # 정책 목록 데이터
└── README.md                          # 프로젝트 문서
```

## 🛠 기술 스택

- **Node.js**: JavaScript 런타임
- **Express**: 웹 프레임워크
- **Axios**: HTTP 클라이언트
- **Multer**: Multipart/form-data 처리
- **CORS**: Cross-Origin Resource Sharing
- **Body-Parser**: JSON 파싱

## 🎯 주요 기능

- ✅ **확장 가능한 구조**: 팩토리 패턴을 사용한 CRUD 작업 생성
- ✅ **다중 리소스 지원**: 게시판, 정책 등 여러 리소스 관리
- ✅ **Multipart 지원**: 파일 업로드 가능한 요청 처리
- ✅ **필터링 기능**: 카테고리, 태그, 검색어, 공개여부로 데이터 필터링
- ✅ **조회수 추적**: 자동 조회수 증가
- ✅ **좋아요/댓글**: 소셜 기능 지원
- ✅ **편의 함수**: 인기 정책, 최신 정책, 카테고리별 조회 등

## 📝 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": { ... },
  "message": "메시지"
}
```

### 오류 응답
```json
{
  "success": false,
  "message": "오류 메시지",
  "error": "상세 오류 정보"
}
```

## 🔧 데이터 저장

모든 데이터는 JSON 파일에 저장됩니다:
- `health-board-dummy.json`: 게시글 목록
- `health-board-detail-dummy.json`: 게시글 상세 정보
- `policy-list.json`: 정책 목록

변경사항은 실시간으로 JSON 파일에 반영됩니다.

## 🔄 API 클라이언트 구조

리팩토링된 `api-client.js`는 확장 가능한 구조로 설계되었습니다:

```javascript
// 팩토리 패턴으로 CRUD 작업 생성
const createCrudOperations = (apiInstance, resourceName) => {
  return {
    getList, getDetail, create, update, delete, like
  };
};

// 각 리소스별 인스턴스
const boardApi = createApiInstance('/api/health/board');
const policyApi = createApiInstance('/api/health/policy');

// 자동 생성된 CRUD 작업
const boardOperations = createCrudOperations(boardApi, '게시글');
const policyOperations = createCrudOperations(policyApi, '정책');
```

**새로운 리소스 추가 방법:**
1. JSON 데이터 파일 생성
2. `server.js`에 엔드포인트 추가
3. `api-client.js`에 인스턴스 생성
4. `createCrudOperations` 호출로 함수 자동 생성

## 📋 정책 데이터 구조

`policy-list.json`의 각 정책 항목은 다음 필드를 포함합니다:

```javascript
{
  "id": 2263,                          // 고유 ID
  "title": "건강한 식습관...",          // 제목
  "content": "건강한 식단은...",        // 내용
  "author": "관리자",                   // 작성자
  "createDate": "2025-11-11",          // 작성일
  "viewCount": 1250,                   // 조회수
  "commentCount": 0,                   // 댓글 수
  "likeCount": 322,                    // 좋아요 수
  "categoryCode": "PHYSICAL",          // 카테고리 코드
  "categoryName": "신체건강",           // 카테고리 이름
  "tags": ["신체건강", "영양"],         // 태그 배열
  "isVisible": true,                   // 공개 여부
  "thumbnail": "/img/main_bnr1.jpg"    // 썸네일 URL
}
```

**카테고리 코드:**
- `PHYSICAL`: 신체건강
- `MENTAL`: 마음건강
- `WELFARE`: 복리후생

## 📌 주의사항

- 이 서버는 개발/테스트 목적으로 만들어졌습니다.
- 프로덕션 환경에서는 적절한 데이터베이스와 보안 설정이 필요합니다.
- 데이터는 JSON 파일에 저장되므로 서버를 재시작해도 유지됩니다.

## 🤝 기여

버그 리포트나 기능 제안은 이슈로 등록해주세요.

## 📄 라이선스

MIT
