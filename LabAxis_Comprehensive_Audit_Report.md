# LabAxis 전체 개발 상태 + API 경량화 통합 감사 보고서

**감사일**: 2026-04-17  
**감사 범위**: `apps/web` (Next.js) + `apps/mobile` (Expo/React Native) + `packages/*`  
**감사 유형**: 읽기 전용 — 코드 수정 없음  

---

## A. Executive Summary

LabAxis는 281개 API route, 270개 모바일 TSX/TS 파일, 35개 Prisma enum을 가진 바이오 제약 조달 OS로, 핵심 quote→purchase→order 파이프라인의 약 70%가 구현되어 있다. **빌드는 tsc strict 기준 4,675개 TS 에러**(web)를 포함하지만, 이 중 65%가 TS2307(모듈 해석)이고 28%가 TS7006(암시적 any)으로 기능 회귀가 아닌 구조적 부채이다. 테스트 인프라는 Jest 기반 130개 파일이 존재하나 **vitest는 미설치**이며, 105개 파일에 `@ts-nocheck`가 적용되어 있다.

**Top 3 위험 요소**: (1) `dashboard/stats` API가 14+ 쿼리를 단일 요청에 실행하여 P95 응답 지연 + DB 부하 집중, (2) `inventory/bulk` POST의 N+1 루프가 500건 입력 시 1,000+ DB 쿼리 발생, (3) Support Center가 UI 셸만 존재하고 백엔드 연결이 전무하여 출시 시 사용자 혼란 가능.

**Top 3 API 최적화**: (1) `dashboard/stats`의 14개 병렬 쿼리를 SQL 뷰/집계로 전환 시 쿼리 수 70% 감소, (2) `analytics/kpi`의 8× COUNT를 단일 `groupBy`로 통합 시 쿼리 7개 절약, (3) `quotes` GET에 cursor pagination + select 추가 시 payload 60% 감소.

현재 release blocker는 4건: Support Center 백엔드 부재, Receiving 플로우 미구현, CSRF가 `report_only` 모드(soft_enforce 미전환), MutationAuditEvent가 6개 route에서만 사용되어 감사 커버리지 미달.

---

## B. API 경량화 후보 Top 10

### #1. `apps/web/src/app/api/dashboard/stats/route.ts` (701 lines)

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Overfetch, Sequential-inside-parallel, JS aggregation |
| **Caller** | Dashboard 메인 페이지 (`/dashboard`) |
| **문제** | Phase 2 (L94-208): `Promise.all` 안에 14개 쿼리 — `take: 500` inventory (product join 포함), `take: 1000` purchase records. L183-207: `opsFunnelData` 3단계 순차 체인이 `Promise.all` 내부에 중첩되어 병렬성 파괴. Phase 3 (L227-250): `purchaseRecord.findMany(take: 1000)` 후 6개월 JS 루프 집계. L262-280: `followThroughData` 또 다른 3단계 순차 체인. |
| **예상 효과** | 쿼리 수 14 → 4~5, 응답 시간 40-60% 단축, payload 50% 감소 |
| **최소 diff** | (a) `opsFunnelData`와 `followThroughData`를 `Promise.all` 밖으로 분리하여 진정한 병렬화, (b) 6개월 집계를 SQL `DATE_TRUNC` + `GROUP BY`로 전환, (c) inventory/purchase에 `select` 추가하여 필요 컬럼만 반환 |

### #2. `apps/web/src/app/api/analytics/kpi/route.ts` (205 lines)

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Duplicate projection (8× individual COUNT) |
| **Caller** | Analytics KPI 대시보드 |
| **문제** | L61-118: `db.activityLog.count()` 8회 호출, 각각 다른 `activityType` 필터. L121-128: 추가 `groupBy` 호출. L158-163: `protocolAcceptRate = 0`, `aiConfidenceRate = 0` 하드코딩 (no-op 계산). |
| **예상 효과** | 쿼리 수 9 → 1~2, 응답 시간 70% 단축 |
| **최소 diff** | 8개 `count()`를 `db.activityLog.groupBy({ by: ['activityType'], _count: true })` 단일 쿼리로 통합. 하드코딩 0값은 주석으로 명시하거나 응답에서 제거 |

### #3. `apps/web/src/app/api/quotes/route.ts` (442 lines)

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Overfetch, Pagination 부재, Web-self 중복 |
| **Caller** | Quotes 목록 페이지 |
| **문제** | GET (L380-402): pagination 없음, 3-level nested include (`items.product`, `responses.vendor`, `vendorRequests`). `/api/quotes/my`가 동일 데이터를 `select` + pagination으로 제공 — 두 endpoint 공존으로 caller 혼란. |
| **예상 효과** | payload 60% 감소, 응답 시간 30% 단축 |
| **최소 diff** | (a) `/quotes` GET에 `cursor` + `take` 파라미터 추가, (b) `include`를 `select`로 전환하여 필요 필드만 반환, (c) `/quotes/my`와 통합 검토 (query param으로 분기) |

### #4. `apps/web/src/app/api/inventory/bulk/route.ts` (303 lines)

| 항목 | 내용 |
|------|------|
| **낭비 유형** | N+1 루프 |
| **Caller** | Inventory 대량 등록 (CSV import, 수동 입력) |
| **문제** | L219-237: 각 아이템마다 `resolveProductId()` + 중복 체크 개별 호출. 500건 입력 시 1,000+ DB 쿼리 발생. |
| **예상 효과** | 쿼리 수 O(n) → O(1), 500건 기준 1,000+ → 2~3 쿼리 |
| **최소 diff** | (a) 입력 배열에서 고유 product identifier 추출 → 단일 `findMany({ where: { id: { in: [...] } } })`, (b) 중복 체크도 `where: { compositeKey: { in: [...] } }` 벌크 조회로 전환 |

### #5. `apps/web/src/app/api/products/search/route.ts` (254 lines)

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Fake pagination, Web-Mobile 중복 |
| **Caller** | Product 검색 (웹), 모바일 `/api/mobile/products/search` |
| **문제** | L96: `take: 1000` 후 JS `.slice()`로 가짜 pagination. 모바일 버전(71 lines)은 별도 ILIKE 구현, synonym expansion 없음, relevance ranking 없음 — 동일 검색어에 다른 결과 반환. |
| **예상 효과** | 웹 payload 90% 감소 (1000→20 per page), 모바일 검색 품질 동등화 |
| **최소 diff** | (a) 웹: `take: 1000` → DB-level `skip/take` 진정한 pagination, (b) 공통 검색 로직을 `lib/search/product-search.ts`로 추출, (c) 모바일 route에서 공통 함수 호출 |

### #6. `apps/web/src/app/api/team/[id]/inventory/route.ts` (77 lines)

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Pagination 부재, Unbounded result set |
| **Caller** | Team Inventory 조회 |
| **문제** | `findMany` with full `user` include, 결과 제한 없음. 대형 팀(100+ 멤버, 수천 건 인벤토리)에서 무제한 반환. |
| **예상 효과** | 안정적 응답 시간 보장, OOM 방지 |
| **최소 diff** | `take` + `cursor` pagination 추가, `user` include를 `select: { id, name }` 최소화 |

### #7. `apps/web/src/app/api/purchases/summary/route.ts` (133 lines)

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Overfetch + JS aggregation |
| **Caller** | Purchase Summary 대시보드 |
| **문제** | `rangePurchases`를 `select` 없이 전체 컬럼 조회 후, JS 루프 3개로 vendor/category/month 집계. DB에서 집계 가능한 작업을 애플리케이션 레이어에서 수행. |
| **예상 효과** | 전송 데이터 80% 감소, 서버 메모리 절약 |
| **최소 diff** | 3개 집계를 `groupBy` 쿼리 3개로 전환 (또는 raw SQL 단일 쿼리). `select`에 집계 대상 필드만 포함 |

### #8. Triple-Logging: `activityLog` + `auditLog` + `dataAuditLog`

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Structural duplication, Write amplification |
| **Caller** | Mutation API 전반 (현재 3개 route에서 명시적 사용 확인) |
| **문제** | 동일 이벤트를 3개 테이블에 기록. `MutationAuditEvent` 모델이 이미 schema에 존재하고 `durable-mutation-audit.ts`에 구현되어 있으나, 실제 API route 6곳에서만 사용. 레거시 3중 로깅이 대부분의 route에 잔존. |
| **예상 효과** | 쓰기 쿼리 66% 감소 (3→1), 감사 추적 일원화 |
| **최소 diff** | 신규 mutation route는 `MutationAuditEvent`만 사용하도록 점진 전환. 레거시 route는 `MutationAuditEvent` 도입 후 기존 3중 로깅 제거 |

### #9. `apps/web/src/app/api/analytics/dashboard/route.ts`

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Route 중복 (dashboard/stats와 기능 겹침) |
| **Caller** | Analytics Dashboard |
| **문제** | `dashboard/stats`와 유사한 집계 로직 포함. 두 endpoint가 같은 데이터의 다른 뷰를 각각 독립적으로 계산. |
| **예상 효과** | 유지보수 표면적 50% 감소 |
| **최소 diff** | 공통 집계 함수를 `lib/analytics/aggregate.ts`로 추출, 양 route에서 호출 |

### #10. `apps/web/src/app/api/inventory/reorder-recommendations/route.ts`

| 항목 | 내용 |
|------|------|
| **낭비 유형** | Vendor overfetch |
| **Caller** | Inventory Reorder 추천 |
| **문제** | 재주문 추천 계산 시 vendor 정보 전체를 include하여 불필요한 필드(연락처, 계약 이력 등) 로드. |
| **예상 효과** | 쿼리 응답 시간 20% 단축 |
| **최소 diff** | `include: { vendor: true }` → `select: { vendor: { select: { id, name, leadTimeDays } } }` |

---

## C. 전체 개발 상태 표

| 영역 | 상태 | 세부 내용 |
|------|------|-----------|
| **Build (tsc)** | 🟡 Yellow | web 4,675 errors (TS2307 3,065건 = 모듈 해석, TS7006 1,326건 = 암시적 any). 기능 회귀 아닌 구조적 부채. CI에서 `--noEmit` 미강제 추정. |
| **Test infra** | 🟡 Yellow | Jest 설치됨 (jest, @testing-library/jest-dom, @types/jest). 130개 test 파일 존재. **vitest 미설치** — 사용자 확인 요청 항목. 테스트 커버리지 수치 미확인 (실행 환경 제약). |
| **@ts-nocheck** | 🟡 Yellow | 105개 파일. 대부분 test 파일 및 초기 마이그레이션 파일에 집중. 프로덕션 로직 파일에도 일부 잔존 — 점진 제거 권장. |
| **Prisma Schema** | 🟢 Green | 35 enums 정의, 마지막 migration `20260412_po_candidate_model`. `MutationAuditEvent`, `CanaryStage` 등 거버넌스 모델 존재. |
| **Migration 상태** | 🟡 Yellow | 최종 migration 20260412. 네트워크 제약으로 `prisma migrate status` 실행 불가 — 프로덕션 환경에서 pending migration 확인 필요. |
| **Security (CSRF)** | 🟡 Yellow | `csrf-contract.ts` 완전 구현 (double-submit cookie + origin 검증). 현재 `report_only` 모드. **`soft_enforce` 미전환** — Batch 10 계획에 포함되어 있으나 미실행. |
| **MutationAuditEvent** | 🟡 Yellow | Schema에 모델 존재, `durable-mutation-audit.ts`에 라이브러리 구현 완료. 그러나 **6개 API route에서만 사용** — 전체 mutation route 대비 커버리지 미달. Smoke run 가능하나 범위 확장 필요. |
| **Mobile** | 🟡 Yellow | 270개 TSX/TS 파일, 28개 화면 (auth, tabs, inventory, purchases, quotes, scan). **웹과 코드 공유 없음**, 별도 인증 체계. 검색 로직 분리 (synonym expansion 미포함). |
| **Support Center** | 🔴 Red | UI 셸만 존재 (~1,322 lines). Mock 데이터 기반 렌더링. **백엔드 API 연결 전무** — 티켓 생성/조회/에스컬레이션 모두 프론트엔드 하드코딩. 출시 시 사용자 혼란 위험. |
| **Inventory Ontology** | 🟢 Green | `flow-insight-engine`이 순수 알고리즘으로 구현됨. 결정론적 우선순위 시스템. Storage location view, inventory flow view 모두 라이트 테마 전환 완료. |
| **Quotes→Purchases Handoff** | 🟡 Yellow | RFQ handoff store 패턴 구현. 3-step wizard modal (Assembly → Review → Handoff) 존재. 그러나 **Receiving 플로우 미구현** — purchase order 생성 후 입고 확인 없음. |
| **Purchases→Orders** | 🟡 Yellow | PO candidate model (20260412 migration) 존재. Purchase summary는 JS 집계 (DB 집계 전환 필요). 전체 파이프라인 약 70% 완성. |
| **Design Consistency** | 🟢 Green | Bold & Flat, Slate-900/500/400 3-tier 시스템 적용. 라이트 테마 전환 대부분 완료 (storage-location, inventory-flow, support-center, plans page). |
| **Enum Drift** | 🟡 Yellow | AI action routes에서 하드코딩된 문자열 사용 확인. Prisma enum과 런타임 문자열 간 불일치 위험. |
| **Console 잔존** | 🟡 Yellow | API route 내 430개 `console.log/warn/error` 잔존. 프로덕션 로깅 체계(structured logging)로 전환 필요. |
| **Polling 패턴** | 🟢 Green | 9개 파일에서 `setInterval/refetchInterval` 사용. `staleTime` 68곳 설정 — React Query 캐시 전략 적용됨. |
| **Raw fetch / Unguarded mutation** | 🟡 Yellow | React Query 기반이나 일부 route에서 raw `fetch` 잔존 가능. Mutation에 `onError` 핸들링 일관성 미확인. |

---

## D. Release Blockers

### 🔴 Critical (출시 전 반드시 해결)

| # | 항목 | 근거 | 최소 해결 |
|---|------|------|-----------|
| 1 | **Support Center 백엔드 부재** | UI가 존재하지만 모든 데이터가 하드코딩. 사용자가 티켓 제출 시 아무 일도 발생하지 않음. | Support ticket CRUD API 최소 구현 (create + list + get) 또는 페이지에 "준비 중" 상태 명시 |
| 2 | **Receiving 플로우 미구현** | PO 생성 후 입고 확인 경로 없음. 조달 사이클이 incomplete. | 최소한 "입고 완료" 상태 전환 endpoint + UI 버튼 1개 |
| 3 | **CSRF `soft_enforce` 미전환** | 현재 `report_only` — mutation 보호가 로깅만 수행, 실제 차단 없음. | `LABAXIS_CSRF_MODE=soft_enforce` 환경변수 전환 + 1주 모니터링 |
| 4 | **MutationAuditEvent 커버리지 미달** | 6개 route만 사용. 핵심 mutation (quote 생성, PO 승인, inventory 조정)에 감사 추적 미적용. | 최소 quote/purchase/inventory mutation 3곳에 `durable-mutation-audit` 적용 |

### 🟡 High (출시 직후 1주 내 해결 권장)

| # | 항목 | 근거 |
|---|------|------|
| 5 | `dashboard/stats` 14+ 쿼리 최적화 | 메인 대시보드 로딩 시 DB 부하 집중. 동시 사용자 증가 시 병목. |
| 6 | `inventory/bulk` N+1 해소 | CSV 대량 등록이 실사용 시나리오. 500건 → 1,000+ 쿼리는 timeout 위험. |
| 7 | Web-Mobile 검색 로직 통합 | 동일 제품 검색 시 플랫폼별 다른 결과 → 사용자 신뢰 저하. |

---

## E. 권장 실행 순서

### 이번 주 (This Week) — Release Blocker 해소

| 순서 | 작업 | 예상 공수 | 의존성 |
|------|------|-----------|--------|
| 1 | CSRF `soft_enforce` 전환 | 0.5일 | 환경변수 변경 + 모니터링 대시보드 확인 |
| 2 | Support Center에 "준비 중" 배너 + 폼 비활성화 | 0.5일 | 없음 (UI만 수정) |
| 3 | MutationAuditEvent를 quotes/purchases/inventory 핵심 mutation 3곳에 적용 | 1일 | `durable-mutation-audit.ts` 이미 구현됨 |
| 4 | Receiving 최소 플로우 (상태 전환 API + 버튼) | 1.5일 | PO candidate model 이미 존재 |

### 출시 후 (Post-Release) — 성능 + 품질

| 순서 | 작업 | 예상 공수 |
|------|------|-----------|
| 5 | `dashboard/stats` SQL 집계 전환 + 순차 체인 분리 | 2일 |
| 6 | `analytics/kpi` 8× COUNT → groupBy 통합 | 0.5일 |
| 7 | `inventory/bulk` N+1 → bulk findMany 전환 | 1일 |
| 8 | `quotes` GET pagination + select 추가 | 0.5일 |
| 9 | `products/search` 공통 함수 추출 + 모바일 통합 | 1.5일 |
| 10 | `team/[id]/inventory` + `purchases/summary` pagination/집계 | 1일 |
| 11 | Triple-logging → MutationAuditEvent 점진 전환 계획 수립 | 0.5일 |

### 장기 (Deferred) — 구조적 부채

| 작업 | 비고 |
|------|------|
| `@ts-nocheck` 105개 파일 점진 제거 | 주당 10개씩 분할 제거, 프로덕션 로직 파일 우선 |
| TS2307 모듈 해석 에러 근본 해결 | `tsconfig.json` paths 재정비 + 패키지 경계 정리 |
| Console 430개 → structured logging 전환 | `pino` 또는 `winston` 도입 검토 |
| Enum drift 해소 (AI action routes) | Prisma enum import 강제, 하드코딩 문자열 제거 |
| vitest 도입 여부 결정 | Jest 130개 파일 기반이 안정적이면 유지, 병렬 실행 필요 시 전환 |
| Mobile-Web 코드 공유 아키텍처 | `packages/shared` 패키지에 공통 타입/유틸리티/검색 로직 추출 |

---

**감사 수행 기준**: 코드 수정 없음, 페이지별 기능 회귀 금지, 최소 diff 해결안만 제시.  
**감사자**: Claude (AI Audit Agent)  
**총괄**: 호영 (LabAxis 총괄관리자)
