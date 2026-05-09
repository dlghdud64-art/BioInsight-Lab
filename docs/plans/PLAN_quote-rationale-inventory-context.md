# Implementation Plan: #quote-rationale-inventory-context (호영님 5/8 킬러 피처)

- **Status:** ✅ Complete (Phase 1 + 2 + 3 all GREEN — cluster CLOSE)
- **Started:** 2026-05-09
- **Last Updated:** 2026-05-09

---

## 호영님 6 결정 (권장안 그대로)

| # | 결정 | 선택 |
|---|---|---|
| 1 | 적용 범위 | **A. 인과관계 한 줄 enhance** (메시지 끝에 inventory tail append) |
| 2 | low-stock 임계 | **C. safetyStock OR 소진속도** (둘 중 하나만 만족해도 trigger) |
| 3 | leadTime source | **C. ProductInventory.leadTimeDays 우선 + ProductVendor.leadTime fallback** |
| 4 | 메시지 priority | **A. append** (인과관계 base 위에 보조 정보) |
| 5 | data source | **A. /api/inventory useQuery** (org scope, 1+2단계 패턴) |
| 6 | land scope | **A. Phase 1 (helper 추출) → Phase 2 (caller wiring + inventory fetch) → Phase 3 (smoke)** |

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- §11.221/222 인과관계 한 줄 (current 6-case)
- ProductInventory schema (line 780~) — currentQuantity / safetyStock / averageDailyUsage / leadTimeDays / expiryDate
- /api/inventory GET endpoint (organizationId scope 가능)
- 호영님 5/8 결론: "재고 연동 = 진짜 킬러 피처"

**Conflicts:** 없음.

**Chosen Source of Truth:** ProductInventory (org scope) 우선 + ProductVendor.leadTime fallback.

---

## 1. Priority Fit

- [x] **Post-release** (사업 차별점 핵심)

---

## 2. Work Type

- [x] Feature + Workflow/Ontology Wiring

---

## 3. Overview

**Description:** §11.221/222 인과관계 한 줄 base 위에 "재고 잔여 일수 + 예상 수령일" tail append. inventory 0건 시 fallback (기존 메시지 그대로). 호영님 5/8 합의의 "킬러 피처" 단계.

**Success Criteria:**
- [ ] Phase 1: `buildBriefRationaleSummary` helper 별도 file + 6-case 보존 + inventoryContext optional input + unit test
- [ ] Phase 2: quotes/page.tsx 의 desktop + mobile 인라인 IIFE → helper call. /api/inventory useQuery + quote.items × inventory 매칭 + mostUrgent 추출 → helper 에 forward
- [ ] Phase 3: smoke + ADR

**Out of Scope (절대 구현 X):**
- expiryDate 임박 분기 (별도 트랙)
- inventory CRUD UI 변경 (이미 dashboard/inventory 존재, 본 작업 무관)
- vendor leadTime 글로벌 평균 산출 (현재는 평균 없이 첫 vendor.leadTime 사용)

**User-Facing Outcome:**
- inventory 등록된 product 가 quote.items 에 있고 low-stock 매칭 시: "📋 견적 미발송 → 비교·발주 차단 중. 발송이 첫 단계입니다. ⏰ FBS 5일분 남음 / 예상 수령일 +5일"
- inventory 미등록 또는 매칭 0: 기존 메시지 그대로 (graceful fallback)

---

## 4. Product Constraints

**Must Preserve:** workbench/queue/rail/dock, same-canvas, canonical truth, §11.221/222 6-case 패턴.

**Must Not Introduce:** page-per-feature, dead button, AI/chatbot UI, helper drift (desktop/mobile sync).

**Canonical Truth Boundary:**
- Source of Truth: ProductInventory (org scope) + ProductVendor.leadTime
- Derived Projection: helper output (string) — UI 변형 0
- Persistence Path: 변경 0 (read-only data)

**UI Surface:** 기존 §11.221 desktop + §11.222 mobile region — 메시지 tail 만 변경.

---

## 5. Architecture

| Decision | Rationale | Trade-offs |
|---|---|---|
| 별도 helper file `lib/operational-brief/build-rationale.ts` | desktop + mobile duplicate 제거 (§11.221/222 cluster 의 deferred lesson) | 별도 file 신설 |
| optional inventoryContext input | inventory 0건 fallback graceful | optional chain 분기 |
| client-side join (quotes/page.tsx 안) | overfetch 0, 1+2단계 패턴 정합 | 매칭 logic client-side |
| Phase 분리 (1: helper, 2: wiring, 3: smoke) | small-batch | 3 push |

**Touched (Phase 1):**
- `apps/web/src/lib/operational-brief/build-rationale.ts` (NEW)
- `apps/web/src/__tests__/lib/operational-brief/build-rationale.test.ts` (NEW)

**Touched (Phase 2 — 별도):**
- `apps/web/src/app/dashboard/quotes/page.tsx` — desktop + mobile inline IIFE → helper call + /api/inventory useQuery + match logic

---

## 7. Implementation Phases

### Phase 1: helper 추출 (RED + GREEN)
- [ ] RED: helper unit test (6-case base + inventoryContext append + null fallback)
- [ ] GREEN: build-rationale.ts 신설 (function + types + 6-case 이동)
- [ ] vitest pass + tsc clean
- [ ] 호영님 push

### Phase 2: caller wiring + inventory fetch
- [ ] RED: quotes/page.tsx source guard (helper import + useQuery /api/inventory + 매칭 logic)
- [ ] GREEN: desktop §11.221 + mobile §11.222 inline IIFE → helper call. useQuery 추가. quote.items × inventory match (organizationId 자동 scope) → mostUrgent 계산 → helper forward
- [ ] vitest pass
- [ ] 호영님 push

### Phase 3: smoke + ADR
- [ ] Chrome smoke (호영님 production)
- [ ] ADR cluster close

---

## 9. Risk

| Risk | P | I | Mitigation |
|---|---|---|---|
| inventory 0건 시 메시지 깨짐 | Low | Low | inventoryContext.mostUrgent === null fallback (tail 없음) |
| /api/inventory overfetch | Low | Low | select 최소 (productId / quantity / leadTimeDays / safetyStock / averageDailyUsage) |
| desktop+mobile helper drift | Low | Low | 별도 file + 둘 다 import (single source) |

---

## 10. Rollback

- Phase 1 fail: revert helper file
- Phase 2 fail: revert caller (helper 그대로)
- Phase 3 fail: smoke 실패 시 helper rollback or feature flag

---

## 11. Notes (실시간 update)

(Phase 진행 시 채워짐)
