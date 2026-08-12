# Purchase Dashboard MVP - GuestKey 기반 구현

## 개요
로그인/조직 없이 guestKey만으로 구매내역 저장/집계/예산 관리가 가능한 MVP 구현

## 핵심 특징

### 1. GuestKey 기반 스코프
- `scopeKey` = localStorage의 `bioinsight_guest_key`
- 브라우저별 자동 생성 및 영구 저장
- 서버 요청 시 `x-guest-key` 헤더로 전송
- 모든 Purchase/Budget 데이터는 guestKey로 분리

### 2. 완료된 구현

#### Database Schema (`apps/web/prisma/schema.prisma`)

**PurchaseRecord Model:**
```prisma
model PurchaseRecord {
  id            String   @id @default(cuid())
  scopeKey      String   // guestKey (향후 workspaceId로 전환 가능)
  quoteId       String?  // Quote 연결 (optional)
  purchasedAt   DateTime
  vendorName    String
  category      String?
  itemName      String
  catalogNumber String?
  unit          String?
  qty           Int
  unitPrice     Int?     // optional for import
  amount        Int      // required (자동 계산 or 입력)
  currency      String   @default("KRW")
  source        String   @default("import") // "import" | "quote"

  @@index([scopeKey, purchasedAt])
  @@index([scopeKey, vendorName])
  @@index([scopeKey, category])
  @@index([quoteId])
}
```

**Budget Model:**
```prisma
model Budget {
  id          String   @id @default(cuid())
  scopeKey    String
  yearMonth   String   // "YYYY-MM" format
  amount      Int
  currency    String   @default("KRW")
  description String?

  @@unique([scopeKey, yearMonth])
  @@index([scopeKey])
}
```

#### API Endpoints

**POST /api/purchases/import**
- 헤더: `x-guest-key` (필수)
- Body: `{ rows: Array<PurchaseRow> }`
- PurchaseRow 형식:
  ```json
  {
    "purchasedAt": "2025-01-15",
    "vendorName": "Sigma-Aldrich",
    "category": "REAGENT",
    "itemName": "Reagent A",
    "catalogNumber": "R1234",
    "unit": "ea",
    "qty": 10,
    "unitPrice": 50000,
    "amount": 500000,
    "currency": "KRW"
  }
  ```
- 응답: `{ totalRows, successRows, errorRows, errorSample, records }`

**GET /api/purchases**
- 헤더: `x-guest-key` (필수)
- Query: `from`, `to`, `vendor`, `category`, `page`, `limit`
- 응답: `{ items, totalCount, page, limit, totalPages }`

**GET /api/purchases/summary**
- 헤더: `x-guest-key` (필수)
- Query: `from`, `to`
- 응답:
  ```json
  {
    "totalAmount": 1500000,
    "byMonth": [
      { "yearMonth": "2025-01", "amount": 500000 }
    ],
    "topVendors": [
      { "vendorName": "Sigma-Aldrich", "amount": 300000 }
    ],
    "topCategories": [
      { "category": "REAGENT", "amount": 400000 }
    ]
  }
  ```

**PATCH /api/quotes/[id]**
- 헤더: `x-guest-key` (필수)
- Body: `{ status: "PURCHASED" }`
- Quote의 items를 PurchaseRecord로 자동 변환
- 멱등성: quoteId로 중복 체크

#### UI Pages

**1. /dashboard-guest** (메인 대시보드)
- 3개 카드:
  - 이번 달 지출
  - 최근 30일 지출
  - Top 벤더
- guestKey 자동 생성/사용

**2. /dashboard-guest/purchases** (구매 내역 관리)
- Summary 카드: 총 지출, Top 벤더, Top 카테고리
- JSON 입력으로 구매 내역 추가
- 최근 구매 내역 테이블 (이번 달, 최대 20개)

#### Utility Functions

**apps/web/src/lib/guest-key.ts:**
```typescript
export function getGuestKey(): string
export function clearGuestKey(): void
```

### 3. 사용 방법

#### 구매 내역 추가 (JSON)
```json
[
  {
    "purchasedAt": "2025-01-15",
    "vendorName": "Sigma-Aldrich",
    "category": "REAGENT",
    "itemName": "Reagent A",
    "qty": 10,
    "unitPrice": 50000,
    "amount": 500000
  },
  {
    "purchasedAt": "2025-01-20",
    "vendorName": "Thermo Fisher",
    "category": "EQUIPMENT",
    "itemName": "Centrifuge",
    "qty": 1,
    "amount": 2000000
  }
]
```

#### Quote에서 구매 완료 처리
```typescript
// Frontend
const guestKey = getGuestKey();

await fetch(`/api/quotes/${quoteId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'x-guest-key': guestKey,
  },
  body: JSON.stringify({ status: 'PURCHASED' }),
});
```

### 4. 데이터베이스 마이그레이션

```bash
cd apps/web
npx prisma migrate dev
# 또는 수동으로:
# psql -d your_database < prisma/migrations/20241224_guestkey_scope/migration.sql
npx prisma generate
```

### 5. 완료 기준 체크리스트

✅ guestKey 기준으로 Purchase가 저장됨
✅ /dashboard-guest에서 합계가 보임
✅ Quote에서 "구매 완료 처리" 시 Purchase 생성 및 집계 반영
✅ 다른 브라우저(다른 guestKey)에서 데이터 분리 확인

### 6. 향후 확장 계획

#### 단기 (P2.1)
- [ ] CSV/XLSX 파일 업로드 지원
- [ ] 구매 내역 수정/삭제 기능
- [ ] 차트 시각화 (recharts)
- [ ] 필터링 UI 개선

#### 중기 (Workspace 도입)
```sql
-- scopeKey를 workspaceId로 변환
ALTER TABLE "PurchaseRecord" RENAME COLUMN "scopeKey" TO "workspaceId";
ALTER TABLE "Budget" RENAME COLUMN "scopeKey" TO "workspaceId";

-- FK 추가
ALTER TABLE "PurchaseRecord"
  ADD CONSTRAINT "PurchaseRecord_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id");
```

#### 장기
- [ ] 예산 초과 알림
- [ ] 구매 승인 워크플로우
- [ ] ERP 연동
- [ ] 조직별 권한 관리

## 테스트 시나리오

### 1. 신규 사용자 (guestKey 없음)
1. /dashboard-guest 접속
2. localStorage에 bioinsight_guest_key 자동 생성
3. 빈 대시보드 표시

### 2. 구매 내역 추가
1. /dashboard-guest/purchases 접속
2. JSON 데이터 입력
3. Import 버튼 클릭
4. 성공 메시지 확인
5. 테이블에 데이터 표시 확인

### 3. Quote에서 구매 완료
1. Quote 생성 (기존 플로우)
2. Quote 상태를 PURCHASED로 변경
3. x-guest-key 헤더 포함
4. PurchaseRecord 자동 생성 확인
5. 대시보드 집계 반영 확인

### 4. 다중 브라우저 격리
1. Chrome에서 구매 내역 추가
2. Firefox에서 동일 페이지 접속
3. 서로 다른 guestKey 생성 확인
4. 데이터 분리 확인

## 주의사항

1. **guestKey 손실**: localStorage 삭제 시 데이터 접근 불가
   - 향후 로그인 연동 시 guestKey → userId 마이그레이션 필요

2. **금액 타입**: Int로 저장 (소수점 없음, KRW 기준)
   - unitPrice, amount 모두 정수

3. **멱등성**: Quote → Purchase 변환 시 중복 생성 방지
   - quoteId로 기존 Purchase 체크

4. **필수 필드**:
   - amount 또는 (qty + unitPrice) 중 하나는 필수
   - purchasedAt, vendorName, itemName, qty, amount 필수

## 파일 구조

```
apps/web/
├── prisma/
│   ├── schema.prisma (업데이트)
│   └── migrations/
│       └── 20241224_guestkey_scope/
│           └── migration.sql
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── purchases/
│   │   │       ├── route.ts (GET)
│   │   │       ├── import/route.ts (POST)
│   │   │       └── summary/route.ts (GET)
│   │   └── dashboard-guest/
│   │       ├── page.tsx (메인 대시보드)
│   │       └── purchases/page.tsx (구매 내역)
│   └── lib/
│       └── guest-key.ts (guestKey 관리)
```

## 기술 스택

- **Database**: PostgreSQL + Prisma ORM
- **Backend**: Next.js App Router API Routes
- **Frontend**: React + TanStack Query
- **Validation**: Zod
- **UI**: shadcn/ui + Tailwind CSS
- **Storage**: localStorage (guestKey)
