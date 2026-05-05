# Implementation Plan: §11.209d-mobile-request-approval-cta

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit → Phase 1 RED 13/16 fail → Phase 2 GREEN (server + hook + UI 16/16 PASS) → Phase 3 ADR close

⛔ DO NOT add manual approver select — workspace 첫 ADMIN 자동 매핑 (§11.209d-pr-auto-create lesson). 별도 batch.
⛔ DO NOT change web request-approval mutation route — canonical 단일.
⛔ DO NOT bypass server validation — canRequestApproval 는 visibility 분기일 뿐, 실제 검증은 server (in_app_approval policy + 본인 소유 + DUPLICATE_PENDING 차단).

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- Web mutation route — `POST /api/work-queue/purchase-conversion/[quoteId]/request-approval` (body 없음, server-side 8-step validation, 결재자 자동 매핑, 201 + `{ purchaseRequest }`)
- Web detail panel visibility (apps/web/src/app/dashboard/purchases/page.tsx) — `approvalPolicy === "in_app_approval"` + `internalApprovalStatus === "NOT_REQUIRED"`
- Web caller test (purchases-request-approval-cta.test.ts) — visibility 조건 + mutation + invalidation 정합

**Conflicts Found:**
- mobile `useQuoteApproval(id)` response 에 `canRequestApproval` boolean 0
- mobile workspace.plan / approvalPolicy 직접 조회 0 → server-side computed 필수

**Chosen Source of Truth:**
- Option A — server-side computed `canRequestApproval` 추가:
  - quote.userId === session.user.id (본인 소유)
  - internalApprovalStatus === "NOT_REQUIRED"
  - workspace.plan + stripePriceId → resolveApprovalPolicyForPlan === "in_app_approval"
- 3 조건 모두 true 일 때만 true (server-side single computation)

**Environment Reality Check:**
- vitest @ apps/web (host)
- Mobile UI = source-level grep 패턴 (apps/mobile 의 jest 미설치)
- npx tsc (host) — sandbox prisma client noise 만

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — §11.209d cluster mobile 측 완전 closure
- 모바일 결재 lifecycle 전체 (요청 → 승인/반려) closed
- dead button 0 lock 강화

## 2. Work Type
- [x] Workflow / Ontology Wiring (mobile mutation hook)
- [x] Mobile (Expo / RN UI CTA)
- [x] API contract (canRequestApproval field 추가)

## 3. Overview

R&D Operations / Enterprise workspace 의 견적 작성자가 모바일에서 견적 결재 요청 CTA 를 직접 사용. 현재는 view-only (web 만 가능).

**Success Criteria:**
- [ ] `/api/quotes/[id]` response.approval.canRequestApproval boolean 정확
- [ ] mobile useRequestApproval hook 동작 + invalidation
- [ ] mobile 하단 액션바 또는 견적 카드에 canRequestApproval === true 시 "결재 요청" Pressable visible
- [ ] mutation pending state + error Alert
- [ ] same-canvas + dead button 0

**Out of Scope:**
- 결재자 manual select — workspace 첫 ADMIN 자동 매핑 (§11.209d-pr-auto-create lesson)
- 모바일 push notification (Stage 3)
- ProcurementRole 매트릭스 — §11.209d-approver-routing

**User-Facing Outcome:**
- 본인 견적 + 결재 정책 활성 plan 일 때 모바일에서 "결재 요청" Pressable
- Alert.alert confirm → server validation → 결재 cycle 시작 → toast + 카드 visible (PENDING 전환)

## 4. Product Constraints

**Must Preserve:**
- [x] same-canvas (quote detail screen 안에 통합)
- [x] canonical truth (web request-approval route 단일)
- [x] invalidation discipline (4 keys)

**Must Not Introduce:**
- [x] page-per-feature (별도 페이지 0)
- [x] dead button (canRequestApproval false 시 hide)
- [x] no-op / fake success (server response 후 toast)
- [x] approver manual select UX 복잡

**Canonical Truth Boundary:**
- Source of Truth: web `POST /api/work-queue/purchase-conversion/[id]/request-approval` + DB PurchaseRequest
- Derived Projection: `canRequestApproval` (본인 소유 + NOT_REQUIRED + in_app_approval policy)
- Persistence Path: server validation 8-step → DB INSERT → email best-effort

**UI Surface Plan:**
- [x] 하단 액션바 inline (견적 발송 / 주문 전환과 같은 그룹)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Option A — server canRequestApproval | dead button 0, single source, mobile workspace.plan 조회 불필요 | server query 부담 (workspace member + plan) |
| 자동 매핑 그대로 | §11.209d-pr-auto-create lesson 정합 | manual select 별도 batch |

**Dependencies:**
- Web request-approval route already land
- §11.209d-pr-auto-create logic 재사용 (mobile 변경 0)
- Mobile auth bridge (NextAuth + JWT) — 이미 검증

**Integration Points:**
- `/api/quotes/[id]` GET — `canRequestApproval` field 추가 (workspace.plan + approvalPolicy 조회)
- `/api/work-queue/purchase-conversion/[id]/request-approval` POST — mobile caller 추가 (route 변경 0)
- `apps/mobile/hooks/useApi.ts` — useRequestApproval 추가
- `apps/mobile/types/index.ts` — `QuoteApproval.canRequestApproval?: boolean`
- `apps/mobile/app/quotes/[id].tsx` — 하단 액션바 안에 "결재 요청" Pressable

## 6. Global Test Strategy

- Web — vitest source-level grep test for canRequestApproval computed (route response shape) + lib/billing/plan-descriptor 호출 정합
- Mobile — vitest source-level grep test for useRequestApproval (mutation function + invalidation)
- Manual smoke — 본인 견적 + R&D Operations workspace + 모바일 → "결재 요청" Pressable → confirm → toast → 카드 visible (PENDING)

## 7. Implementation Phases (3 phases, 4-6h)

### Phase 0: Context & Truth Lock ✅
- audit 완료 (위 §0)

### Phase 1: 🔴 RED (1-1.5h)
- 🔴 RED:
  - `apps/web/src/__tests__/api/quotes/quote-detail-canrequestapproval.test.ts` — response.approval.canRequestApproval boolean + workspace 조회 + resolveApprovalPolicyForPlan 호출 + NOT_REQUIRED 검사
  - `apps/web/src/__tests__/mobile/use-request-approval-hook.test.ts` — useRequestApproval 정의 + apiClient.post + invalidation
  - `apps/mobile/types/index.ts` — `QuoteApproval.canRequestApproval?: boolean`

✋ **Quality Gate:** failing tests real, types optional (backward compat)
**Rollback:** 테스트만 revert

### Phase 2: 🟢 GREEN — server canRequestApproval + mobile hook + UI (2-3h)
- 🟢 GREEN:
  - `/api/quotes/[id]` GET — workspaceMember + workspace.plan + stripePriceId 조회 → `resolveApprovalPolicyForPlan` → `canRequestApproval` computed (3 조건)
  - `apps/mobile/hooks/useApi.ts` — useRequestApproval 추가 (4 keys invalidate)
  - `apps/mobile/app/quotes/[id].tsx` — 하단 액션바에 "결재 요청" Pressable (canRequestApproval === true 시 visible) + Alert.alert confirm + handleRequestApproval handler

✋ **Quality Gate:** vitest pass, regression 0, dead button 0, error Alert
**Rollback:** route + hook + UI revert

### Phase 3: ✋ Quality Gate + ADR + commit (1-1.5h)
- ADR-002 §11.209d-mobile-request-approval-cta entry CLOSED + lessons
- commit message draft + 호영님 host push

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| workspace.plan 추가 query 부담 | Med | Low | 같은 batch join (overfetch 0) |
| 자동 매핑 결재자 = 본인 fallback | Low | Low | server fallback (single-admin workspace 호환) |
| Race (web 과 mobile 동시 결재 요청) | Low | Low | server `DUPLICATE_PENDING_REQUEST` 차단 land |
| approvalPolicy 가 in_app_approval 외 (Lab Team / Starter) | Med | Med | server 가 400 반환 + 한국어 메시지 → mobile Alert.alert |

## 10. Rollback Strategy

- Phase 1: 테스트 revert
- Phase 2: route + hook + UI revert (DB 변경 0)
- Phase 3: full revert via git revert SHA

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ All phases complete
- **Next validation:** 호영님 host `git push` + Expo build smoke (NOT_REQUIRED 견적 + R&D Operations workspace → 모바일 → 결재 요청 → 카드 visible 확인)

**Phase Checklist:**
- [x] Phase 0 complete (audit)
- [x] Phase 1 complete (RED tests — 13/16 fail confirmed real)
- [x] Phase 2 complete (GREEN — server canRequestApproval + hook + UI, 16/16 + regression 39 PASS)
- [x] Phase 3 complete (ADR § 11.209d-mobile-request-approval-cta CLOSED entry)

## 12. Notes & Learnings

**Implementation Notes:**
- 직전 §11.209d-mobile-mutation 의 "useRequestApproval 미정의" drift 차단 lock 자연 해제 — 본 batch 명시적 enable, ADR 에 unlock 명시.
- 결재자 자동 매핑 (§11.209d-pr-auto-create lesson) 그대로 재사용 — mobile 은 mutation 호출만, 결재자 select UX 0.
- workspaceMember 추가 query 부담 = NOT_REQUIRED + 본인 소유 케이스만 (다른 케이스는 early skip).

**Lessons (cluster level):**
1. 결재 요청 자동 매핑 정합 = mobile UX 단순화 lesson.
2. canRequestApproval server-side computed = dead button 0 정합 source.
3. drift 차단 lock 자연 해제 패턴 — 후속 batch 명시 enable + ADR unlock.
4. §11.209d cluster mobile 측 완전 closure — 결재 lifecycle 전체 가능.
5. Karpathy "silent wrong assumption" 차단 — cycle 절반 → 완전 cycle.

**Deferred Follow-ups:**
- `#mobile-manual-approver-select` — 결재자 manual select (workspace multiple ADMIN)
- `#mobile-push-notification` (Stage 3) — APN/FCM
- `#mobile-offline-mutation-queue` — 오프라인 mutation 큐 + retry
- `#mobile-approver-routing` — ProcurementRole 매트릭스
