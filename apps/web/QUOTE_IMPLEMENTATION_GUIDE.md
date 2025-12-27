# Quote System Implementation Guide

## 목표
/test/quote 플로우의 "견적요청서(리스트)"를 Supabase(Postgres) + Prisma로 영구 저장하고, guestKey 기반 익명 접근을 지원합니다.

## 구현 완료 사항

### 1. Prisma 스키마 업데이트

#### Quote 모델 변경사항
```prisma
model Quote {
  id             String    @id @default(cuid())
  userId         String? // Nullable for guest quotes
  guestKey       String? // Guest key for anonymous access
  currency       String    @default("KRW") // Currency for quote totals
  totalAmount    Int? // Total amount (sum of line totals)
  // ... existing fields
}
```

**주요 추가 필드:**
- `guestKey`: 게스트 사용자 식별 키 (nullable)
- `userId`: nullable로 변경 (게스트 지원)
- `currency`: 통화 정보
- `totalAmount`: 총 금액 (자동 계산)

#### QuoteListItem 모델 업데이트
```prisma
model QuoteListItem {
  id            String   @id @default(cuid())
  productId     String? // Nullable for draft items without existing products
  name          String? // Product name (denormalized)
  brand         String? // Brand (denormalized)
  catalogNumber String? // Catalog number (denormalized)
  unit          String?  @default("ea")
  quantity      Int      @default(1)
  unitPrice     Int? // Integer for KRW precision
  lineTotal     Int? // Unit price × quantity
  notes         String?
  raw           Json? // Raw data snapshot (JSONB)
  // ... existing fields
}
```

**주요 변경사항:**
- `productId`: nullable (제품 DB 없이도 견적 생성 가능)
- `name`, `brand`, `catalogNumber`: 추가 (비정규화)
- `unitPrice`, `lineTotal`: Integer 타입 (KRW 정밀도)
- `raw`: JSONB 필드 추가 (원본 데이터 스냅샷)

#### 새로운 모델: QuoteVendor
```prisma
model QuoteVendor {
  id          String   @id @default(cuid())
  quoteId     String
  vendorName  String
  email       String?
  country     String?  @default("KR")
  memo        String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**용도:** 견적서별 벤더 정보 저장 (optional, 추후 확장 가능)

#### 새로운 모델: QuoteShare
```prisma
model QuoteShare {
  id          String    @id @default(cuid())
  quoteId     String    @unique
  shareToken  String    @unique
  expiresAt   DateTime?
  enabled     Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**용도:** Phase B - 공개 공유 기능 (현재는 optional)

---

### 2. 데이터베이스 마이그레이션

**위치:** `apps/web/prisma/migrations/20251227_add_quote_guest_support/`

**파일:**
- `migration.sql`: 스키마 변경 SQL
- `rls_policies.sql`: Supabase RLS 정책

**마이그레이션 적용 방법:**
```bash
cd apps/web

# 실제 DATABASE_URL 설정 후
export DATABASE_URL="postgresql://user:password@host:port/database"

# 또는 .env 파일에 추가:
# DATABASE_URL="postgresql://..."

# 마이그레이션 적용
npm run db:migrate

# RLS 정책 적용 (Supabase 환경에서만)
# Supabase SQL Editor에서 rls_policies.sql 실행
```

---

### 3. API 라우트 구현

#### POST /api/quotes
**설명:** 새 견적 생성 (인증 사용자 또는 게스트)

**요청:**
```typescript
{
  title?: string;
  description?: string;
  items: Array<{
    productId?: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
    unit?: string; // default: "ea"
    quantity: number;
    unitPrice?: number;
    notes?: string;
    raw?: Record<string, unknown>;
  }>;
}
```

**응답:**
```typescript
{
  id: string;
  quote: Quote;
}
```

**인증:**
- 로그인 사용자: `userId` 자동 설정
- 게스트: `guestKey` 쿠키에서 자동 생성/조회
- 헤더 `X-Guest-Key` 지원 (명시적 guestKey 전달)

---

#### GET /api/quotes/:id
**설명:** 특정 견적 조회

**인증 규칙:**
- 소유자 (`userId` 일치)
- 또는 guestKey 일치 (쿠키 또는 `X-Guest-Key` 헤더)

**응답:**
```typescript
{
  quote: Quote;
}
```

---

#### PATCH /api/quotes/:id
**설명:** 견적 수정 (title, description, status, items 교체)

**요청:**
```typescript
{
  title?: string;
  description?: string;
  status?: "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "PURCHASED" | "CANCELLED";
  items?: Array<QuoteItem>; // 전체 교체 (upsert)
}
```

**Items 교체 방식:**
1. 기존 items 전체 삭제
2. 새로운 items 생성
3. totalAmount 재계산

**응답:**
```typescript
{
  quote: Quote;
}
```

---

#### DELETE /api/quotes/:id
**설명:** 견적 삭제

**응답:**
```typescript
{
  success: boolean;
}
```

---

#### GET /api/quotes
**설명:** 현재 사용자/게스트의 모든 견적 조회

**응답:**
```typescript
{
  quotes: Quote[];
}
```

---

### 4. Supabase RLS 정책

**중요:** Guest 사용자는 Supabase 클라이언트로 직접 접근 불가!
- 모든 guest 작업은 API 라우트를 통해서만 가능
- API 라우트는 service role key 사용 (RLS 우회)
- 서버에서 guestKey 검증 후 처리

**RLS 정책 요약:**

1. **Quote 테이블**
   - Authenticated users: 본인 quotes만 CRUD
   - Guest users: API 라우트에서만 처리 (RLS 우회)

2. **QuoteListItem 테이블**
   - 해당 Quote의 소유자만 CRUD

3. **QuoteVendor 테이블**
   - 해당 Quote의 소유자만 CRUD

4. **QuoteShare 테이블** (Phase B)
   - Public read (enabled && not expired)
   - 소유자만 관리 가능

**RLS 적용:**
```sql
-- apps/web/prisma/migrations/20251227_add_quote_guest_support/rls_policies.sql 참조
```

---

### 5. 클라이언트 API 유틸리티

**위치:** `apps/web/src/lib/api/quotes-client.ts`

**사용 예시:**

```typescript
import { createQuote, getQuote, updateQuote, getQuotes } from '@/lib/api/quotes-client';

// 1. 새 견적 생성
const { id, quote } = await createQuote({
  title: "연구용 시약 견적",
  items: [
    {
      name: "DMSO",
      brand: "Sigma",
      catalogNumber: "D2650",
      unit: "mL",
      quantity: 100,
      unitPrice: 50000,
    },
  ],
});

// 2. 견적 조회
const { quote } = await getQuote(id);

// 3. 견적 수정
const { quote: updated } = await updateQuote(id, {
  title: "수정된 제목",
  items: [...], // 전체 교체
});

// 4. 모든 견적 조회
const { quotes } = await getQuotes();
```

---

### 6. /test/quote UI 연동 가이드

#### 현재 /test/quote 구조
- `apps/web/src/app/test/quote/page.tsx`
- `apps/web/src/app/test/_components/quote-panel.tsx`

#### 연동 방법

**Step 1: 진입 시 로드**
```typescript
import { useEffect, useState } from 'react';
import { getQuotes, getQuote } from '@/lib/api/quotes-client';

function QuotePage() {
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
      // 기존 견적 로드
      getQuote(id).then(({ quote }) => {
        setQuoteId(id);
        setItems(quote.items);
      });
    } else {
      // 로컬 draft 사용 (기존 로직)
    }
  }, []);
}
```

**Step 2: 저장 버튼 구현**
```typescript
import { createQuote, updateQuote } from '@/lib/api/quotes-client';
import { useToast } from '@/hooks/use-toast';

function QuotePanel() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      if (quoteId) {
        // 기존 견적 업데이트
        await updateQuote(quoteId, {
          title: "견적 제목",
          items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            // ... other fields
          })),
        });

        toast({
          title: "저장 완료",
          description: "견적이 성공적으로 업데이트되었습니다.",
        });
      } else {
        // 새 견적 생성
        const { id } = await createQuote({
          title: "새 견적",
          items: items.map(item => ({ ... })),
        });

        setQuoteId(id);

        // URL 업데이트
        const url = new URL(window.location.href);
        url.searchParams.set('id', id);
        window.history.pushState({}, '', url);

        toast({
          title: "저장 완료",
          description: "새 견적이 생성되었습니다.",
        });
      }
    } catch (error) {
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button onClick={handleSave} disabled={isSaving}>
      {isSaving ? "저장 중..." : "저장"}
    </Button>
  );
}
```

---

## 마이그레이션 체크리스트

### 개발 환경 설정
- [ ] .env 파일에 DATABASE_URL 설정
- [ ] `npm install` 실행
- [ ] `npm run db:migrate` 실행
- [ ] Prisma Studio로 스키마 확인: `npm run db:studio`

### Supabase 환경 (선택사항)
- [ ] Supabase SQL Editor에서 `rls_policies.sql` 실행
- [ ] RLS 활성화 확인
- [ ] Service role key 설정 확인

### API 라우트 통합
- [ ] 기존 `/api/quotes/route.ts` 백업
- [ ] `/api/quotes/route.new.ts` → `/api/quotes/route.ts`로 교체
- [ ] 기존 `/api/quotes/[id]/route.ts` 백업
- [ ] `/api/quotes/[id]/route.new.ts` → `/api/quotes/[id]/route.ts`로 교체
- [ ] `/api/quote-lists` 제거 또는 `/api/quotes`로 alias 처리

### 프론트엔드 연동
- [ ] `/test/quote` 페이지에 API 연동 코드 추가
- [ ] 저장 버튼 구현
- [ ] URL 파라미터 `?id=` 처리
- [ ] 토스트 메시지 추가
- [ ] 로딩 상태 표시

### 테스트
- [ ] Guest 사용자로 견적 생성 테스트
- [ ] 인증 사용자로 견적 생성 테스트
- [ ] 견적 수정 (items 교체) 테스트
- [ ] 견적 삭제 테스트
- [ ] guestKey 쿠키 확인
- [ ] 브라우저 재시작 후 견적 조회 확인

---

## 보안 고려사항

### Guest Key 보안
1. **쿠키 기반 저장**
   - HttpOnly: XSS 공격 방지
   - SameSite: CSRF 공격 방지
   - Secure: HTTPS only (프로덕션)

2. **서버 검증**
   - 모든 guestKey 작업은 서버에서 검증
   - 클라이언트는 Supabase 직접 접근 불가

3. **RLS 정책**
   - Guest 접근은 API 라우트 전용
   - Service role key로만 RLS 우회

### 데이터 접근 제어
- **Authenticated**: userId 일치 확인
- **Guest**: guestKey 일치 확인
- **Public Share** (Phase B): shareToken + enabled + not expired

---

## 다음 단계 (Phase B)

### Public Sharing 구현
1. **QuoteShare 활성화**
   - Share 링크 생성 API
   - Public 조회 API (`/api/quotes/shared/:shareToken`)
   - RLS 정책 주석 해제

2. **UI 개선**
   - Share 버튼 추가
   - Share 링크 복사 기능
   - 공유 설정 (만료일, 활성화/비활성화)

### QuoteVendor 활용
1. 벤더 정보 관리 UI
2. 벤더별 견적 그룹화
3. 벤더 이메일 알림 (기존 기능 통합)

---

## 문제 해결

### 마이그레이션 실패
```bash
# Prisma 클라이언트 재생성
npm run db:generate

# 마이그레이션 상태 확인
npx prisma migrate status

# 마이그레이션 초기화 (주의!)
npx prisma migrate reset
```

### RLS 정책 문제
- Supabase Dashboard > SQL Editor에서 정책 확인
- `SELECT * FROM pg_policies WHERE tablename = 'Quote';`

### guestKey 인식 안됨
- 쿠키 확인: DevTools > Application > Cookies > `bil_guest`
- API 요청 헤더 확인: `X-Guest-Key`

---

## 참고 파일

### Prisma
- `apps/web/prisma/schema.prisma` - 스키마 정의
- `apps/web/prisma/migrations/20251227_add_quote_guest_support/` - 마이그레이션

### API
- `apps/web/src/app/api/quotes/route.new.ts` - POST, GET /api/quotes
- `apps/web/src/app/api/quotes/[id]/route.new.ts` - GET, PATCH, DELETE /api/quotes/:id
- `apps/web/src/lib/api/quotes-client.ts` - 클라이언트 유틸리티
- `apps/web/src/lib/api/guest-key.ts` - guestKey 헬퍼

### UI
- `apps/web/src/app/test/quote/page.tsx` - 테스트 페이지
- `apps/web/src/app/test/_components/quote-panel.tsx` - 견적 패널

---

## 연락처

구현 관련 질문이나 이슈가 있으면 프로젝트 이슈 트래커에 등록해주세요.

---

**구현 완료일:** 2025-12-27
**버전:** 1.0.0
