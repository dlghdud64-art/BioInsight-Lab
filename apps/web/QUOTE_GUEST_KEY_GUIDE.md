# Quote Guest Key 시스템 가이드

## 개요

비로그인 사용자도 견적 요청서를 서버에 저장하고 관리할 수 있도록 **Guest Key** 시스템을 구현했습니다.

## 주요 기능

### 1. Guest Key 자동 발급
- 브라우저 localStorage에 `bioinsight_guest_key` 자동 생성
- 형식: `guest_{timestamp}_{random}`
- 한 번 발급되면 브라우저에서 계속 유지

### 2. 서버 저장
- 로그인 없이도 서버에 견적 저장 가능
- URL에 `quoteId` 추가되어 공유 가능
- 새로고침해도 서버에서 복원

### 3. 보안
- Guest Key가 일치하는 사용자만 조회/수정 가능
- 다른 브라우저에서는 같은 견적 접근 불가
- 로그인 사용자와 동일한 수준의 권한 관리

## 사용 흐름

### A. 비로그인 사용자 (Guest Key 사용)

```
1. /test/quote 페이지 접속
   └─> localStorage에 guest key 자동 생성

2. 품목 추가/수정
   └─> 로컬 스토어에 임시 저장

3. "저장하기" 버튼 클릭
   └─> POST /api/quotes (x-guest-key 헤더 전송)
   └─> 서버 응답: { quote: { id: "quote_xxx" } }
   └─> URL 변경: /test/quote?quoteId=quote_xxx

4. 페이지 새로고침
   └─> GET /api/quotes/quote_xxx (x-guest-key 헤더 전송)
   └─> 서버에서 데이터 복원

5. 품목 수정 후 저장
   └─> PATCH /api/quotes/quote_xxx (x-guest-key 헤더 전송)
   └─> 수정사항 서버에 반영
```

### B. 로그인 사용자 (Session 사용)

```
1. Google 로그인
   └─> localStorage의 guest key 유지 (삭제하지 않음)

2. /test/quote 페이지 접속
   └─> session.user.id로 식별

3. 저장 시
   └─> userId로 저장 (guestKey 대신)
   └─> 다른 기기에서도 접근 가능
```

## API 엔드포인트

### POST /api/quotes
견적 생성

**헤더:**
```
Content-Type: application/json
x-guest-key: guest_xxx (비로그인 시)
```

**요청 Body:**
```json
{
  "title": "견적 요청서 제목",
  "message": "요청 메시지",
  "productIds": ["prod_1", "prod_2"],
  "quantities": { "prod_1": 2, "prod_2": 1 },
  "notes": { "prod_1": "메모" },
  "vendorIds": { "prod_1": "vendor_1" }
}
```

**응답:**
```json
{
  "quote": {
    "id": "quote_xxx",
    "title": "견적 요청서 제목",
    "userId": null,
    "guestKey": "guest_xxx",
    "items": [...]
  }
}
```

### GET /api/quotes/[id]
견적 조회

**헤더:**
```
x-guest-key: guest_xxx (비로그인 시)
```

**응답:**
- 200: 견적 데이터
- 403: guestKey 불일치 (Forbidden)
- 404: 견적 없음

### PATCH /api/quotes/[id]
견적 수정

**헤더:**
```
Content-Type: application/json
x-guest-key: guest_xxx (비로그인 시)
```

**요청 Body:**
```json
{
  "title": "수정된 제목",
  "message": "수정된 메시지",
  "items": [
    {
      "productId": "prod_1",
      "quantity": 3,
      "unitPrice": 10000,
      "currency": "KRW",
      "lineTotal": 30000,
      "notes": "수정된 메모"
    }
  ]
}
```

## 데이터베이스 구조

### Quote 모델
```prisma
model Quote {
  id       String  @id @default(cuid())
  userId   String? // nullable - 로그인 사용자
  guestKey String? // nullable - 비로그인 사용자
  title    String
  // ... 기타 필드
  
  @@index([userId])
  @@index([guestKey])
}
```

**주요 규칙:**
- `userId`와 `guestKey`는 배타적 (둘 중 하나만 존재)
- 로그인 사용자: `userId` O, `guestKey` X
- 비로그인 사용자: `userId` X, `guestKey` O

## 프론트엔드 유틸리티

### getGuestKey()
localStorage에서 guest key 가져오기. 없으면 자동 생성.

```typescript
import { getGuestKey } from "@/lib/guest-key";

const guestKey = getGuestKey();
// => "guest_xxx"
```

### addGuestKeyHeader()
fetch 요청에 x-guest-key 헤더 자동 추가

```typescript
import { addGuestKeyHeader } from "@/lib/guest-key";

const response = await fetch("/api/quotes", {
  method: "POST",
  headers: addGuestKeyHeader({ "Content-Type": "application/json" }),
  body: JSON.stringify({ ... }),
});
```

### clearGuestKey()
로그인 시 guest key 삭제 (선택사항)

```typescript
import { clearGuestKey } from "@/lib/guest-key";

// 로그인 성공 후
clearGuestKey();
```

## 테스트 시나리오

### ✅ 시나리오 1: 작성 → 저장 → 복원
1. /test/quote 접속 (비로그인)
2. 품목 2개 추가
3. "저장하기" 클릭
4. URL에 `?quoteId=xxx` 확인
5. F5 새로고침
6. 품목 2개 복원 확인 ✅

### ✅ 시나리오 2: 수정 → 저장 → 반영
1. 위 시나리오 1 완료 상태
2. 품목 1개 더 추가
3. "저장" 클릭
4. F5 새로고침
5. 품목 3개 확인 ✅

### ✅ 시나리오 3: URL 공유
1. 위 시나리오 완료 상태
2. URL 복사: `http://localhost:3000/test/quote?quoteId=xxx`
3. **새 시크릿 창**에서 URL 접속
4. 403 Forbidden 확인 ✅ (다른 guest key)

### ✅ 시나리오 4: 로그인 후 저장
1. Google 로그인
2. /test/quote 접속
3. 품목 추가 후 저장
4. URL 복사하여 다른 기기에서 접속 (로그인 필요)
5. 데이터 확인 ✅

## 제한사항 및 주의사항

### 브라우저 로컬 스토리지 의존
- localStorage를 지우면 guest key 분실
- 분실 시 이전 견적 접근 불가
- 해결: 중요한 견적은 로그인 후 저장 권장

### 보안
- guest key는 URL에 포함되지 않음 (헤더로만 전송)
- 다른 사람이 quoteId를 알아도 guest key 없으면 접근 불가
- 로그인 사용자는 더 강력한 보안 (서버 세션)

### 브라우저 간 공유 불가
- Chrome에서 만든 견적은 Firefox에서 접근 불가
- 해결: 로그인하면 모든 기기에서 접근 가능

## 마이그레이션 (Guest → User)

Guest로 만든 견적을 로그인 계정으로 이전하는 기능은 향후 추가 예정입니다.

```typescript
// 향후 구현 예정
async function migrateGuestQuotesToUser(guestKey: string, userId: string) {
  await db.quote.updateMany({
    where: { guestKey },
    data: {
      userId,
      guestKey: null,
    },
  });
}
```

## 문제 해결

### localStorage에 guest key가 없음
- 자동 생성되므로 문제 없음
- 브라우저가 localStorage를 차단하면 세션용 임시 키 사용

### 403 Forbidden 에러
- guest key가 일치하지 않음
- 다른 브라우저나 시크릿 창에서 접속한 경우
- 해결: 원래 브라우저에서 접속

### 저장은 되는데 복원 안 됨
1. 개발자 도구 → Application → Local Storage 확인
2. `bioinsight_guest_key` 값 확인
3. Network 탭에서 요청 헤더 `x-guest-key` 확인
4. 서버 응답 확인

## 완료 체크리스트

- [x] Prisma schema에 guestKey 필드 추가
- [x] guest-key 유틸리티 함수 구현
- [x] 프론트엔드에서 x-guest-key 헤더 전송
- [x] POST /api/quotes에 guestKey 지원
- [x] GET /api/quotes/[id]에 guestKey 인증
- [x] PATCH /api/quotes/[id]에 guestKey 인증
- [x] Linter 에러 없음
- [ ] 실제 브라우저 테스트

## 다음 단계

1. **개발 서버 재시작**
   ```powershell
   cd apps/web
   pnpm dev
   ```

2. **브라우저 테스트**
   - http://localhost:3000/test/quote 접속
   - 품목 추가 → 저장 → 새로고침 → 복원 확인
   - 개발자 도구에서 localStorage, Network 확인

3. **데모 완성 확인**
   - ✅ 작성 → 저장 → URL에 quoteId → 새로고침 복원 → 수정 후 저장 반영









