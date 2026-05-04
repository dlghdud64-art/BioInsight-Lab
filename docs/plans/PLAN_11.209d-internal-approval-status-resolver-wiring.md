# Implementation Plan: §11.209d Internal Approval Status Resolver Wiring

- **Status:** ✅ Complete (CLOSED)
- **Started:** 2026-05-04
- **Last Updated:** 2026-05-04
- **Estimated Completion:** 2026-05-08 (Phase 0~4)
- **Actual Completion:** 2026-05-04 (single-day cluster — Phase 0 audit 가설 2회 깸 → Option A → Option B 재조정 → Phase 1-3 GREEN → ADR close)

**CRITICAL INSTRUCTIONS** — After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run quality gate validation (vitest + tsc 최소)
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in §12 Notes & Learnings
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates / proceed with failing checks
⛔ DO NOT introduce schema migration (Quote.approvalRequired 활용 — 변경 0)
⛔ DO NOT add APPROVED/REJECTED branch (Option A — §11.209d-status 후속)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `PurchaseConversionItem` (`lib/ontology/purchase-conversion-resolver.ts:64+`) 의 field — `externalApprovalStatus` 만, `internalApprovalStatus` 부재
- `Quote.approvalRequired Boolean @default(false)` (`schema.prisma:1914`) — canonical source
- composer (`work-queue/purchase-conversion/route.ts`) 가 이미 quote 조회 + resolver input forward
- §11.209c cluster CLOSED — workspace tier discriminator (TEAM SKU 분기) wiring 완료

**Conflicts Found:**
- ❌ Quote model 에 명확한 internalApprovalStatus field 부재 (approvalRequired Boolean 만)
- ⚠️ APPROVED/REJECTED 분기 — AiActionItem 의 approval-related type 활용 가능하지만 매핑 정의 필요 → §11.209d-status 후속

**Chosen Source of Truth (Phase 1 audit 정정 — 2026-05-04):**
- **Option B 정상화** — `PurchaseRequest` model 활용 (canonical entity)
- 가설 깨짐: `Quote.approvalRequired` field 부재 (IngestionJob model 의 field 였음).
  실제 canonical source = `PurchaseRequest.status` (PurchaseRequestStatus enum).
- `internalApprovalStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED"` (4 값)
- 매핑:
  - PurchaseRequest 0 개 → "NOT_REQUIRED"
  - latest status === "APPROVED" → "APPROVED"
  - latest status === "REJECTED" → "REJECTED"
  - latest status === "CANCELLED" → "NOT_REQUIRED" (re-set 가능)
  - 그 외 (PENDING) → "PENDING"
- Quote ↔ PurchaseRequest schema 역관계 0 → composer 별도 batched query 필요

---

## 1. Priority Fit
- **Category:** Post-release lock-completion (P1.5)
- §11.209c 의 row UI 가치 lock 완성 — 결재 약속 카피만 visible 했으나 실 row visualization 부재 → §11.209d 가 row 시각화 + PO CTA disabled until approved 추가

---

## 2. Work Type
- [x] Workflow / Ontology Wiring (resolver field 추가)
- [x] Web (row + detail panel 시각화)

---

## 3. Overview

**Feature Description:**
TEAM + BUSINESS_MONTHLY (R&D Operations) 또는 ENTERPRISE workspace 사용자가 /dashboard/purchases 의 row + detail panel 에 "결재 대기" badge visible. PO 발행 CTA disabled until approved.

**Success Criteria:**
- [ ] PurchaseConversionItem.internalApprovalStatus field 추가
- [ ] resolver 가 Quote.approvalRequired 기반 derive
- [ ] composer 가 quote.approvalRequired forward (이미 select 가능 — 검증 필요)
- [ ] /dashboard/purchases row 에 "결재 대기" badge (approvalRequired=true 시)
- [ ] detail panel 에 internal approval 상태 표시
- [ ] PO 발행 CTA disabled when internalApprovalStatus !== "NOT_REQUIRED" + 운영자 친화 메시지

**Out of Scope (별도 §11.209d-status):**
- APPROVED / REJECTED 분기 (4 값 확장)
- 결재 mutation (approve / reject button)
- 결재자 매트릭스 매핑
- AiActionItem approval-related type 정의

**User-Facing Outcome:**
- R&D Operations / Enterprise: row 에 "결재 대기" badge + PO CTA disabled
- Lab Team / Starter: 변화 0 (Quote.approvalRequired === false default)

---

## 4. Product Constraints
- **Source of Truth:** Quote.approvalRequired (canonical)
- **Derived Projection:** PurchaseConversionItem.internalApprovalStatus
- same-canvas (purchases page 안에서 row + detail)
- dead button 0 (CTA disabled state 명시 + 운영자 친화 메시지)
- canonical schema 변경 0

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Option A (2 값) — Quote.approvalRequired Boolean 만 활용 | surgical, schema 변경 0, dead button 0 | 결재 후에도 "PENDING" 잔존 (APPROVED 분기 0) |
| internalApprovalStatus type 신규 (resolver-internal) | resolver 가 single source 통과 | type 확장 시 caller 영향 (post-§11.209d-status) |

---

## 7. Implementation Phases (4 phases, 5-8h)

### Phase 0: Audit close ✅
- [x] canonical source 결정 (Quote.approvalRequired)
- [x] Option A vs B 결정 (Option A — 보수적)

### Phase 1: PurchaseConversionItem.internalApprovalStatus + resolver (1-2h)
- 🔴 RED: type field 존재 + resolver 분기 검증 (4 case — required true/false × external 정합)
- 🟢 GREEN: type 추가 + resolver 분기

### Phase 2: composer wiring (1-2h)
- 🔴 RED: composer 가 quote.approvalRequired select + input forward 검증
- 🟢 GREEN: select 확장 + input forward
- ✋ Quality Gate: resolver test 회귀 0

### Phase 3: /dashboard/purchases UI 시각화 (2-3h)
- 🔴 RED: row "결재 대기" badge + detail panel internal approval 상태 + PO 발행 CTA disabled
- 🟢 GREEN: badge / detail row / CTA disabled + 운영자 친화 메시지
- ✋ Quality Gate: dead button 0

### Phase 4: ADR + cluster close (1h)
- ADR-002 §11.209d entry append
- §11.209c plan 의 deferred §11.209d 항목 close

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Option A 의 2 값 만 분기 → 결재 후 "PENDING" 잔존 | Med | Low | §11.209d-status 후속 명시 |
| composer select 확장 회귀 | Low | Med | Phase 2 회귀 test |
| PO CTA disabled state 사용자 혼란 | Low | Med | Phase 3 운영자 친화 메시지 ("결재 완료 후 발주 가능") |

---

## 10. Rollback Strategy
- Phase 1 fail → type / resolver revert
- Phase 2 fail → composer select revert
- Phase 3 fail → UI revert (resolver/composer 정합 유지)
- Phase 4 fail → ADR rollback

---

## 11. Progress Tracking

- **Overall completion:** 100% (CLOSED 2026-05-04)
- **Current phase:** ✅ All complete — ADR-002 §11.209d entry land

**Phase Checklist:**
- [x] Phase 0 (audit & truth lock — 가설 2회 깸, Option A → B 재조정)
- [x] Phase 1 (PurchaseConversionItem + resolver — 8/8 vitest + 48/48 regression)
- [x] Phase 2 (composer wiring — 56/56 cluster vitest)
- [x] Phase 3 (UI 시각화 — 7/7 vitest, 71/71 cluster 통합)
- [x] Phase 4 (ADR + cluster close)

**총 verify:** vitest 71/71 PASS, tsc 0 새 errors.
