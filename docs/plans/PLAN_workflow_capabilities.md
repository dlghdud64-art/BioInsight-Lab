# Implementation Plan: §11.193d Phase 2 — Workflow Capabilities Multi-Role

- **Status:** 🔄 In Progress
- **Started:** 2026-05-02
- **Last Updated:** 2026-05-02
- **Estimated Completion:** 2026-05-04

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `prisma/schema.prisma` line 25-31 — `OrganizationRole` enum 5종 (VIEWER/REQUESTER/APPROVER/ADMIN/OWNER)
- `prisma/schema.prisma` line 104-119 — `OrganizationMember` model, single `role` 필드, `@@unique([userId, organizationId])` — 1인 1 role per org
- `lib/permissions/permission-checker.ts` line 96-130 — role 별 permission array, single-role check 패턴 다수 caller
- ADR §11.193d Phase 1: Phase 1 minimal-diff (mapping 만), Phase 2 multi-capability schema 추가 예정
- 호영님 prototype 시안: "1인 동시 Lab Manager + Approver + Requester 보유"

**Conflicts Found:**
- 현재 schema (single role) vs 시안 (multi capabilities) — schema layer 추가 필요
- Phase 1 의 `orgRoleLabel` 매핑 → Phase 2 라벨 재사용 가능 (drift 0)

**Chosen Source of Truth:** prisma schema + 시안 multi-capability requirement → **새 layer 추가, 기존 single role 보존** (RBAC 영향 0).

**Environment Reality Check:**
- [x] repo / branch context — main, working tree
- [x] runnable commands — npx prisma migrate dev / npx vitest / npx tsc
- [x] execution blockers — FUSE readonly 환경 (manual commit-tree workflow 사용)

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [x] P2 / Deferred (호영님 명시적 priority override)

**Why This Priority:**
- 현재 P1 (vitest install / prisma generate / RFQ smoke 등) 과 충돌 0
- 호영님 prototype 시안 정합 (visible UX value)
- 명시적 진행 요청 → 일반 priority 보다 호영님 결정 우선

---

## 2. Work Type

- [x] Feature (workflow capabilities multi-role)
- [ ] Bugfix
- [ ] API Slimming
- [x] Workflow / Ontology Wiring
- [x] Migration / Rollout (prisma column 추가)
- [ ] Billing / Entitlement
- [ ] Mobile
- [x] Web (settings page)
- [x] Design Consistency (Phase 1 mapping 정합 완료, Phase 2 multi-badge)

---

## 3. Overview

**Feature Description:**
1인 운영자가 동시에 여러 workflow capability (Lab Manager + Approver + Requester) 를 보유 가능하도록 schema + UI 확장. 기존 OrganizationRole (RBAC) 은 보존하고 별도 layer 로 운영 tag 추가.

**Success Criteria:**
- [ ] `OrganizationMember.workflowCapabilities Json` column 추가 + migration apply
- [ ] 기존 member 의 role 기반 자동 backfill (drift 0)
- [ ] settings/page.tsx 의 운영 역할 section 에 multi-badge 표시
- [ ] Admin endpoint 로 capabilities edit 가능 (Phase 4)
- [ ] permission-checker 변경 0 (RBAC 보존)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] Workflow role assignment onboarding flow (별도 트랙)
- [ ] Mobile UI capabilities 표시 (별도 트랙)
- [ ] Bulk capabilities edit UI

**User-Facing Outcome:**
운영자가 settings 페이지에서 본인의 workflow capabilities 를 multi-badge 로 확인 가능. ADMIN/OWNER 가 다른 member 의 capabilities 추가/제거 가능.

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock (settings panel only, 영향 0)
- [x] same-canvas (settings 안의 운영 역할 section 안에서 multi-badge)
- [x] canonical truth (DB column = canonical, UI 변형 0)
- [x] invalidation discipline (capabilities edit 시 query cache invalidate)

**Must Not Introduce:**
- [x] page-per-feature (settings/page.tsx 안에서만)
- [x] chatbot/assistant 재해석
- [x] dead button / no-op / placeholder success
- [x] fake billing/auth shortcut
- [x] preview overriding actual truth

**Canonical Truth Boundary:**
- Source of Truth: `OrganizationMember.workflowCapabilities Json` (DB)
- Derived Projection: `resolveWorkflowCapabilities(member)` helper (DB 우선, null 시 role 기반 derive)
- Snapshot / Preview: 0 (변형 미사용)
- Persistence Path: POST `/api/organizations/[id]/members/[userId]/capabilities` (Phase 4)

**UI Surface Plan:**
- [x] Existing route section (settings/page.tsx 운영 역할)
- [ ] Inline expand
- [ ] Right dock
- [ ] New page (⚠️ 사용 0)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| Schema A1 (Json) — `workflowCapabilities Json @default("[]")` | minimal-diff, migration 1줄, rollback 쉬움 | json_contains query 약함, index 약함 — pilot 단계 적합, 후속 evolve 가능 |
| 기존 `role` (RBAC) 보존 | permission-checker 변경 0, drift 위험 0 | column 2개 (role + capabilities) 공존 — 의미 분리 명확화 필요 |
| Read-only resolver (DB 우선 + role 기반 fallback) | legacy member backfill 누락 시에도 안전 | resolver 호출 비용 (in-memory derive) |

**Dependencies:**
- Required Before Starting: prisma client up-to-date
- External Packages: 0 (기존 prisma + zod 활용)
- Existing Routes / Models / Services Touched:
  - `prisma/schema.prisma` (column 추가)
  - `lib/permissions/workflow-capabilities.ts` (신규)
  - `app/dashboard/settings/page.tsx` (multi-badge 적용)
  - `app/api/organizations/[id]/members/[userId]/capabilities/route.ts` (신규, Phase 4)

**Integration Points:**
- prisma schema migration
- query/mutation (Phase 4)
- settings panel (multi-badge UI)
- audit log (Phase 4)

---

## 6. Global Test Strategy

All phases must follow Red-Green-Refactor.

**Test Strategy by Work Type:**
- Schema migration → migration source-level smoke (regex)
- Helper logic → unit tests (capabilities derive, edge cases)
- Settings UI → import smoke (§11.193f helper) + structural smoke
- Admin endpoint → integration test (권한 분기 + audit log)

**Execution Notes:**
- vitest run per phase
- prisma migrate dev (local) → smoke verify → prod 적용 (Phase 5)

---

## 7. Implementation Phases

### Phase 1: Schema 결정 + Prisma migration + helper

**Goal:** `workflowCapabilities` column 추가 + helper + RED→GREEN.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- prisma schema 변경 source-level smoke (`workflowCapabilities Json` 강제)
- helper unit test RED (`getWorkflowCapabilities` / `WORKFLOW_CAPABILITIES` 강제)

**🟢 GREEN:**
- `OrganizationMember.workflowCapabilities Json @default("[]")` 추가
- `npx prisma migrate dev --name add_workflow_capabilities`
- `lib/permissions/workflow-capabilities.ts` 신규
  - `WORKFLOW_CAPABILITIES = ["LAB_MANAGER", "APPROVER", "REQUESTER"] as const`
  - `WorkflowCapability` type
  - `getWorkflowCapabilities(member): WorkflowCapability[]`

**🔵 REFACTOR:** 명명 정합, type alias 정리

**✋ Quality Gate:**
- prisma generate 성공
- migration file 생성 확인
- helper unit test PASS
- permission-checker 변경 0
- schema smoke PASS

**Rollback:** migration revert (down migration) + column drop

---

### Phase 2: Backfill + canonical resolver

**Goal:** 기존 role 기반 자동 mirror + resolver helper.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** resolver test (DB 우선, null 시 role 기반 derive)

**🟢 GREEN:**
- `scripts/backfill-workflow-capabilities.ts` (idempotent)
  - 매핑: ADMIN → ["LAB_MANAGER"], APPROVER → ["APPROVER"], REQUESTER → ["REQUESTER"], OWNER → ["LAB_MANAGER", "APPROVER"], VIEWER → []
- `resolveWorkflowCapabilities(member)` lib 함수
  - DB 값 (Json array) 우선
  - DB 값 빈 배열 + role 비-VIEWER 시 role 기반 derive

**🔵 REFACTOR:** edge case (legacy role 매핑) cleanup

**✋ Quality Gate:**
- backfill idempotent 확인
- resolver test PASS (5+ case)
- tsc 0 errors

**Rollback:** backfill revert (capabilities 빈 배열로 reset)

---

### Phase 3: Settings UI multi-badge

**Goal:** settings/page.tsx 의 운영 역할 section 에 multi-badge 노출.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** settings smoke 갱신 — multi-badge 패턴 강제

**🟢 GREEN:**
- 운영 역할 section refactor (single badge → array iteration)
- §11.193d Phase 1 `orgRoleLabel` 매핑 활용
- empty state ("운영 역할 미설정") + read-only badge
- `resolveWorkflowCapabilities` 호출

**🔵 REFACTOR:** badge 색상 정합 (Lab Manager purple / Approver emerald / Requester blue)

**✋ Quality Gate:**
- settings import smoke PASS (§11.193f helper)
- structural smoke PASS (multi-badge 패턴)
- raw key 노출 0
- canonical truth 변경 0

**Rollback:** single badge 로 revert

---

### Phase 4: Admin endpoint (capabilities edit)

**Goal:** ADMIN/OWNER 가 member 의 capabilities edit.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** integration test (권한 분기 + audit log)

**🟢 GREEN:**
- POST `/api/organizations/[id]/members/[userId]/capabilities`
- ADMIN/OWNER permission check (기존 permission-checker 활용)
- payload zod validation (`WORKFLOW_CAPABILITIES` whitelist)
- audit log (`createAuditLog`)

**🔵 REFACTOR:** error path 정합

**✋ Quality Gate:**
- 권한 분기 test PASS
- audit log persist 확인
- response shape contract test
- mutation invalidate 정합

**Rollback:** endpoint disable (route 삭제) — 기존 capabilities 보존

---

### Phase 5: Rollout / Smoke / Rollback

**Goal:** prod 안전 release + rollback path 명시.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** rollout failure mode 식별 (migration apply 실패 / backfill 누락)

**🟢 GREEN:**
- prod prisma migrate deploy
- backfill script 실행
- Chrome 검증 (settings page multi-badge 노출)
- ADR §11.193d Phase 2 entry append

**🔵 REFACTOR:** 임시 instrumentation 정리

**✋ Quality Gate:**
- prod migration 성공
- settings 페이지 multi-badge 노출 확인
- rollback script 문서화
- ADR closeout

**Rollback:** migration down + backfill revert + endpoint disable

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| prisma migration prod 실패 | Low | High | dev/staging 검증 필수, rollback script 명시 |
| 기존 caller (permission-checker) drift | Low | Med | role 보존 결정으로 drift 차단, smoke test |
| backfill 누락 (legacy member) | Med | Low | resolver fallback (role 기반 derive) |
| Json query 성능 (capabilities 검색) | Low | Low | pilot 단계 query 빈도 낮음, 향후 A3 evolve |
| capabilities edit 권한 escalation | Low | High | ADMIN/OWNER only + audit log + zod whitelist |

---

## 9. Rollback Strategy

- If Phase 1 Fails: migration revert (down migration), column drop
- If Phase 2 Fails: backfill revert, resolver helper rollback
- If Phase 3 Fails: settings UI revert (single badge)
- If Phase 4 Fails: endpoint route 삭제, capabilities 데이터 보존
- If Phase 5 Fails: 모든 phase 역순 revert + Chrome 검증

**Special Cases:**
- DB migration: down migration 항상 동반 (`prisma migrate dev` 가 자동 생성)
- 권한 escalation: 의심 시 endpoint route 즉시 disable

---

## 10. Progress Tracking

- Overall completion: 0%
- Current phase: Phase 1 (RED 시작 예정)
- Current blocker: 0
- Next validation step: prisma schema 변경 + RED smoke 작성

**Phase Checklist:**
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Phase 5 complete

---

## 11. Notes & Learnings

**Blockers Encountered:**
- (none yet)

**Implementation Notes:**
- Schema A1 (Json) 채택 — minimal-diff. 후속 query 빈도 ↑ 시 A3 (join table) 로 evolve 가능.
- Phase 4 admin endpoint 호영님 default 승인으로 포함. read-only-only 면 Phase 4 defer 가능했음.
- 기존 `role` 보존으로 permission-checker 변경 0 — RBAC drift 위험 차단.
