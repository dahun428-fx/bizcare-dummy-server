# 건강관리 Dummy Server API 설계서

## 1. 분석 요약

### 1.1 분석한 파일 목록

| 프로젝트 | 파일명 | 용도 |
|----------|--------|------|
| bizcare-adm | `health_care_write.html` | 건강관리 콘텐츠 등록 페이지 |
| bizcare-adm | `health_care_modify.html` | 건강관리 콘텐츠 수정 페이지 |
| bizcare-adm | `health_care_view.html` | 건강관리 콘텐츠 상세 조회 페이지 |
| bizcare-web | `physical.html` | 신체건강 목록 페이지 (React Island) |
| bizcare-web | `physical_view.html` | 신체건강 상세 페이지 (React Island) |
| bizcare-web | `mental.html` | 정신건강 목록 페이지 (React Island) |
| bizcare-web | `mental_view.html` | 정신건강 상세 페이지 (React Island) |

### 1.2 현재 API 호출 패턴 분석

**어드민 페이지 (bizcare-adm)**
- 기본 URL: `EXTERNAL_API_BASE_URL + '/api/v2/adm/board'`
- 등록: `POST /api/v2/adm/board` (FormData)
- 조회: `GET /api/v2/adm/board/{id}`
- 수정: `PUT /api/v2/adm/board/{id}` (FormData)
- 삭제: `DELETE /api/v2/adm/board/{id}`

**사용자 페이지 (bizcare-web)**
- 신체건강 목록: `/api/proxy/physical`
- 정신건강 목록: `/api/proxy/mental`
- 상세 조회: 프로그램 ID 기반 조회

---

## 2. 필요한 API 목록 (총 8개)

### 2.1 어드민 API (`/api/v2/adm`) - 6개

| No | API 명칭 | Method | Endpoint | 설명 |
|:--:|----------|:------:|----------|------|
| 1 | 콘텐츠 목록 조회 | GET | `/api/v2/adm/board` | 검색 조건에 따른 목록 조회 |
| 2 | 콘텐츠 상세 조회 | GET | `/api/v2/adm/board/{id}` | 수정/상세 페이지용 데이터 |
| 3 | 콘텐츠 등록 | POST | `/api/v2/adm/board` | 신규 콘텐츠 등록 (FormData) |
| 4 | 콘텐츠 수정 | PUT | `/api/v2/adm/board/{id}` | 콘텐츠 정보 수정 (FormData) |
| 5 | 콘텐츠 삭제 | DELETE | `/api/v2/adm/board` | 다중 삭제 |
| 6 | 노출 상태 변경 | PUT | `/api/v2/adm/board/visibility` | 노출/미노출 일괄 변경 |

### 2.2 유저 API (`/api/v2/web`) - 2개

| No | API 명칭 | Method | Endpoint | 설명 |
|:--:|----------|:------:|----------|------|
| 1 | 콘텐츠 목록 조회 | GET | `/api/v2/web/board` | 노출 콘텐츠 목록 조회 |
| 2 | 콘텐츠 상세 조회 | GET | `/api/v2/web/board/{id}` | 콘텐츠 상세 보기 |

### 2.3 프록시 API (bizcare-web 내부) - 2개

> **참고**: 프록시 API는 bizcare-web 내부에서 인증 처리 후 `/api/v2/web/board`를 호출합니다.

| No | API 명칭 | Method | Endpoint | 내부 호출 |
|:--:|----------|:------:|----------|-----------|
| 1 | 신체건강 목록 | GET | `/api/proxy/physical` | → `/api/v2/web/board?board_type=PHYSICAL` |
| 2 | 정신건강 목록 | GET | `/api/proxy/mental` | → `/api/v2/web/board?board_type=MENTAL` |

---

## 3. 어드민 API 상세 명세

### 3.1 콘텐츠 목록 조회

```
GET /api/v2/adm/board
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `company_no` | Integer | N | 기업 번호 (미전송 시 전체) |
| `board_type` | String | N | 유형: `ALL`, `PHYSICAL`, `MENTAL` (기본값: `ALL`) |
| `category_code` | String | N | 카테고리 코드 (board_type=PHYSICAL일 때만 유효) |
| `title` | String | N | 제목 검색 키워드 (LIKE %keyword%) |
| `page` | Integer | N | 페이지 번호 (기본값: 1) |
| `size` | Integer | N | 페이지 크기 (기본값: 10) |

#### Response

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "board_type": "PHYSICAL",
        "category_code": "CUSTOM_FIT",
        "category_name": "개인 맞춤 체력관리",
        "title": "대웅지킴이 (개인 맞춤형 PT)",
        "is_public": true,
        "company_no": 1,
        "company_name": "삼성전자",
        "author_id": "admin1",
        "created_at": "2025-01-15T14:30:00.000Z",
        "updated_at": "2025-01-16T10:00:00.000Z"
      }
    ],
    "page": 1,
    "size": 10,
    "total_elements": 100,
    "total_pages": 10
  },
  "message": "Success"
}
```

---

### 3.2 콘텐츠 상세 조회

```
GET /api/v2/adm/board/{id}
```

#### Request

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `id` | Integer | Y | 콘텐츠 ID (Path Variable) |

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "board_type": "PHYSICAL",
    "category_code": "CUSTOM_FIT",
    "category_name": "개인 맞춤 체력관리",
    "title": "대웅지킴이 (개인 맞춤형 PT)",
    "summary": "팀장급 이상·유소견자 대상 1:1 트레이닝\n위치: 힐리언스코어센터 6층",
    "thumbnail_url": "/uploads/images/health-thumbnail.jpg",
    "icon_url": "/uploads/images/health-icon.png",
    "description": "맞춤형 1:1 코칭을 통해, 임직원의 근골격계 및 대사성 질환 예방...",
    "button_name": "신청하기",
    "button_url": "https://example.com/apply",
    "tag": ["건강관리", "체력관리", "PT"],
    "contents": [
      {
        "content_type": "TARGET",
        "content_type_name": "제공대상",
        "description": "전 직원 대상"
      },
      {
        "content_type": "DETAIL",
        "content_type_name": "상세내용",
        "description": "건강검진 비용 100% 지원..."
      },
      {
        "content_type": "HOW_TO_USE",
        "content_type_name": "신청방법",
        "description": "사내 포털 신청 → 검진기관 선택..."
      }
    ],
    "company_no": 1,
    "company_name": "삼성전자",
    "author_id": "admin1",
    "author_name": "관리자",
    "is_public": true,
    "is_deleted": false,
    "created_at": "2025-01-15T14:30:00.000Z",
    "updated_at": "2025-01-16T10:00:00.000Z"
  },
  "message": "Success"
}
```

> **중요**: 응답 필드 이름
> - HTML에서는 `thumbnail_url`, `icon_url` 사용
> - 참고 문서에서는 `thumbnail`, `icon` 사용
> - 현재 코드 기준으로 `thumbnail_url`, `icon_url` 권장

---

### 3.3 콘텐츠 등록

```
POST /api/v2/adm/board
Content-Type: multipart/form-data
```

#### FormData 필드 (HTML 분석 기반)

| Field | Type | Required | Description | 검증 규칙 |
|-------|------|:--------:|-------------|-----------|
| `board_type` | String | Y | `PHYSICAL` 또는 `MENTAL` | ALL 불가 |
| `category_code` | String | △ | 카테고리 코드 | PHYSICAL일 때 필수 |
| `title` | String | Y | 제목 | 최대 100자 |
| `summary` | String | Y | 소개 문구 | - |
| `description` | String | Y | 상세페이지 본문 | - |
| `thumbnail` | File | N | 대표 이미지 | jpg/jpeg/png/gif, 최대 5MB |
| `icon` | File | N | 아이콘 이미지 | jpg/jpeg/png/gif, 최대 2MB |
| `button_name` | String | Y | 버튼 표시 문구 | 최대 20자 |
| `button_url` | String | Y | 이동 링크 URL | http/https 필수 |
| `tag` | String (JSON) | N | 태그 배열 | 최대 10개, 각 20자 이하 |
| `contents` | String (JSON) | Y | 콘텐츠 정보 배열 | 3가지 타입 모두 필수 |
| `company_no` | Integer | Y | 기업 번호 | - |
| `is_public` | Boolean | N | 노출 여부 | 기본값: false |

#### contents JSON 구조

```json
[
  { "content_type": "TARGET", "description": "전 직원 대상" },
  { "content_type": "DETAIL", "description": "건강검진 비용 100% 지원..." },
  { "content_type": "HOW_TO_USE", "description": "사내 포털 신청..." }
]
```

#### Response

```json
{
  "success": true,
  "data": { "id": 123 },
  "message": "등록되었습니다."
}
```

---

### 3.4 콘텐츠 수정

```
PUT /api/v2/adm/board/{id}
Content-Type: multipart/form-data
```

> **참고**: 등록과 동일한 필드 구조를 사용합니다. 이미지 필드는 새 파일이 있을 때만 전송합니다.

#### Response

```json
{
  "success": true,
  "data": { "id": 123 },
  "message": "수정되었습니다."
}
```

---

### 3.5 콘텐츠 삭제

```
DELETE /api/v2/adm/board
Content-Type: application/json
```

#### Request Body

```json
{
  "ids": [1, 2, 3]
}
```

#### Response

```json
{
  "success": true,
  "data": { "deleted_count": 3 },
  "message": "삭제되었습니다."
}
```

---

### 3.6 노출 상태 변경

```
PUT /api/v2/adm/board/visibility
Content-Type: application/json
```

#### Request Body

```json
{
  "ids": [1, 2, 3],
  "is_public": true
}
```

#### Response

```json
{
  "success": true,
  "data": { "updated_count": 3 },
  "message": "노출 상태가 변경되었습니다."
}
```

---

## 4. 유저 API 상세 명세

### 4.1 콘텐츠 목록 조회

```
GET /api/v2/web/board
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `company_no` | Integer | N | 기업 번호 |
| `board_type` | String | N | `ALL`, `PHYSICAL`, `MENTAL` (기본값: `ALL`) |
| `category_code` | String | N | 카테고리 코드 |
| `page` | Integer | N | 페이지 번호 |
| `size` | Integer | N | 페이지 크기 |

#### Response

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "board_type": "PHYSICAL",
        "category_code": "CUSTOM_FIT",
        "category_name": "개인 맞춤 체력관리",
        "title": "대웅지킴이 (개인 맞춤형 PT)",
        "summary": "팀장급 이상·유소견자 대상 1:1 트레이닝",
        "thumbnail_url": "/uploads/images/health-thumbnail.jpg",
        "icon_url": "/uploads/images/health-icon.png",
        "tag": ["건강관리", "체력관리", "PT"],
        "company_no": 1,
        "company_name": "삼성전자",
        "created_at": "2025-01-15T14:30:00.000Z"
      }
    ],
    "page": 1,
    "size": 10,
    "total_elements": 50,
    "total_pages": 5
  },
  "message": "Success"
}
```

> **참고**: 유저 API는 `is_public = true`인 콘텐츠만 반환합니다.

---

### 4.2 콘텐츠 상세 조회

```
GET /api/v2/web/board/{id}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "board_type": "PHYSICAL",
    "category_code": "CUSTOM_FIT",
    "category_name": "개인 맞춤 체력관리",
    "title": "대웅지킴이 (개인 맞춤형 PT)",
    "summary": "팀장급 이상·유소견자 대상 1:1 트레이닝",
    "thumbnail_url": "/uploads/images/health-thumbnail.jpg",
    "icon_url": "/uploads/images/health-icon.png",
    "description": "맞춤형 1:1 코칭을 통해...",
    "button_name": "신청하기",
    "button_url": "https://example.com/apply",
    "tag": ["건강관리", "체력관리", "PT"],
    "contents": [
      {
        "content_type": "TARGET",
        "content_type_name": "제공대상",
        "description": "전 직원 대상"
      },
      {
        "content_type": "DETAIL",
        "content_type_name": "상세내용",
        "description": "건강검진 비용 100% 지원..."
      },
      {
        "content_type": "HOW_TO_USE",
        "content_type_name": "신청방법",
        "description": "사내 포털 신청..."
      }
    ],
    "company_no": 1,
    "company_name": "삼성전자",
    "created_at": "2025-01-15T14:30:00.000Z"
  },
  "message": "Success"
}
```

---

## 5. 코드 정의

### 5.1 board_type (유형)

| 코드 | 설명 | 용도 |
|------|------|------|
| `PHYSICAL` | 신체건강 | 등록/수정/검색 |
| `MENTAL` | 정신건강 | 등록/수정/검색 |
| `ALL` | 전체 | **검색에서만 사용** |

### 5.2 category_code (카테고리)

> **중요**: `board_type=PHYSICAL`일 때만 사용 가능

| 코드 | 설명 |
|------|------|
| `CUSTOM_FIT` | 개인 맞춤 체력관리 |
| `MUSCULOSKELETAL` | 근골격계 대사성 질환 |
| `HEALTH_CHECK` | 건강검진 데이터 서비스 |
| `RECOVERY` | 일상 활력 피로회복 |

### 5.3 content_type (콘텐츠 유형)

| 코드 | content_type_name | 설명 |
|------|-------------------|------|
| `TARGET` | 제공대상 | 서비스 제공 대상 |
| `DETAIL` | 상세내용 | 서비스 상세 설명 |
| `HOW_TO_USE` | 신청방법 | 서비스 이용/신청 방법 |

---

## 6. 공통 응답 형식

### 성공 응답

```json
{
  "success": true,
  "data": { ... },
  "message": "Success"
}
```

### 실패 응답

```json
{
  "success": false,
  "data": null,
  "message": "에러 메시지"
}
```

---

## 7. 검증 규칙 요약

| 항목 | 검증 내용 |
|------|----------|
| `board_type` (등록/수정) | `PHYSICAL` 또는 `MENTAL`만 허용 |
| `board_type` (검색) | `ALL`, `PHYSICAL`, `MENTAL` 허용 |
| `category_code` | board_type=PHYSICAL일 때 필수 |
| `button_url` | `http://` 또는 `https://`로 시작 |
| `thumbnail` | jpg/jpeg/png/gif, 최대 5MB |
| `icon` | jpg/jpeg/png/gif, 최대 2MB |
| `tag` | 최대 10개, 각 20자 이하 |
| `contents` | TARGET, DETAIL, HOW_TO_USE 3가지 필수 |
| `title` | 최대 100자 |
| `button_name` | 최대 20자 |

---

## 8. Dummy Server 구현 가이드라인

### 8.1 권장 기술 스택

- **Node.js + Express** 또는 **json-server**
- FormData 처리를 위한 `multer` 패키지
- CORS 설정 필수

### 8.2 Mock 데이터 구조

```javascript
const mockData = {
  boards: [
    {
      id: 1,
      board_type: "PHYSICAL",
      category_code: "CUSTOM_FIT",
      category_name: "개인 맞춤 체력관리",
      title: "대웅지킴이 (개인 맞춤형 PT)",
      summary: "팀장급 이상·유소견자 대상 1:1 트레이닝",
      thumbnail_url: "/uploads/images/sample-thumbnail.jpg",
      icon_url: "/uploads/images/sample-icon.png",
      description: "맞춤형 1:1 코칭 프로그램입니다.",
      button_name: "신청하기",
      button_url: "https://example.com/apply",
      tag: ["건강관리", "체력관리", "PT"],
      contents: [
        { content_type: "TARGET", content_type_name: "제공대상", description: "전 직원 대상" },
        { content_type: "DETAIL", content_type_name: "상세내용", description: "상세 내용..." },
        { content_type: "HOW_TO_USE", content_type_name: "신청방법", description: "신청 방법..." }
      ],
      company_no: 1,
      company_name: "대웅제약",
      author_id: "admin",
      author_name: "관리자",
      is_public: true,
      is_deleted: false,
      created_at: "2025-01-15T14:30:00.000Z",
      updated_at: "2025-01-16T10:00:00.000Z"
    }
  ],
  companies: [
    { companyNo: 1, companyName: "대웅제약" },
    { companyNo: 2, companyName: "대웅바이오" }
  ]
};
```

### 8.3 엔드포인트 구현 우선순위

1. **필수** (어드민 기능 동작): 
   - `GET /api/v2/adm/board/{id}` - 수정/상세 페이지
   - `POST /api/v2/adm/board` - 등록
   - `PUT /api/v2/adm/board/{id}` - 수정

2. **중요** (목록 및 유저 기능):
   - `GET /api/v2/adm/board` - 목록 조회
   - `GET /api/v2/web/board` - 유저 목록
   - `GET /api/v2/web/board/{id}` - 유저 상세

3. **추가** (부가 기능):
   - `DELETE /api/v2/adm/board` - 다중 삭제
   - `PUT /api/v2/adm/board/visibility` - 노출 상태 변경

---

## 9. HTML 파일별 API 사용 매핑

| HTML 파일 | 사용하는 API |
|-----------|-------------|
| `health_care_write.html` | POST `/api/v2/adm/board` |
| `health_care_modify.html` | GET `/api/v2/adm/board/{id}`, PUT `/api/v2/adm/board/{id}` |
| `health_care_view.html` | GET `/api/v2/adm/board/{id}`, DELETE `/api/v2/adm/board/{id}` |
| `physical.html` | GET `/api/proxy/physical` → `/api/v2/web/board?board_type=PHYSICAL` |
| `physical_view.html` | GET `/api/v2/web/board/{id}` |
| `mental.html` | GET `/api/proxy/mental` → `/api/v2/web/board?board_type=MENTAL` |
| `mental_view.html` | GET `/api/v2/web/board/{id}` |
