# Purchase History & Budget Dashboard MVP Implementation

## Overview
Team plan 핵심 기능: 조직의 월별 구매내역 관리 및 예산/지출 대시보드

## 완료된 작업

### 1. Database Schema (Prisma)
**위치:** `apps/web/prisma/schema.prisma`

#### PurchaseRecord Model
- `organizationId` (required): 조직 스코프
- `purchasedAt`: 구매 날짜
- `vendorName`: 벤더 이름 (denormalized)
- `vendorId`: 벤더 참조 (optional)
- `category`: 제품 카테고리
- `itemName`: 제품명
- `catalogNumber`: 카탈로그 번호
- `unit`: 단위 (ea, mL, g 등)
- `quantity`: 수량
- `unitPrice`: 단가
- `amount`: 총액
- `currency`: 통화 (기본값: "KRW")
- `source`: IMPORT | QUOTE (구매 출처)
- `quoteId`: Quote 연결 (optional)
- `importedBy`: 업로드한 사용자

**인덱스:**
- organizationId + purchasedAt
- vendorName
- category

#### Budget Model
- `organizationId` (required): 조직 스코프
- `yearMonth`: "YYYY-MM" 형식 (예: "2025-01")
- `amount`: 예산 금액
- `currency`: 통화 (기본값: "KRW")
- `description`: 설명

**Unique 제약:** `(organizationId, yearMonth)`

#### QuoteStatus Enum
추가된 값: `PURCHASED` (구매 완료 처리)

### 2. API Endpoints

#### POST /api/purchases/import
CSV 데이터를 파싱하여 PurchaseRecord 생성
- **입력:** `{ csvText, organizationId }`
- **컬럼 자동 매핑:** date, vendor, category, item, quantity, unitPrice, amount
- **출력:** `{ successCount, errorCount, successRows, errorRows }`
- **검증:** zod schema
- **에러 처리:** row별 에러 샘플 반환

**위치:** `apps/web/src/app/api/purchases/import/route.ts`

#### GET /api/purchases/summary
조직의 구매 집계 데이터 반환
- **쿼리 파라미터:** `organizationId`, `from`, `to`
- **반환 데이터:**
  - `summary`: totalSpending, totalPurchases, currentMonthSpending, yearToDate
  - `topVendors`: 벤더별 집계 (상위 10개)
  - `topCategories`: 카테고리별 집계 (상위 10개)
  - `monthlyTrend`: 월별 추이

**위치:** `apps/web/src/app/api/purchases/summary/route.ts`

#### PATCH /api/quotes/[id]
Quote 상태를 "PURCHASED"로 변경하면 자동으로 PurchaseRecord 생성
- **멱등성 보장:** quoteId로 중복 체크
- **조직 ID 필수:** PurchaseRecord는 조직 스코프 필요
- **이메일 발송:** 구매 완료 알림

**위치:** `apps/web/src/app/api/quotes/[id]/route.ts`

#### GET/POST /api/budgets
월별 예산 조회 및 생성/수정
- **GET:** 조직별 예산 목록 + 사용률 계산
- **POST:** yearMonth 기준 upsert (unique constraint 활용)

**위치:** `apps/web/src/app/api/budgets/route.ts`

### 3. UI Components

#### /dashboard/purchases
구매 내역 관리 페이지
- **조직 선택:** 드롭다운
- **요약 카드:**
  - 이번 달 지출
  - YTD 지출
  - Top vendor
- **CSV 업로드:** 텍스트 붙여넣기 방식
- **Top Vendors 테이블:** 벤더별 집계
- **Top Categories 테이블:** 카테고리별 집계

**위치:** `apps/web/src/app/dashboard/purchases/page.tsx`

#### /dashboard/budget
월별 예산 관리 페이지 (기존 코드 재활용, API만 업데이트)
- **예산 카드:** 사용률, 잔여 금액 표시
- **진행바:** 예산 대비 사용률 시각화
- **경고/초과 표시:** 80% 이상 경고, 100% 이상 초과

**위치:** `apps/web/src/app/dashboard/budget/page.tsx`

#### Dashboard Sidebar 업데이트
"구매 내역" 메뉴 항목 추가

**위치:** `apps/web/src/app/_components/dashboard-sidebar.tsx`

### 4. Migration
데이터베이스 마이그레이션 SQL 파일 생성
- PurchaseRecord 스키마 변경
- Budget 스키마 변경
- 인덱스 생성

**위치:** `apps/web/prisma/migrations/20241224_add_purchase_and_budget_models/migration.sql`

## 사용 방법

### 1. 데이터베이스 마이그레이션 실행
```bash
cd apps/web
npx prisma migrate dev
```

### 2. CSV Import 예시
```csv
date,vendor,item,quantity,unitPrice,amount,category
2025-01-15,Sigma-Aldrich,Reagent A,10,50000,500000,REAGENT
2025-01-20,Thermo Fisher,Equipment B,1,2000000,2000000,EQUIPMENT
```

### 3. Quote에서 구매 완료 처리
```typescript
// Quote 상태를 PURCHASED로 변경하면 자동으로 PurchaseRecord 생성
PATCH /api/quotes/{quoteId}
{
  "status": "PURCHASED"
}
```

### 4. 예산 설정
```typescript
POST /api/budgets
{
  "organizationId": "org_123",
  "yearMonth": "2025-01",
  "amount": 10000000,
  "currency": "KRW",
  "description": "2025년 1월 예산"
}
```

## 완료 기준 확인

✅ CSV 1개 업로드하면 Purchase가 저장되고 summary API가 집계를 반환
✅ Quote에서 "구매 완료 처리"하면 Purchase가 생성되고 대시보드 집계에 반영
✅ workspace(organization) 스코프가 있으면 다른 workspace 데이터는 보이지 않음

## 주요 특징

1. **간단한 CSV Import:** 컬럼 자동 매핑, row별 에러 리포트
2. **Quote 연동:** 견적서에서 바로 구매 완료 처리 가능
3. **월별 예산 관리:** yearMonth 기준 단순화된 예산 관리
4. **실시간 집계:** 벤더/카테고리/월별 자동 집계
5. **조직 스코프:** 모든 데이터는 organizationId로 격리

## 다음 단계 (선택 사항)

- [ ] CSV 파일 업로드 (현재는 텍스트 붙여넣기만 지원)
- [ ] Excel 파일 지원
- [ ] 차트 시각화 (recharts 활용)
- [ ] 예산 초과 알림
- [ ] 구매 승인 워크플로우
- [ ] ERP 연동
