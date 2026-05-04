# Implementation Plan: §11.209d-mobile (Option A) — Mobile 결재 visualization

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-04
- **Actual Completion:** 2026-05-05 — Phase 0 audit → Phase 1 GREEN (helpers export + endpoint 확장) → Phase 2 GREEN (mobile UI timeline) → ADR close

⛔ DO NOT add mutation CTA (Option A — visualization only, mutation 은 §11.209d-mobile-mutation 후속)
⛔ DO NOT 새 mobile route (`/quotes/[id].tsx` 안에서 same-canvas)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- mobile `(tabs)/quotes.tsx` + `/quotes/[id].tsx` — 결재 surface
- mobile `useQuoteDetail` (useApi.ts) — `/api/quotes/[id]` GET
- web `/api/quotes/[id]` route — 결재 정보 노출 0 (audit 필요)
- §11.209d cluster — PurchaseRequest 가 canonical, web 에서 wiring 완료

**Conflicts Found:**
- ⚠️ /api/quotes/[id] 가 PurchaseRequest 정보 미노출 → endpoint 확장 필요
- mobile 에 결재 wiring 0 (visualization 부재)

**Chosen Source of Truth:**
- /api/quotes/[id] 에 PurchaseRequest batched query + 결재 fields 추가 (canonical 단일화)
- mobile useQuoteDetail type 확장 (optional fields, caller 호환)
- mobile /quotes/[id].tsx 에 timeline section 추가

---

## 1. Priority Fit
- Post-release lock-completion (P1.5) — §11.209d cluster mobile 일관성

## 2. Work Type
- [x] Web (endpoint 확장)
- [x] Mobile (Expo/RN UI)

## 3. Overview

mobile 견적 상세에서 결재 진행 상황 timeline 표시. mutation (approve/reject) 은 후속 batch.

**Success Criteria:**
- [ ] /api/quotes/[id] 가 internalApprovalStatus / approvalRequestedAt / approverName / approvalDecidedAt / rejectionReason 노출
- [ ] mobile useQuoteDetail type 확장
- [ ] mobile /quotes/[id].tsx 에 timeline 표시 (NOT_REQUIRED 시 visible 0)

**Out of Scope:**
- mutation CTA (§11.209d-mobile-mutation 후속)
- approver routing 변경
- push notification

## 4. Product Constraints
- canonical: PurchaseRequest (web 과 동일)
- same-canvas: mobile detail 안에서
- mobile = 현장/엣지 운영 도구 (시각화 우선)

## 7. Implementation Phases (3 phases, 3-4h)

### Phase 0: Audit ✅
- mobile `/quotes/[id].tsx` + useQuoteDetail 매핑
- /api/quotes/[id] 확장 결정

### Phase 1: /api/quotes/[id] 결재 정보 확장 (1-2h)
- 🔴 RED: response 에 결재 fields 노출
- 🟢 GREEN: PurchaseRequest batched query + derive (web 의 resolver 패턴 흡수)

### Phase 2: mobile UI timeline (1-2h)
- 🔴 RED: useQuoteDetail type + /quotes/[id].tsx timeline
- 🟢 GREEN: timeline 컴포넌트 (status badge + 4 row)
- ✋ Quality Gate: NOT_REQUIRED 시 visible 0, dead button 0

### Phase 3: ADR + close (0.5h)

## 11. Progress Tracking
- **Overall completion:** 25% (Phase 0)
- **Current phase:** Phase 1
