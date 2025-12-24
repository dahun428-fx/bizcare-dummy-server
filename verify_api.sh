#!/bin/bash

BASE_URL="http://localhost:8300"

echo "=== 1. Admin List API ==="
curl -s "$BASE_URL/api/v2/adm/board?page=1&size=5" | python3 -m json.tool

echo -e "\n\n=== 2. Admin Detail API (ID: 1) ==="
curl -s "$BASE_URL/api/v2/adm/board/1" | python3 -m json.tool

echo -e "\n\n=== 3. Admin Create API ==="
# 썸네일용 더미 파일 생성
touch dummy_thumb.jpg
curl -s -X POST "$BASE_URL/api/v2/adm/board" \
  -F "board_type=PHYSICAL" \
  -F "category_code=CUSTOM_FIT" \
  -F "title=Test Content" \
  -F "summary=Test Summary" \
  -F "description=Test Description" \
  -F "button_name=Apply" \
  -F "button_url=https://test.com" \
  -F "company_no=1" \
  -F "is_public=true" \
  -F "thumbnail=@dummy_thumb.jpg" \
  -F 'contents=[{"content_type":"TARGET","description":"Target"}]' | python3 -m json.tool

# 생성된 ID 확인을 위해 목록 다시 조회 (마지막 아이템)
echo -e "\n\n=== Check Created Item ==="
curl -s "$BASE_URL/api/v2/adm/board?page=1&size=100" | python3 -m json.tool | tail -n 20

echo -e "\n\n=== 4. Admin Update API (ID: 1) ==="
curl -s -X PUT "$BASE_URL/api/v2/adm/board/1" \
  -F "title=Updated Title" | python3 -m json.tool

echo -e "\n\n=== 5. Admin Visibility Update API ==="
curl -s -X PUT "$BASE_URL/api/v2/adm/board/visibility" \
  -H "Content-Type: application/json" \
  -d '{"ids": [2], "is_public": false}' | python3 -m json.tool

echo -e "\n\n=== 6. User List API (PHYSICAL) ==="
curl -s "$BASE_URL/api/v2/web/board?board_type=PHYSICAL" | python3 -m json.tool

echo -e "\n\n=== 7. User Detail API (ID: 1) ==="
curl -s "$BASE_URL/api/v2/web/board/1" | python3 -m json.tool

echo -e "\n\n=== 8. Admin Single Delete API (ID: 3) ==="
curl -s -X DELETE "$BASE_URL/api/v2/adm/board/3" | python3 -m json.tool

echo -e "\n\n=== 9. Admin Bulk Delete API (ID: 4) ==="
curl -s -X DELETE "$BASE_URL/api/v2/adm/board" \
  -H "Content-Type: application/json" \
  -d '{"ids": [4]}' | python3 -m json.tool

rm dummy_thumb.jpg
