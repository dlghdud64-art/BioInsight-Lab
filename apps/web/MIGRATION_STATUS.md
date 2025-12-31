# 마이그레이션 상태

## 현재 상황

### ✅ 이미 생성된 테이블
Prisma 스키마를 확인한 결과, **`QuoteList`와 `QuoteListItem` 테이블이 이미 정의되어 있습니다**:

- **QuoteList**: 비로그인 임시저장용 견적요청서 리스트 (P0)
  - `guestKey`: 쿠키로 발급된 게스트 키 (필수)
  - `userId`: 로그인 사용자 ID (nullable, 추후 연결)
  - `status`: QuoteListStatus (DRAFT, SENT)
  
- **QuoteListItem**: 비로그인 임시저장용 견적요청서 라인아이템 (P0)
  - `quoteListId`: QuoteList와의 관계
  - `productId`: 제품 ID (nullable, 직접 입력 가능)

### ⚠️ 연결 문제
현재 DATABASE_URL과 DIRECT_URL 모두 연결에 실패하고 있습니다:
- DATABASE_URL: `Can't reach database server`
- DIRECT_URL: `Can't reach database server`

## 해결 방법

### 방법 1: Supabase 대시보드에서 확인
1. Supabase 대시보드 → **Table Editor**로 이동
2. `QuoteList`와 `QuoteListItem` 테이블이 이미 존재하는지 확인
3. 존재한다면 마이그레이션이 필요 없습니다

### 방법 2: 연결 설정 확인
`.env.local` 파일의 연결 문자열이 올바른지 확인:
- Supabase 대시보드에서 최신 연결 문자열 복사
- `connection_limit=1` 파라미터가 올바른지 확인

### 방법 3: Supabase SQL Editor 사용
마이그레이션이 필요하다면 Supabase SQL Editor에서 직접 실행:

```sql
-- QuoteList 테이블이 없다면 생성
CREATE TABLE IF NOT EXISTS "QuoteList" (
  "id" TEXT NOT NULL,
  "guestKey" TEXT NOT NULL,
  "userId" TEXT,
  "title" TEXT,
  "message" TEXT,
  "status" "QuoteListStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'KRW',
  "totalAmount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuoteList_pkey" PRIMARY KEY ("id")
);

-- QuoteListItem 테이블이 없다면 생성
CREATE TABLE IF NOT EXISTS "QuoteListItem" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT,
  "quoteListId" TEXT,
  "productId" TEXT,
  "name" TEXT,
  "vendor" TEXT,
  "brand" TEXT,
  "catalogNumber" TEXT,
  "lineNumber" INTEGER,
  "unitPrice" DOUBLE PRECISION,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "currency" TEXT DEFAULT 'KRW',
  "lineTotal" DOUBLE PRECISION,
  "notes" TEXT,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuoteListItem_pkey" PRIMARY KEY ("id")
);
```

## 다음 단계

1. Supabase Table Editor에서 테이블 존재 여부 확인
2. 테이블이 없다면 SQL Editor에서 위 SQL 실행
3. 연결 문제 해결 후 `pnpm db:test`로 확인











