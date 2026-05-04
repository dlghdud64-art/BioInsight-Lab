# Implementation Plan: §11.209b Approval Matrix — R&D Operations Tier wiring

- **Status:** ✅ Complete (CLOSED)
- **Started:** 2026-05-04
- **Last Updated:** 2026-05-04
- **Estimated Completion:** 2026-05-08 (Phase 0~4)
- **Actual Completion:** 2026-05-04 (single-day cluster — Phase 0 audit + 옵션 결정 3건 + §11.209b-pre 분리 + Phase 1-4 GREEN + ADR close)

**CRITICAL INSTRUCTIONS** — After completing each phase:

1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands (vitest + tsc 최소)
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in §12 Notes & Learnings
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT make Lab Team Tier 사용자에게 "결재" 약속을 visible 시키지 않는다 (dead promise 방지)

---

## 0. Truth Reconciliation

**Latest Truth Source (이미 land 된 자산 — Phase 0 확정 대상):**

- `User.approvalLimit` BigInt? — §11.97 user-approval-policy-schema-add (단일 건 승인 한도)
- `PurchaseRequest.approverId` / `approver` relation (User, ApprovedPurchases) — 결재자 매핑
- `PurchaseRequest.approvalRequired` Boolean / `approvalStatus` ApprovalStatus enum / `approvalDecidedAt` / `approvalPolicy` ("none" | "in_app_approval" | "external_approval")
- `pendingApprovalCount` (PurchaseRequest queue counter)
- `/api/ai-actions/[id]/approve/route.ts` — AI action approve flow (참고 패턴, PurchaseRequest 직접 아님)
- WorkspaceMember model 존재 (role 시스템 entry point)

**Secondary References:**

- §11.201 PLAN_DESCRIPTOR (apps/web/src/lib/billing/plan-descriptor.ts) — Tier ↔ display 매핑
- §11.209 commit (8336afcc) — purchases/po 헤더 카피 약속 본문
- ADR-002 — pilot tenant seed 결정

**Conflicts Found (Phase 0 audit 결과 — 2026-05-04):**

- ❌ 가설 깨짐 — 결재 인프라가 이미 방대하게 land 되어 있음:
  - `approval-policy-surface-engine.ts` (resolver `if (!req.approvalRequired)` 이미 wiring)
  - `dispatch-v2-permission-policy-engine.ts` (permission factory + ProcurementRole 매핑)
  - `exception-approval-handoff-gate-v2-engine.ts` (exception path)
  - `approval-priority-ranking-v2-engine.ts` / `approval-inbox-projection-v2-engine.ts` / `dispatch-v2-approval-workbench-engine.ts`
  - `/api/request/[id]/approve|cancel|reject|reverse/route.ts` (PurchaseRequest lifecycle endpoint 전체)
- ⚠️ ApprovalStatus enum 충돌 — `schema.prisma:2010` enum ApprovalStatus (Prisma enum) vs `schema.prisma:2516` `approvalStatus String @default("not_required")` — 동일 개념 다른 타입. **별도 cluster §11.209b-pre 에서 통일 우선**.
- 본 plan 의 wiring gap = "PO 전환 진입점이 위 engine 들을 호출하는지" 검증 + UI 시각화 + Tier 별 카피 + entitlement 매핑.

**Chosen Source of Truth:**

- **schema (Prisma + ApprovalStatus enum) + 기존 engine 들 (approval-policy-surface-engine, dispatch-v2-permission-policy-engine) 이 canonical**. 새 resolver 작성 금지 — 기존 engine 활용.
- Tier ↔ approvalPolicy 매핑은 **PLAN_DESCRIPTOR (§11.201 Phase 1 land 된 display layer) 의 entitlement 확장**으로 노출 — billing canonical 변경 0.
- ApprovalStatus enum 통일은 **§11.209b-pre 에서 선행**. 본 plan 은 통일된 enum 가정 하 진행.

**Environment Reality Check:**

- [x] repo `ai-biocompare`, branch `main`
- [x] vitest / tsc 운용 가능 (§11.208 / §11.209 verify 통과로 검증됨)
- [ ] prisma generate / migrate 필요 여부 — Phase 0 audit 에서 확정 (schema 추가 변경 0 가설)

---

## 1. Priority Fit

**Current Priority Category:**

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release (lock-protection 우선순위 — P1.5)
- [ ] P2 / Deferred

**Why This Priority:**

일반적 우선순위로는 P2 (현재 P1 = vitest install / RFQ smoke 등과 무관) 이지만, §11.209 헤더 카피 "결재 라인에 올라갑니다" 약속이 dead promise 화될 위험이 LabAxis lock 위반. 이 lock 보호 = §11.209 cluster 의 logical close 이며, lock 을 우선 보호해야 카피의 신뢰성이 유지된다.

---

## 2. Work Type

- [ ] Feature (전혀 새 기능 아님 — 약속 wiring)
- [ ] Bugfix
- [ ] API Slimming
- [x] Workflow / Ontology Wiring (PurchaseRequest 상태 전이)
- [ ] Migration / Rollout (schema 변경 0 가설 — Phase 0 확정)
- [x] Billing / Entitlement (Tier 별 approvalPolicy 매핑)
- [ ] Mobile (defer — 별도 batch §11.209d)
- [x] Web
- [ ] Design Consistency

---

## 3. Overview

**약속의 본문:**

회신 받은 견적을 비교하고 발주로 전환할 때, 결재가 필요한 (`PurchaseRequest amount > approver.approvalLimit AND workspace.approvalPolicy === "in_app_approval"`) 항목은 자동으로 approver 에게 결재 요청 record 가 만들어진다. 결재 전까지 PO 발행 차단.

**Success Criteria:**

- [ ] Lab Team Tier: 카피에 "결재" 약속 0 (분기), workspace.approvalPolicy default = 'none' 유지 — 약속 자체 안 함
- [ ] R&D Operations Tier: workspace.approvalPolicy = 'in_app_approval' default, PO 전환 시 자동 결재 트리거 wiring, 구매 운영 surface 에 "결재 대기" 상태 시각화
- [ ] Enterprise Tier: 'in_app_approval' OR 'external_approval' 둘 다 가능 (외부 ERP 연동은 별도 후속 batch §11.209c)
- [ ] settings panel 에 approver 매핑 / approvalLimit 표시 (read-only, admin 만 수정 가능)

**Out of Scope (⚠️ 절대 구현하지 말 것):**

- [ ] Enterprise 외부 ERP/그룹웨어 webhook (별도 batch §11.209c)
- [ ] 모바일 결재 UI (별도 batch §11.209d)
- [ ] approvalLimit 동적 변경 admin UI (별도 batch)
- [ ] 다단계 결재 (1차→2차→최종) — single-approver 만 우선
- [ ] approver 역할 매트릭스 (예: 부서별, 카테고리별) — 후속 batch
- [ ] Slack/Teams 결재 알림 (후속 batch)

**User-Facing Outcome:**

- R&D Operations Tier 사용자가 발주 전환 시 → "결재 필요 (approver: [이름], 한도 초과 ₩X)" 상태로 PO 발행 보류 → approver 결재 후 PO 정식 발행
- Lab Team Tier 사용자: 변화 0 (default 'none' 정책)
- Enterprise Tier: R&D Operations 와 동일 (외부 연동은 별도 batch)

---

## 4. Product Constraints

**Must Preserve:**

- [x] workbench / queue / rail / dock (구매 운영 surface 의 기존 4-zone)
- [x] same-canvas (구매 운영 안에서 결재 상태 표시 — 별도 결재 페이지 신설 금지)
- [x] canonical truth (PurchaseRequest.approvalStatus = canonical, UI 는 mirror only)
- [x] invalidation discipline (PO 전환 mutation 후 cache invalidate)
- [x] PLAN_DESCRIPTOR 단일 source of truth (§11.201 Phase 1 lock)

**Must Not Introduce:**

- [x] page-per-feature (결재 전용 페이지 신설 금지)
- [x] chatbot/assistant reinterpretation (결재 = 명시적 list/CTA 만)
- [x] dead button / no-op / placeholder success (Lab Team Tier 에 "결재" 약속하지 않음으로 차단)
- [x] fake billing/auth shortcut (entitlement 게이트 정확히)
- [x] preview overriding actual truth (UI 가 approvalStatus 직접 mutate 금지)

**Canonical Truth Boundary:**

- **Source of Truth:** `PurchaseRequest.approvalRequired / approvalStatus / approverId / approvalDecidedAt` (Prisma)
- **Derived Projection:** `pendingApprovalCount`, `module-landing-adapter` 의 결재 대기 bucket
- **Snapshot / Preview:** 없음 (live data only)
- **Persistence Path:** PO 전환 mutation (Phase 0 에서 정확한 위치 확정) → resolver `shouldRequireApproval` → DB write

**UI Surface Plan:**

- [x] Inline expand (구매 운영 surface 의 PurchaseRequest row 에 "결재 대기" badge + approver 표시)
- [x] Settings panel (`/dashboard/settings` 에 결재자/한도 read-only 표시)
- [ ] Right dock
- [ ] Bottom sheet
- [ ] New page (⚠️ 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| approvalPolicy default 를 Tier 별 분기 (Lab Team='none', R&D Operations='in_app_approval') | 카피 약속과 정합. dead promise 차단 | workspace seed 시 Tier 변경 시 default 재계산 필요 |
| Resolver `shouldRequireApproval(amount, approverLimit, policy)` 단일 함수 | 단일 진입점 = 트랙 전체 lock | 다단계 결재 시 resolver 확장 필요 (이번 batch out of scope) |
| approver 자동 매핑 = workspace.ownerId fallback (Phase 1) | 결재자 매핑 UI 없이도 wiring 완료 | 진짜 결재 매트릭스 (역할 기반) 는 후속 batch |
| schema 추가 변경 0 가설 | 이미 land 된 자산 활용 | Phase 0 audit 에서 가설 깨지면 plan 수정 |

**Dependencies:**

- **Blocked By:** §11.209b-pre — ApprovalStatus enum 통일 (Prisma enum vs String 충돌 해소)
- Required Before Starting: §11.209b-pre 완료 + Phase 0 추가 audit (approval-policy-surface-engine 호출 지점 + workspace.approvalPolicy seed 위치)
- External Packages: 없음
- Existing Routes / Models / Services Touched:
  - PurchaseRequest model (Prisma) — read/write
  - workspace.approvalPolicy seed (Phase 0 audit 에서 위치 확정)
  - `/dashboard/purchases` UI (결재 대기 시각화)
  - PLAN_DESCRIPTOR (entitlement 확장, display only)
  - 기존 engine: approval-policy-surface-engine, dispatch-v2-permission-policy-engine (호출 추가만, 신규 0)

**Integration Points:**

- API: PO 전환 mutation route (Phase 0 확정)
- Mutation: `transitionToPo` server action 또는 route handler
- UI: 구매 운영 row (badge), settings panel (approver 매핑)
- Billing: PLAN_DESCRIPTOR.approvalPolicy field 추가 (display layer)

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

**By Work Type:**

- 결재 resolver (shouldRequireApproval) → unit tests required
- PO 전환 mutation 에 resolver wiring → integration tests required
- 구매 운영 surface 결재 대기 시각화 → source-level test (component render)
- Tier 별 approvalPolicy 분기 → entitlement transition tests

**Execution Notes:**

- vitest + tsc 정상 운용 (§11.208/§11.209 검증 시 확인됨)
- prisma generate 필요 시 Phase 0 에서 명시 (schema 변경 0 가설)

---

## 7. Implementation Phases

### Phase 0: Audit & Truth Lock (1-2h)

**Goal:** PO 전환 mutation 의 정확한 위치, workspace seed 의 approvalPolicy 위치, ai-actions/approve route.ts 의 패턴 (참고용) 확정.

- **Status:** [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** PO 전환 path 의 approval check 호출 0 임을 grep 으로 입증

```bash
grep -rn "shouldRequireApproval\|approvalPolicy.*in_app_approval" apps/web/src/
grep -rn "approvalRequired\s*=" apps/web/src/
```

**🟢 GREEN:** 정확한 wiring 지점 (mutation, seed, UI) 매핑

- PO 전환 mutation 위치 (server action / route)
- workspace seed 의 approvalPolicy default 위치
- `/dashboard/purchases` row 의 PO 발행 CTA 위치
- ApprovalStatus enum 의 string vs Prisma enum 정합성 (schema 에 두 곳 발견됨)

**🔵 REFACTOR:** scope 축소 — single-approver 만 + 다단계 후속 batch 분리

**✋ Quality Gate:**

- [ ] PO 전환 mutation 위치 확정 (1개 또는 다수 경로 명시)
- [ ] schema 추가 변경 0 가설 검증 (또는 deviation 명시)
- [ ] ApprovalStatus enum 정합성 확정 (single source)
- [ ] §12 Notes 에 audit 결과 기록

**Rollback:** planning-only; no code change

---

### Phase 1: 기존 Engine 매핑 + Wiring Gap RED Tests (2-3h)

**Goal:** 기존 결재 engine 들의 진입점 매핑 + PO 전환 흐름의 wiring gap 입증 (RED test).

- **Status:** [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** PO 전환 흐름 → 기존 engine 호출 매핑 검증 + gap 입증

- approval-policy-surface-engine 의 호출 지점 grep + 매핑 표
- `/api/request/route.ts` (생성) 가 approval engine 호출하는지 검증
- PO 전환 (purchase 에서 PO 발행) 흐름 진입점 명확화 — `/api/request/[id]/approve` 와 별개인가?
- RED test 1: PO 전환 시 R&D Operations workspace 에서 approvalRequired=true set 되는지 (현재 wiring 안 되어 있다면 fail)
- RED test 2: PLAN_DESCRIPTOR.approvalPolicy field 부재 입증 (단언)

**🟢 GREEN:** 매핑 결과 문서화 + descriptor entitlement field 추가

- 파일: `apps/web/src/lib/billing/plan-descriptor.ts` (approvalPolicy field 추가, display layer)
- 파일: `apps/web/src/__tests__/billing/plan-descriptor-approval-policy.test.ts` (신규, Tier 별 default 검증)
- 신규 resolver 작성 0 — 기존 engine 활용

**🔵 REFACTOR:** descriptor entitlement 4 Tier 정합 ("none" | "in_app_approval" | "external_approval")

**✋ Quality Gate:**

- [ ] descriptor test pass (vitest)
- [ ] tsc 0 error on touched files
- [ ] schema 변경 0 (§11.209b-pre 의 enum 통일은 별도)
- [ ] §12 Notes 에 매핑 표 (어떤 engine 이 어디서 호출되는지) 기록

**Rollback:** revert descriptor field

---

### Phase 2: PO 전환 진입점 wiring (3-4h)

**Goal:** Phase 1 에서 발견한 wiring gap 만 minimal-diff 추가. 신규 mutation 작성 0, 기존 engine 호출 추가만.

- **Status:** [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** integration test — wiring gap 입증 + 추가 후 정합

- gap test: PO 전환 mutation 호출 → 기존 approval-policy-surface-engine 호출되어야 (현재 안 되면 fail)
- 정합 test: gap 닫은 후 PurchaseRequest.approvalRequired/approvalStatus 정확히 set

**🟢 GREEN:** wiring gap minimal-diff 추가

- PO 전환 mutation 안에서 기존 engine 호출 (resolver 신규 작성 0)
- approver 매핑은 dispatch-v2-permission-policy-engine 의 ProcurementRole 기반 우선, 부재 시 workspace.ownerId fallback
- pendingApprovalCount 증가 (이미 있다면 wiring 만)

**🔵 REFACTOR:** error path 정합 (approver null, policy 'none', amount 0)

**✋ Quality Gate:**

- [ ] integration test pass
- [ ] no truth boundary violation (approvalStatus 는 mutation 만 set)
- [ ] tsc 0 error
- [ ] cache invalidation 호출 정합 (`invalidateBriefNarrative` 등)
- [ ] 추가 line < 30 (minimal-diff 정합)

**Rollback:** revert wiring 추가 부분 (mutation 자체 revert 0, engine 호출만 revert)

---

### Phase 3: 구매 운영 UI 시각화 (2-3h)

**Goal:** 구매 운영 row 에 "결재 대기 (approver: [이름])" badge + PO 발행 CTA disabled until approved.

- **Status:** [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** source-level test — row 에 badge text 존재 + disabled state

**🟢 GREEN:** row component 에 approvalStatus 분기 추가

- "결재 대기" badge (approvalStatus='PENDING')
- approver 이름 표시 (User.name)
- PO 발행 CTA disabled (approvalStatus !== 'APPROVED')

**🔵 REFACTOR:** same-canvas 정합 (별도 페이지 신설 0)

**✋ Quality Gate:**

- [ ] dead button 0 (CTA disabled state 명시)
- [ ] loading/error/empty state 정합
- [ ] vitest + tsc pass

**Rollback:** revert UI component (백엔드 정합 유지)

---

### Phase 4: Tier 분기 카피 + Smoke (2-3h)

**Goal:** Lab Team Tier 에 "결재" 약속 노출 0 (조건부 카피), settings panel read-only display, soft_enforce roll-out.

- **Status:** [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Tier 별 카피 sweep test

- Lab Team 워크스페이스 헤더에 "결재" 단어 0
- R&D Operations 워크스페이스 헤더에 "결재" 약속 visible
- settings panel 에 approver/limit display

**🟢 GREEN:** 헤더 카피 Tier 분기 + settings panel display

- 파일: `apps/web/src/app/dashboard/purchases/page.tsx` (헤더 카피 Tier 분기)
- 파일: `apps/web/src/app/dashboard/settings/page.tsx` (approver/limit display)

**🔵 REFACTOR:** 카피 일관성, soft_enforce flag wiring

**✋ Quality Gate:**

- [ ] Tier 별 sweep test pass
- [ ] prod smoke (R&D Operations test workspace 에서 PO 전환 시 결재 트리거 visible)
- [ ] rollback path 명시 (PLAN_DESCRIPTOR.approvalPolicy 'none' revert)
- [ ] ADR-002 entry 추가 (§11.209b cluster close)

**Rollback:** PLAN_DESCRIPTOR.approvalPolicy 'none' 으로 revert (즉시 효과 — display layer 라 reload 시 반영)

---

## 8. Workflow / Ontology Addendum

**Resolver Input:** PurchaseRequest amount + approver.approvalLimit + workspace.approvalPolicy

**Expected Output:** `{ approvalRequired: boolean, approverId: string | null, approvalStatus: ApprovalStatus }`

**Surface Rules:**

- 구매 운영 row CTA 만 (dock/별도 페이지 0)
- settings panel display only (수정 admin 별도 batch)
- chatbot / assistant 0

**Validation:**

- [ ] row badge 정확 (approvalStatus 정합)
- [ ] PO 발행 CTA 차단 정확 (approvalStatus !== 'APPROVED')
- [ ] 결재 후 CTA 활성화 (approvalStatus = 'APPROVED' 시 enabled)

---

## 8b. Billing / Entitlement Addendum

**States:** approvalPolicy 는 entitlement 가 아닌 default policy. trialing/active/suspended 등 billing state 와 직교.

**Tier 별 default:**

- Starter: 'none' (기존 유지)
- Lab Team: 'none' (이번 batch 변경 0)
- R&D Operations: 'in_app_approval' (이번 batch land)
- Enterprise: 'in_app_approval' (외부 옵션은 후속 batch §11.209c)

**Validation:**

- [ ] Tier 변경 시 approvalPolicy default 재계산 (workspace.plan 변경 시점)
- [ ] downgrade (R&D Operations → Lab Team) 시 기존 approvalPolicy 유지 vs reset 여부 명시

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 기존 7개 engine 의 호출 지점 분산 → wiring gap 식별 어려움 | High | Med | Phase 1 RED 에서 명시적 매핑 표 작성, gap 만 minimal-diff 추가 |
| 새 resolver 작성 유혹 → canonical truth 충돌 | High | High | Phase 1-2 에서 신규 resolver 작성 0 lock — 기존 engine 활용만 |
| approver 매핑 자동화 미흡 (workspace.ownerId fallback) | Med | Med | dispatch-v2-permission-policy-engine 의 ProcurementRole 우선, fallback 만 추가 |
| Lab Team → R&D Operations 업그레이드 시 entitlement 반영 시점 | Med | Low | PLAN_DESCRIPTOR display layer 라 reload 시 즉시 반영 |
| **§11.209b-pre 미선행** → Phase 1-2 진행 시 enum 충돌로 wiring 깨짐 | High | High | **§11.209b-pre 완료 전 본 plan Phase 1 진입 금지** |
| canonical truth 충돌 (UI state 가 approvalStatus 덮어쓰기) | Low | High | Phase 3 에서 UI mutation 0, API 호출만 |
| schema 추가 변경 필요 (가설 깨짐) | Low | Med | Phase 0 추가 audit 에서 검증, 깨지면 prisma migrate phase 추가 |

---

## 10. Rollback Strategy

- **Phase 0 Fail (audit 결과 가설 깨짐):** plan 자체 수정 또는 deferred
- **Phase 1 Fail:** resolver file + descriptor field revert
- **Phase 2 Fail:** mutation hook revert (PO 전환 흐름은 이전 상태로 복귀)
- **Phase 3 Fail:** UI component revert (백엔드 정합 유지)
- **Phase 4 Fail:** PLAN_DESCRIPTOR.approvalPolicy 'none' 으로 revert (R&D Operations workspace 도 결재 약속 무효화)

**Special Cases:**

- Soft_enforce flag 도입 시 단계적 rollout (R&D Operations 의 일부 workspace 만 우선)
- DB migration 필요 없음 (가설 — Phase 0 검증)

---

## 11. Progress Tracking

- **Overall completion:** 100% (CLOSED 2026-05-04)
- **Current phase:** ✅ All complete — ADR-002 §11.209b cluster close entry land
- **Current blocker:** 없음
- **Next validation step:** §11.209c (workspace tier discriminator schema) deferred follow-up

**Phase Checklist:**

- [x] Phase 0 complete (audit & truth lock — 가설 3 깨짐 → 옵션 결정 3건)
- [x] §11.209b-pre complete (옵션 B — POCandidate.approvalPolicy enum 통일)
- [x] Phase 1 complete (PLAN_DESCRIPTOR.approvalPolicy field — 6/6 vitest)
- [x] Phase 2 complete (caller wiring — workspacePlanToIntent + resolveApprovalPolicyForPlan utility + po-candidates fallback — 16/16 vitest)
- [x] Phase 3 complete (옵션 B — 헤더 카피 Tier 분기 — 8/8 vitest)
- [x] Phase 4 complete (tagline sweep + ADR-002 cluster close — 3/3 vitest)

**총 verify:** vitest 33/33 PASS (cluster) + §11.209b-pre 9/9 PASS = **42/42**, tsc 0 새 errors.

---

## 12. Notes & Learnings

**Blockers Encountered:**

- (Phase 0 audit 시작 전 — 추가 예정)

**Implementation Notes:**

- (작업 진행 시 추가)

**Audit Results (Phase 0 — 2026-05-04):**

기존 결재 인프라 (canonical truth — 새 resolver 작성 금지):

| 자산 | 위치 | 역할 |
| :--- | :--- | :--- |
| `enum ApprovalStatus` (Prisma) | `schema.prisma:2010` | canonical enum |
| `approvalStatus String` (별도 model) | `schema.prisma:2516` | ⚠️ 충돌 — §11.209b-pre 에서 통일 |
| `approval-policy-surface-engine.ts` | `lib/ai/approval-policy-surface-engine.ts:140` | resolver (`if (!req.approvalRequired)`) |
| `dispatch-v2-permission-policy-engine.ts` | `lib/ai/dispatch-v2-permission-policy-engine.ts:263` | permission factory + ProcurementRole 매핑 |
| `exception-approval-handoff-gate-v2-engine.ts` | `:183` | exception path (`requiresApproval`) |
| `approval-priority-ranking-v2-engine.ts` | `:158` | filter helper (`filterReapprovalRequired`) |
| `approval-inbox-projection-v2-engine.ts` | `:268-289` | projection counter |
| `dispatch-v2-approval-workbench-engine.ts` | `:99` | workbench rationale ("승인 필요") |
| `/api/request/[id]/approve/route.ts` | (file) | PurchaseRequest 결재 endpoint |
| `/api/request/[id]/{cancel,reject,reverse}/route.ts` | (file) | 결재 lifecycle 전체 |

가설 검증 결과:

- ❌ "PO 전환 mutation 의 approval check 호출 0" → FALSE — 인프라 방대하게 land
- ⚠️ "schema 추가 변경 0" → 부분 깨짐 — ApprovalStatus enum 충돌 (별도 §11.209b-pre)
- ⚠️ "approver 자동 매핑 = ownerId fallback" → 재고 — ProcurementRole 우선 활용 가능

다음 Phase 0 audit step (필요):

1. approval-policy-surface-engine 의 호출 지점 grep — 어떤 mutation 이 호출하는지
2. workspace.approvalPolicy seed 위치 — `prisma/seed.ts` 또는 workspace create handler
3. PO 전환 mutation 의 정확한 진입점 (purchase 에서 PO 발행 흐름)
