# Implementation Plan: §11.209d-pr-auto-create — Quote → PurchaseRequest 결재 요청 CTA

- **Status:** ✅ Complete (CLOSED)
- **Started:** 2026-05-04
- **Last Updated:** 2026-05-04
- **Actual Completion:** 2026-05-04 (single-day cluster — Option A 결정 → Phase 1-3 GREEN → ADR close)

⛔ DO NOT modify bulk-po atomic transaction (Option A — 분리)
⛔ DO NOT auto-create PR without user click (manual intent 명시)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `/api/work-queue/purchase-conversion/bulk-po` POST — atomic Order 생성, PR 생성 0
- PR 생성 진입점: `/api/inventory/[id]/restock-request` + `/api/request` POST (manual)
- `User.approvalLimit BigInt?` (line 138) — User 레벨 (workspace 미land)
- §11.209d cluster — visualization + approve/reject mutation CTA 모두 land
- §11.209c — workspace.plan + stripePriceId → approvalPolicy 매핑

**Conflicts Found:**
- ⚠️ workspace 에 approvalLimit 부재 — User 레벨만 (threshold 단순화 필요)
- ⚠️ bulk-po atomic 안 PR 분기 = dead button 위험

**Chosen Source of Truth:**
- 별도 mutation route (bulk-po 분리) — Option A
- threshold 단순화: in_app_approval policy 시 모든 quote PR 가능 (User.approvalLimit 활용은 후속)
- approverId 자동 매핑: workspace 첫 ADMIN/OWNER (workspaceMember.findFirst role=ADMIN)

---

## 1. Priority Fit
- Post-release lock-completion (P1.5) — §11.209d 의 진짜 visible 효과 lock

---

## 2. Work Type
- [x] Workflow / Ontology Wiring
- [x] Web (detail panel CTA + mutation route)

---

## 3. Overview

R&D Operations / Enterprise workspace 사용자가 /dashboard/purchases detail panel 에서 결재 흐름 진입 — "결재 요청" CTA click 시 PurchaseRequest 자동 INSERT (PENDING, approverId=workspace ADMIN). 결재자 가 그 후 §11.209d-mutation 의 approve/reject CTA 활용.

**Success Criteria:**
- [ ] 새 mutation route `/api/work-queue/purchase-conversion/[quoteId]/request-approval` POST
- [ ] PR 자동 INSERT (PENDING, approverId 자동 매핑)
- [ ] detail panel "결재 요청" CTA — in_app_approval policy + NOT_REQUIRED + non-admin user 시 visible
- [ ] dead button 0 (Lab Team / approver 부재 / 이미 PENDING 시 visible 0)

**Out of Scope:**
- bulk-po atomic 분기 (Option B 미채택)
- User.approvalLimit threshold 활용 (§11.209d-approver-routing 후속)
- 결재자 자동 routing (현재 첫 ADMIN/OWNER 만)
- PR 의 budget gate 통합

---

## 4. Product Constraints
- canonical: PurchaseRequest INSERT, mutation API 가 진짜 lock
- bulk-po atomic transaction 변경 0
- detail panel same-canvas

---

## 7. Implementation Phases (3 phases, 4-6h)

### Phase 0: Audit close ✅
- bulk-po 분리 (Option A)
- approverId 자동 매핑 (첫 ADMIN/OWNER)

### Phase 1: 새 mutation route + PR INSERT (2-3h)
- 🔴 RED: source-level test (route 존재 + workspace.plan check + PR INSERT 시그니처)
- 🟢 GREEN: route 작성
  - workspace.plan + stripePriceId → resolveApprovalPolicyForPlan
  - in_app_approval 외 → 400
  - approver 매핑 (workspaceMember.findFirst role=ADMIN/OWNER)
  - PR INSERT (PENDING + quoteId + totalAmount + items)
  - enforceAction (purchase_request_create)

### Phase 2: detail panel "결재 요청" CTA (2h)
- 🔴 RED: button visible when approvalPolicy === "in_app_approval" + internalApprovalStatus === "NOT_REQUIRED"
- 🟢 GREEN: button + mutation hook + invalidateQueries
- ✋ Quality Gate: Lab Team workspace 에서 visible 0

### Phase 3: ADR + close (1h)

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| approver 미설정 (ADMIN 0개) | Med | Med | route 가 graceful 400 + 메시지 |
| bulk-po race | Low | Low | 별도 route, atomic 변경 0 |
| User.approvalLimit 미활용 | Low | Low | 후속 batch (§11.209d-approver-routing) |

---

## 11. Progress Tracking
- **Overall completion:** 100% (CLOSED 2026-05-04)
- **Current phase:** ✅ All complete — ADR-002 §11.209d-pr-auto-create entry land

**Phase Checklist:**
- [x] Phase 0 (Option A 결정)
- [x] Phase 1 (mutation route + PR INSERT — 10/10 vitest)
- [x] Phase 2 (detail panel CTA — 5/5 vitest, 27/27 cluster 통합)
- [x] Phase 3 (ADR + close)

**총 verify:** vitest 27/27 PASS, tsc 0 새 errors.
