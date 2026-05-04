# Implementation Plan: §11.209d-notification (Stage 1 email)

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit → Phase 1 GREEN (3 templates) → Phase 2-3 GREEN (3 routes wiring) → ADR close

⛔ DO NOT modify mutation atomic transactions (email = best effort)
⛔ DO NOT add in-app Notification model (Stage 2 후속)
⛔ DO NOT add mobile push (Stage 3 후속)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `lib/email/sender.ts` sendEmail — 이미 land
- `lib/email/templates.ts` 기존 quote / inventory templates
- §11.209d cluster — request-approval / approve / reject mutation routes 모두 land
- approver email = User.email (canonical, required field)

**Conflicts Found:**
- 3 channel (email/in-app/push) 한 batch 시 큰 트랙 → Stage 분리

**Chosen Source of Truth:**
- Stage 1 only (email) — sendEmail 인프라 활용, 작-중 scope
- email = best effort (mutation atomic 외, fail 시 audit log)

---

## 1. Priority Fit
- Post-release lock-completion (P1.5) — PR INSERT 후 approver 알 방법 0 → email 알림 lock 완성

## 2. Work Type
- [x] Workflow / Ontology Wiring (mutation hooks)
- [x] Web (email templates + sender)

## 3. Overview

R&D Operations / Enterprise workspace 의 PurchaseRequest mutation event 시 email 발송 (approver / requester).

**Success Criteria:**
- [ ] PR INSERT → approver email
- [ ] approve → requester email
- [ ] reject → requester email (반려 사유 포함)
- [ ] best effort (mutation atomic 안 / fail 시 graceful)
- [ ] LabAxis brand 정합 한국어 template

**Out of Scope (Stage 2-3):**
- in-app Notification model + UI bell
- mobile push (APN/FCM)
- Slack/Teams webhook
- email digest / queue / retry
- escalation chain

## 4. Product Constraints
- canonical: PurchaseRequest mutation (PR INSERT / approve / reject)
- email = best effort (mutation atomic 외)
- audit log 기록 (email fail 시)

## 7. Implementation Phases (4 phases, 5-7h)

### Phase 0: Audit close ✅
- Stage 1 only (email)
- best effort 결정

### Phase 1: Email templates 3개 (1-2h)
- 🔴 RED: 3 template function export
- 🟢 GREEN: `email/templates.ts` 또는 별도 file
  - generatePurchaseApprovalRequestEmail (approver)
  - generatePurchaseApprovedEmail (requester)
  - generatePurchaseRejectedEmail (requester + reason)

### Phase 2: request-approval route email (1-2h)
- 🔴 RED: route 가 approver email 발송
- 🟢 GREEN: PR INSERT 후 sendEmail (graceful)

### Phase 3: approve/reject route email (2-3h)
- 🔴 RED: 두 route 가 sendEmail 호출
- 🟢 GREEN: approve → approved email, reject → rejected email
- ✋ Quality Gate: best effort (email fail → mutation 성공)

### Phase 4: ADR + close (0.5h)

## 11. Progress Tracking
- **Overall completion:** 25% (Phase 0)
- **Current phase:** Phase 1
