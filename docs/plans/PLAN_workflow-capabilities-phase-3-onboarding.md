# Implementation Plan: §11.193d Phase 3 — Workflow Capabilities Onboarding & Admin Edit UI

- **Status:** 🔄 In Progress
- **Started:** 2026-05-03
- **Last Updated:** 2026-05-03
- **Estimated Completion:** 2026-05-04 (8-15h)
- **Selected Scope:** Option **β** (signup wiring + admin capability edit UI, 5 phases, medium scope)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success / page-per-feature regression

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- HEAD `ed0caa1e` (§11.197c) + working tree §11.197d (placeholder font fix, push 완료)
- `apps/web/prisma/schema.prisma` — `OrganizationMember.workflowCapabilities Json @default("[]")` (§11.193d Phase 2.1)
- `apps/web/src/lib/permissions/workflow-capabilities.ts` — `resolveWorkflowCapabilities` (DB 우선 + role 기반 fallback) + `WORKFLOW_CAPABILITY_LABEL` + `WORKFLOW_CAPABILITY_BADGE_CLS`
- `/api/organizations/[id]/members/[memberId]/capabilities` — PATCH endpoint (§11.193d Phase 2.4) ADMIN/OWNER-only, zod whitelist, audit log
- `apps/web/src/app/dashboard/settings/page.tsx` — multi-badge UI (§11.193d Phase 2.3)
- prod 검증 결과: 호영님 `/api/organizations` → `{ organizations: [] }` (OrganizationMember 0 entry)

**Secondary References:**
- `apps/web/scripts/backfill-workflow-capabilities.ts` (이전 컨텍스트) — 기존 OrganizationMember 만 backfill, signup 시점 wiring 없음
- 이전 컨텍스트 deferred: "§11.193d Phase 3: workflow role assignment onboarding flow"
- 이전 컨텍스트 deferred: "§11.193d Phase 2 추가: workflow capabilities edit UI surface (admin endpoint 만 있음, UI 없음)"

**Conflicts Found:**
- "Phase 3 onboarding flow" 의 정확한 spec 부재 — 본 plan 으로 정의
- sysRole=ADMIN 인 호영님이 자동으로 어떤 OrganizationMember 가 되어야 하는지 정책 부재

**Chosen Source of Truth:**
- `schema.prisma` + `workflow-capabilities.ts` resolver = canonical
- `/api/organizations` 응답 shape = multi-badge UI contract
- signup / workspace create 위치 = OrganizationMember 자동 생성 entry point (Phase 0 audit 으로 확정)

**Environment Reality Check:**
- [x] vitest / tsc 가능
- [ ] `.git` readonly (호영님이 직접 commit/push)
- [x] Chrome MCP prod 검증 가능

---

## 1. Priority Fit

**Current Priority Category:**
- [x] Post-release / 안정 단계 트랙
- [ ] P1 immediate / Release blocker / P2 deferred

**Why This Priority:**
§11.193d Phase 2 (multi-badge 시각 시안) 은 main 반영됐으나 **데이터 부재로 발화 불가** (호영님 0 organization). 본 Phase 3 가 데이터 layer 의 누락 wiring 을 메우고, admin 이 멤버별 capability 를 직접 토글할 수 있게 하여 §11.193d cluster 를 완결. P1 (vitest install / RFQ smoke / Batch 10 enforce) 와 충돌 없음.

---

## 2. Work Type

- [x] Feature
- [x] Workflow / Ontology Wiring
- [ ] Bugfix / API Slimming / Migration / Billing / Mobile / Design Consistency

---

## 3. Overview

**Feature Description:**
신규 user 가 워크스페이스를 생성할 때 owner OrganizationMember 가 자동 생성되며, 기본 workflowCapabilities 가 role 기반으로 설정된다. 또한 admin/members surface 에서 멤버별 capability 를 same-canvas right dock 으로 토글 가능.

**Success Criteria:**
- [ ] 신규 user signup → workspace create → OrganizationMember row 자동 insert
- [ ] sysRole=ADMIN 인 user 의 organization membership 정책 결정 + 적용
- [ ] admin/members 페이지에서 멤버 capability 토글 sheet 동작 (no-op 0)
- [ ] 호영님 화면에서 multi-badge 노출 (System Admin + organization · capability 별 badge)
- [ ] Chrome prod 검증 + ADR §11.200 entry

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 별도 `/dashboard/admin/capabilities` 페이지 신설 (page-per-feature 회피)
- [ ] capability 변경을 chatbot/assistant/command palette 로 reinterpret
- [ ] capability 변경 시 audit log 누락
- [ ] preview overriding actual truth (UI state 가 DB 덮어씀)

**User-Facing Outcome:**
- 호영님 settings 페이지의 운영 역할 카드: System Admin + (조직명 · Lab Manager / Approver / Requester) 다중 badge
- admin/members 페이지: 멤버 row 클릭 → right dock 에서 capability checkbox 토글 → 즉시 반영

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock — admin/members 는 same-canvas right dock 패턴
- [x] same-canvas — 별도 페이지 신설 금지
- [x] canonical truth — `OrganizationMember.workflowCapabilities` Json 이 source
- [x] invalidation discipline — capability 변경 시 `["settings-organizations"]` + admin 쿼리 invalidate

**Must Not Introduce:**
- [x] page-per-feature
- [x] chatbot/assistant reinterpretation of capability ontology
- [x] dead button / no-op / placeholder success
- [x] fake billing/auth shortcut
- [x] preview overriding actual truth

**Canonical Truth Boundary:**
- Source of Truth: `OrganizationMember.workflowCapabilities` (Json, default `"[]"`)
- Derived Projection: `resolveWorkflowCapabilities` resolver output (capabilities[] = DB 우선, fallback role 기반 mirror)
- Snapshot / Preview: settings page badge UI / admin sheet checkbox state
- Persistence Path: PATCH `/api/organizations/[id]/members/[memberId]/capabilities` → DB → query invalidate

**UI Surface Plan:**
- [x] Right dock (admin/members) — capability checkbox sheet
- [ ] New page (⚠️ 명시 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| signup 시점 OrganizationMember 자동 insert | onboarding gap 차단, multi-badge 발화 | signup transaction 에 1 row insert 추가 |
| sysRole=ADMIN 의 organization 정책: **system admin 은 organization 과 별개로 두되, 본인 워크스페이스 생성 시 OrganizationMember 도 함께 생성** | 호영님 같은 system admin 도 자기 워크스페이스에서는 일반 owner 동작 | Phase 0 에서 호영님 confirm 받음 |
| admin UI 는 same-canvas right dock | LabAxis workbench/queue/rail/dock 정합 | 모달 dialog 대비 영역 좁음 (40rem 내) |

**Dependencies:**
- Required Before Starting: §11.193d Phase 2.1~2.5 (완료)
- External Packages: 없음
- Existing Routes / Models / Services Touched:
  - `apps/web/src/app/api/auth/signup/*` (또는 NextAuth user creation hook)
  - `apps/web/src/app/api/workspaces/*` (workspace create)
  - `apps/web/src/app/dashboard/admin/members/page.tsx` (또는 organization members surface)
  - `apps/web/src/app/api/organizations/[id]/members/[memberId]/capabilities/route.ts` (alive endpoint)
  - `apps/web/src/lib/permissions/workflow-capabilities.ts` (resolver — touch 0)

**Integration Points:**
- signup / workspace create transaction
- query invalidation: `["settings-organizations"]`, `["admin-org-members", orgId]`

---

## 6. Global Test Strategy

All phases follow Red-Green-Refactor.

- Phase 1: signup → OrganizationMember row 생성 contract test (integration)
- Phase 2: workspace create transaction 안 OrganizationMember insert + default capability assignment unit test
- Phase 3: admin sheet checkbox 토글 + PATCH 호출 + invalidate flow integration test
- Phase 4: Chrome prod smoke (호영님 시나리오)

---

## 7. Implementation Phases

### Phase 0: Truth Lock + Onboarding Wiring Audit (1h)

**Goal:** 현재 signup / workspace create flow 의 OrganizationMember 생성 wiring 위치 확정 + 호영님 임시 seed 옵션 제공.

- Status: [ ] Pending | [x] In Progress | [ ] Complete

**🔴 RED:** signup endpoint / workspace create endpoint / NextAuth user creation hook 에서 OrganizationMember 생성 여부 audit
**🟢 GREEN:** wiring 위치 확정 + sysRole=ADMIN 정책 호영님 confirm + 임시 seed 가이드 제공
**🔵 REFACTOR:** Phase 1 contract test 의 정확한 entry point 확정

**Audit Targets:**
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` (NextAuth events.createUser)
- `apps/web/src/app/api/workspaces/route.ts` (workspace create)
- `apps/web/src/app/api/organizations/route.ts` (organization create)
- `apps/web/prisma/seed.ts` (seed 패턴 참고)

**✋ Quality Gate:**
- [ ] OrganizationMember 생성 entry point 확정
- [ ] sysRole=ADMIN 정책 결정 (호영님 confirm)
- [ ] 호영님 임시 seed 명령 정의 (Phase 4 검증 enabler)

**Rollback:** planning-only, code 변경 0

---

### Phase 1: Contract & Failing Tests (1-2h)

**Goal:** signup / workspace create → OrganizationMember 자동 생성 + admin capability edit UI 의 contract 를 RED test 로 명문화.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- `__tests__/api/auth/signup-organization-member-auto-create.test.ts` — signup 후 OrganizationMember 1 row 존재
- `__tests__/api/workspaces/create-organization-member-default-capabilities.test.ts` — workspace create 후 owner OrganizationMember.workflowCapabilities 가 role 기반 default
- `__tests__/dashboard/admin-members-capability-sheet.test.tsx` — checkbox 토글 + PATCH 호출 + invalidate

**🟢 GREEN:** 최소 scaffolding (test mock + helper 만, production code 변경 0)

**🔵 REFACTOR:** test naming + scope 정합

**✋ Quality Gate:**
- [ ] failing test 가 real failure (signup 미wired 시)
- [ ] 기존 test 통과 유지
- [ ] vitest + tsc pass

**Rollback:** test 파일 revert

---

### Phase 2: Signup / Workspace Create OrganizationMember Auto-Wire (2-3h)

**Goal:** signup / workspace create 시점에 owner OrganizationMember row 자동 insert + default workflowCapabilities 할당.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Phase 1 의 contract test 가 fail 상태 유지
**🟢 GREEN:**
- workspace create transaction 안에서 owner OrganizationMember insert
- default workflowCapabilities = `ROLE_TO_CAPABILITIES_FALLBACK[role]` (resolver 와 정합)
- sysRole=ADMIN 의 자기 워크스페이스 생성 시 LAB_MANAGER + APPROVER + REQUESTER 부여 (Phase 0 정책 결정 반영)

**🔵 REFACTOR:** transaction 안의 insert 가 fail 시 rollback 보장

**✋ Quality Gate:**
- [ ] Phase 1 RED test 가 GREEN
- [ ] canonical truth 위반 0 (resolver fallback 정합)
- [ ] 신규 signup smoke (vitest mock) pass
- [ ] 기존 signup flow 회귀 0

**Rollback:** workspace create transaction 변경 revert

---

### Phase 3: Admin Members Capability Edit Sheet (3-4h)

**Goal:** admin/members surface 에서 멤버 row 클릭 → right dock checkbox sheet → capability 토글 → PATCH → invalidate.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Phase 1 의 admin-members-capability-sheet test 가 fail 상태 유지
**🟢 GREEN:**
- `apps/web/src/components/admin/member-capability-sheet.tsx` 신규 (~150 line)
- admin/members 페이지에서 row 의 "권한 수정" CTA → 본 sheet open
- 3 capability checkbox + 저장 button → PATCH `/api/organizations/[id]/members/[memberId]/capabilities`
- onSuccess: query invalidate + sheet close + toast

**🔵 REFACTOR:**
- page-per-feature 회피 (right dock only)
- dead button 0 — 저장 button 은 항상 PATCH 발생
- 한국어 라벨 (LAB_MANAGER → "운영 책임자" 등 — 기존 `WORKFLOW_CAPABILITY_LABEL` 사용)

**✋ Quality Gate:**
- [ ] Phase 1 RED test (admin sheet) GREEN
- [ ] no-op 0 (sheet 가 항상 PATCH 발생 또는 disabled)
- [ ] loading / error / empty / disabled state 명시
- [ ] same-canvas 보존 (별도 페이지 0)
- [ ] vitest + tsc pass

**Rollback:** sheet component + admin/members 변경 revert

---

### Phase 4: Rollout / Smoke / Rollback (1-2h)

**Goal:** 호영님 화면 multi-badge 노출 확인 + admin sheet 동작 확인 + ADR 정합.

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** rollout 실패 모드 정의
- Phase 2 의 transaction 변경이 prod signup 실패 유발 가능성
- Phase 3 의 sheet 가 prod 빌드에서 import 누락 가능성

**🟢 GREEN:**
- Phase 0 의 임시 seed 호영님 prod DB 적용 (1 organization + member entry)
- Chrome MCP: settings 페이지 multi-badge 시각 확인
- Chrome MCP: admin/members 페이지 sheet 동작 확인
- ADR §11.200 entry 작성

**🔵 REFACTOR:**
- Phase 0 의 임시 seed cleanup 옵션 (prod 에는 유지)
- 본 plan 의 checkbox 모두 [x] 마감

**✋ Quality Gate:**
- [ ] Chrome prod multi-badge 1+ 노출 (System Admin 외 organization-capability badge)
- [ ] Chrome prod admin sheet 토글 → DB 반영 확인
- [ ] rollback path 명시 (git revert + Phase 0 seed cleanup)
- [ ] ADR §11.200 entry append

**Rollback:**
- git revert Phase 2 + Phase 3 commit
- Phase 0 임시 seed: `DELETE FROM "OrganizationMember" WHERE userId = '...' AND organizationId = '...'`

---

## 8. Workflow / Ontology Addendum

**Resolver Input:** `OrganizationMember.workflowCapabilities` (DB) + `OrganizationMember.role` (fallback)
**Expected Output:** `capabilities[]` ∈ {LAB_MANAGER, APPROVER, REQUESTER}

**Surface Rules:**
- settings 페이지: 운영 역할 카드의 활성 운영 역할 영역 → multi-badge per (org × capability)
- admin/members 페이지: row 의 "권한 수정" CTA → right dock sheet
- chatbot / terminal / sci-fi AI 0

**Validation:**
- [ ] 호영님 user 의 organization × capability badge 노출
- [ ] admin sheet checkbox 토글 → DB 반영 → settings page badge 업데이트

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| signup flow wiring 위치 모호 | High | Med | Phase 0 audit 으로 정확한 entry point 확정 |
| sysRole=ADMIN 의 organization 정책 미결 | High | Med | Phase 0 호영님 confirm |
| Phase 3 admin UI 가 page-per-feature 회귀 유혹 | Med | High | same-canvas right dock 강제, 별도 페이지 금지 |
| transaction 안 insert 실패 시 user 생성 자체 rollback | Med | High | Prisma `$transaction` 사용 강제 |
| `.git` readonly → commit 호영님 측 진행 | High | Low | commit-tree workaround + 호영님 push |
| capability 변경 audit log 누락 | Low | Med | Phase 2.4 endpoint 가 이미 audit log wired (회귀만 방지) |

---

## 10. Rollback Strategy

- **If Phase 1 Fails:** test 파일만 revert (production 무영향)
- **If Phase 2 Fails:** workspace create transaction 변경 revert + 신규 signup 동작 확인
- **If Phase 3 Fails:** admin sheet component + admin/members 변경 revert (sheet 컴포넌트 단위 isolated)
- **If Phase 4 Fails:** Phase 0 seed cleanup + git revert Phase 2/3

**Special Cases:**
- DB schema 변경 0 (§11.193d Phase 2.1 에서 이미 완료)
- soft_enforce / full_enforce 분기 0
- webhook 분기 0

---

## 11. Progress Tracking

- Overall completion: 0%
- Current phase: Phase 0
- Current blocker: 호영님 sysRole=ADMIN organization 정책 confirm 대기
- Next validation step: Phase 0 audit 결과 보고 + 정책 confirm

**Phase Checklist:**
- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- (TBD)

**Implementation Notes:**
- §11.193d Phase 2.1~2.5 의 schema/resolver/endpoint 가 이미 완료 — Phase 3 는 wiring + UI 만
- Phase 0 정책 결정 (sysRole=ADMIN organization 자동 wiring) 이 Phase 2 implementation scope 결정
- 호영님 임시 seed 는 Phase 0 산출물, Phase 4 검증 enabler
