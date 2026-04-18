# LabAxis API 경량화 감사 보고서

**작성일**: 2026-04-16  
**대상**: `apps/web/src/app/api/` — 총 281개 route  
**범위**: 코드 수정 없음 (읽기 전용 감사)  
**우선 도메인**: inventory / quotes / purchases / orders / search / dashboard / analytics

---

## 전체 인벤토리 요약

| 도메인 | route 수 | 주요 이슈 건수 |
|--------|---------|-------------|
| inventory (재고) | 18 | 5 |
| quotes (견적) | 21 | 4 |
| purchases (구매) | 8 | 2 |
| orders (주문) | 3 | 2 |
| search (검색) | 4 | 3 |
| dashboard / analytics | 12 | 4 |
| recommendations | 6 | 2 |
| 기타 (billing, org, vendor 등) | 209 | — |

---

## Top 10 우선순위 후보

---

### #1. `GET /api/dashboard/stats` — 단일 요청에 14+ DB 쿼리

**파일**: `app/api/dashboard/stats/route.ts` (701줄)  
**낭비 유형**: Overfetch + N+1 체인 + Pagination 부재  
**Caller**: 대시보드 메인 (`/dashboard` 페이지 → `useQuery(["dashboard-stats"])`)

**문제 상세**:
- Phase 2 (L94-208): `Promise.all` 안에 14개 쿼리를 동시 발사. `allInventories`는 `take: 500`으로 product join 포함, `purchaseRecord.findMany(take: 1000)` 등 대형 fetch.
- L183-207: `opsFunnelData` 내부에서 `quote.findMany → order.findMany → inventoryRestock.findMany` 3단 순차 쿼리가 Promise.all 안에 중첩 (병렬성 파괴).
- Phase 3 (L227-250): `purchaseRecord.findMany(take: 1000)` — 6개월치 구매이력 전량 fetch 후 JS에서 월별 집계.
- L262-280: `followThroughData` 역시 순차 3단 쿼리 (`order.findMany → inventoryRestock.findMany`).

**예상 효과**: 대시보드 초기 로딩 TTFB 40-60% 개선 (DB connection pool 압박 해소)  
**최소 diff 해결안**:
1. `purchaseRecord` 월별 집계 → Prisma `groupBy({ by: ["yearMonth"], _sum: { amount: true } })` 치환 (1000행 fetch → 6행 groupBy)
2. `opsFunnelData` 3단 순차 쿼리 → `$queryRaw` 단일 SQL (JOIN 3회) 또는 최소 `Promise.all`로 분리
3. `allInventories(take: 500)` → 만료 임박 필터 추가하여 반환량 제한 (`expiryDate` 조건)

---

### #2. `GET /api/analytics/kpi` — activityLog에 8회 개별 COUNT

**파일**: `app/api/analytics/kpi/route.ts` (205줄)  
**낭비 유형**: N+1 (8×COUNT) + 하드코딩  
**Caller**: 분석 대시보드 (`analytics/kpi` → `useQuery(["kpi"])`)

**문제 상세**:
- L61-118: `db.activityLog.count()`를 `activityType` 별로 8회 개별 호출 (SEARCH_PERFORMED, PRODUCT_COMPARED, QUOTE_CREATED 등).
- L121-128: 이후 다시 `groupBy(["userId"])` 호출 — 동일 테이블 9번째 접근.
- L137-144: 또 `groupBy(["userId"])` 7일 범위 — 10번째 접근.
- L158-163: `protocolAcceptRate = 0`, `aiConfidenceRate = 0` 하드코딩 — 실질 no-op 필드.

**예상 효과**: 10개 쿼리 → 2개 쿼리로 축소 (80% DB 라운드트립 감소)  
**최소 diff 해결안**:
```ts
// Before: 8× count() 개별 호출
// After: 단일 groupBy
const counts = await db.activityLog.groupBy({
  by: ["activityType"],
  where: { createdAt: { gte: startDate } },
  _count: true,
});
// → Map으로 변환 후 각 타입별 추출
```
`protocolAcceptRate`, `aiConfidenceRate` 필드는 제거하거나 TODO 주석 명시.

---

### #3. `GET /api/quotes` — Pagination 완전 부재 + Nested Include

**파일**: `app/api/quotes/route.ts` (442줄, GET: L337-442)  
**낭비 유형**: Pagination 부재 + Overfetch  
**Caller**: 견적 관리 목록 (`/dashboard/quotes` → `useQuery(["quotes"])`)

**문제 상세**:
- L380-402: `db.quote.findMany()` — `take`/`skip` 없음. 사용자의 **전체 견적**을 한 번에 로드.
- `include.items.include.product`, `include.responses.include.vendor`, `include.vendorRequests` — 3단 nested include.
- 동일 사용자 `/api/quotes/my`는 `select` + offset/limit 사용 (L86-108). 두 엔드포인트가 같은 데이터를 다른 방식으로 반환.

**예상 효과**: 견적 50개+ 사용자에서 payload 70%+ 축소, DB 응답 시간 50%+ 개선  
**최소 diff 해결안**:
1. `page`/`limit` 파라미터 추가 (default: 20, max: 100)
2. `include.responses` → `_count: { responses: true }` 요약 (목록에서 상세 불필요)
3. `/api/quotes/my`와 통합 검토 — `mode=summary|detail` 파라미터로 분기

---

### #4. `POST /api/inventory/bulk` — N+1 제품 조회 루프

**파일**: `app/api/inventory/bulk/route.ts` (303줄)  
**낭비 유형**: N+1  
**Caller**: 재고 일괄 등록 (`inventory-content.tsx` → 엑셀 업로드 후 커밋)

**문제 상세**:
- L219-237: `for (let i = 0; i < items.length; i++)` 루프에서 매 항목마다:
  - `resolveProductId()` → `db.product.findFirst()` (L225)
  - `db.productInventory.findFirst({ where: { organizationId, productId } })` 중복 체크 (L240-243)
- 500개 항목 업로드 시 → 최소 1,000회 DB 쿼리.

**예상 효과**: 500개 벌크 등록 시 DB 쿼리 1000회 → 3회로 축소 (99.7% 감소)  
**최소 diff 해결안**:
```ts
// Before: 루프 내 개별 findFirst
// After: 배치 조회
const allCatalogNumbers = items.map(i => i.catalogNumber).filter(Boolean);
const existingProducts = await db.product.findMany({
  where: { catalogNumber: { in: allCatalogNumbers } },
  select: { id: true, catalogNumber: true },
});
const productMap = new Map(existingProducts.map(p => [p.catalogNumber, p.id]));

const existingInventories = await db.productInventory.findMany({
  where: { organizationId, productId: { in: [...productMap.values()] } },
  select: { productId: true },
});
const existingSet = new Set(existingInventories.map(i => i.productId));
```

---

### #5. `GET /api/products/search` vs `GET /api/mobile/products/search` — Web-Mobile 중복 + 가짜 페이지네이션

**파일 (Web)**: `app/api/products/search/route.ts` (254줄)  
**파일 (Mobile)**: `app/api/mobile/products/search/route.ts` (71줄)  
**낭비 유형**: Web-Mobile 중복 + Overfetch + Contract Drift  
**Caller**: Web 검색 (`/search` 페이지), Mobile 검색 (`SearchScreen`)

**문제 상세**:
- **Web L96**: `take: 1000` — 1000개 전량 fetch 후 JS에서 `slice(start, start+limit)`. 실제 결과가 1000개 초과 시 누락.
- **Mobile**: 독자적 ILIKE 4개 조건 검색 (L43-50). Web의 `expandQueryWithSynonyms()`, `sortByRelevance()` 전혀 적용 안 됨.
- **Contract Drift**: Web은 vendors/grade/specification 포함, Mobile은 id/name/brand/catalogNumber만 반환.
- `/api/search/route.ts`는 더미 데이터 기반 legacy endpoint — 아직 존재하나 실사용 불명.

**예상 효과**: 공통 검색 엔진 추출로 모바일 검색 품질 동등화 + DB fetch 80% 감소  
**최소 diff 해결안**:
1. `lib/search/search-query-builder.ts` 추출 — `buildProductSearchQuery(query, filters)` 공통 함수
2. Web: `take: 1000` → 실제 offset/limit을 Prisma `skip`/`take`로 이관
3. Mobile: 공통 builder import 후 `select` 필드만 축소
4. `/api/search` legacy route 삭제 검토

---

### #6. `GET /api/team/[id]/inventory` — Pagination 완전 부재

**파일**: `app/api/team/[id]/inventory/route.ts` (77줄)  
**낭비 유형**: Pagination 부재 + Overfetch  
**Caller**: 팀 재고 뷰 (`/dashboard/inventory` → 팀 탭)

**문제 상세**:
- L46-65: `db.userInventory.findMany()` — `take`/`skip` 없음.
- `include: { user: { select: { id, name, email, image } } }` — 팀원 5명 × 재고 50건 = 250건 + user join.
- 팀원 100명 × 재고 100건 = 10,000건 무제한 반환 가능.
- L21-28: 팀 멤버 확인 `findUnique` → `select` 없이 전체 컬럼 fetch.

**예상 효과**: 대형 팀에서 응답 시간 10배 이상 단축 가능  
**최소 diff 해결안**:
```ts
const page = parseInt(searchParams.get("page") ?? "1");
const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
// findMany에 추가:
take: limit,
skip: (page - 1) * limit,
```
멤버 확인: `select: { id: true }` 추가.

---

### #7. `GET /api/purchases/summary` — rangePurchases 전체 fetch 후 JS 집계

**파일**: `app/api/purchases/summary/route.ts` (133줄)  
**낭비 유형**: Overfetch + Client-Side Aggregation  
**Caller**: 구매 대시보드 (`/dashboard/purchases` → `useQuery(["purchase-summary"])`)

**문제 상세**:
- L60-62: `rangePurchases` — `select` 없이 전체 컬럼 fetch (`vendorName`, `category`, `itemName`, `unit`, `qty` 등 불필요 필드 포함).
- L82-112: JS에서 `for...of` 루프로 vendor별/category별/월별 집계 3회 순회.
- 선택 범위가 1년이면 수천 건의 전체 레코드를 메모리에 로드.

**예상 효과**: 메모리 사용량 80% 감소, 응답 시간 60% 단축  
**최소 diff 해결안**:
```ts
// Before: findMany 후 JS 루프
// After: Prisma groupBy
const [topVendors, topCategories, byMonth] = await Promise.all([
  db.purchaseRecord.groupBy({
    by: ["vendorName"],
    where: ownerWhere,
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  }),
  db.purchaseRecord.groupBy({
    by: ["category"],
    where: ownerWhere,
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  }),
  // 월별은 $queryRaw로 DATE_TRUNC 사용
]);
```

---

### #8. Triple-Logging 중복 — activityLog / auditLog / dataAuditLog

**파일**:
- `app/api/activity-logs/route.ts` (227줄) — `activityLog` 테이블
- `app/api/audit-logs/route.ts` — `auditLog` 테이블
- `app/api/data-audit-logs/route.ts` — `dataAuditLog` 테이블  
**낭비 유형**: Duplicate Projection (저장소 낭비 + 쿼리 분산)  
**Caller**: AI 액션 경로에서 3개 테이블에 동시 기록

**문제 상세**:
- AI action route들이 `createActivityLog()` + `createAuditLog()`를 동일 이벤트에 동시 호출.
- `dataAuditLog`는 Prisma middleware 레벨에서 CRUD 변경 시 자동 기록 — 위 2개와 대상 이벤트 중복.
- 결과: "견적 생성" 1건이 3개 테이블에 각각 INSERT.
- 분석 시 `analytics/kpi`는 `activityLog`만, `audit-logs` 페이지는 `auditLog`만 사용 → 데이터 파편화.

**예상 효과**: 쓰기 I/O 66% 감소, 감사 추적 신뢰도 향상  
**최소 diff 해결안**:
1. 단기: `createAuditLog()` 호출부에서 `activityLog`와 중복되는 이벤트 타입 제거 (QUOTE_CREATED 등)
2. 중기: `auditLog` → `activityLog`에 `source: "ai"|"user"|"system"` 필드 추가하여 통합
3. `dataAuditLog`는 Prisma middleware로 자동 생성이므로 범위 축소 (PII 변경만)

---

### #9. `GET /api/analytics/dashboard` vs `GET /api/dashboard/stats` — 80% 중복 투영

**파일**: `app/api/analytics/dashboard/route.ts` (174줄)  
**파일**: `app/api/dashboard/stats/route.ts` (701줄)  
**낭비 유형**: Duplicate Projection  
**Caller**: 분석 페이지 (`/dashboard/analytics`), 메인 대시보드 (`/dashboard`)

**문제 상세**:
- 두 route 모두 `purchaseRecord`를 날짜 범위별로 fetch하고, 카테고리별 집계 수행.
- 두 route 모두 예산 사용률, 최근 구매 top 5, 월별 추이 계산.
- `analytics/dashboard`(174줄)는 `dashboard/stats`(701줄)의 경량 서브셋이지만 독자적 Prisma 쿼리 보유.
- 동일 세션에서 두 페이지 탐색 시 같은 데이터를 2번 fetch.

**예상 효과**: 엔드포인트 통합으로 유지보수 비용 50% 감소  
**최소 diff 해결안**:
1. `dashboard/stats`에 `?scope=full|summary` 파라미터 추가
2. `analytics/dashboard` route는 `dashboard/stats?scope=summary`로 redirect 또는 삭제
3. 클라이언트에서 `staleTime: 60_000`으로 React Query 캐시 공유

---

### #10. `GET /api/inventory/reorder-recommendations` — Vendor 전체 컬럼 Overfetch

**파일**: `app/api/inventory/reorder-recommendations/route.ts` (113줄)  
**낭비 유형**: Overfetch  
**Caller**: 재고 관리 → 재주문 추천 (`inventory-content.tsx`)

**문제 상세**:
- L24-35: `product.vendors` include 시 `vendor` 전체 객체 (name, address, contactEmail, tier, createdAt 등) 로드.
- 실제 사용하는 필드: vendor.name + priceInKRW 뿐.
- 100개 재고 × 5개 공급사 = 500개 vendor 레코드의 불필요 필드 전송.
- 동일 패턴이 `/api/inventory/auto-reorder`(L42-53)에도 반복.

**예상 효과**: 응답 payload 60% 축소  
**최소 diff 해결안**:
```ts
// Before
include: { vendor: true }
// After
include: { vendor: { select: { id: true, name: true } } }
```
`auto-reorder` route에도 동일 적용.

---

## 우선순위 매트릭스

| 순위 | Route | 낭비 유형 | 영향 범위 | 난이도 | ROI |
|------|-------|----------|----------|-------|-----|
| 1 | `/api/dashboard/stats` | Overfetch + N+1 체인 | 전 사용자 (매 로그인) | 중 | ★★★★★ |
| 2 | `/api/analytics/kpi` | N+1 (8×COUNT) | 분석 페이지 | 하 | ★★★★★ |
| 3 | `/api/quotes` GET | Pagination 부재 | 견적 관리 전체 | 하 | ★★★★☆ |
| 4 | `/api/inventory/bulk` | N+1 루프 | 벌크 등록 | 중 | ★★★★☆ |
| 5 | `/api/products/search` + mobile | Web-Mobile 중복 | 검색 전체 | 중 | ★★★★☆ |
| 6 | `/api/team/[id]/inventory` | Pagination 부재 | 팀 재고 | 하 | ★★★☆☆ |
| 7 | `/api/purchases/summary` | Overfetch + JS 집계 | 구매 대시보드 | 하 | ★★★☆☆ |
| 8 | Triple-Logging | Duplicate Projection | 전체 쓰기 I/O | 중 | ★★★☆☆ |
| 9 | `analytics/dashboard` vs `dashboard/stats` | Duplicate Projection | 분석+대시보드 | 하 | ★★☆☆☆ |
| 10 | `inventory/reorder-recommendations` | Overfetch | 재주문 추천 | 하 | ★★☆☆☆ |

---

## 추가 관찰 (Top 10 외)

- **`/api/orders` GET (L390-405)**: `budgetTransaction: true` — 주문별 전체 트랜잭션 이력 무제한 로드. `take: 1` 추가 필요.
- **`/api/admin/orders` POST**: budget 차감 시 `SELECT FOR UPDATE` 락 누락 (vs `/api/orders`는 사용) — 동시성 race condition 위험.
- **`/api/quotes/cost-optimization`**, **`/api/quotes/optimize-combination`**: 클라이언트 caller 미발견 — Dead endpoint 의심.
- **`/api/dashboard/layout` POST**: 레이아웃 저장 로직 미구현 (`// 임시` 주석) — No-op.
- **`/api/inventory/alerts/send`**, **`/api/cron/inventory-check`**: 클라이언트 caller 미발견 — cron 전용이면 문서화 필요.
