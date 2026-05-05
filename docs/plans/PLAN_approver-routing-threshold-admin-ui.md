# Implementation Plan: #approver-routing-threshold-admin-ui

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit (Workspace metadata 부재 → schema migration 결정) → Phase 1 RED 16/19 fail → Phase 2 GREEN (schema + migration + helper + route + zod + form component, 20/20 PASS + regression 35) → Phase 3 ADR close

⛔ DO NOT change matrix structure (저액 → ADMIN, 고액 → OWNER fallback chain 유지)
⛔ DO NOT add per-user limit field (별도 batch — `#approver-routing-per-user-limit`)
⛔ DO NOT bypass admin role check (PATCH 시 ADMIN 만)
⛔ DO NOT change default value (10,000,000) — backward compat 보장

---

## 0. Truth Reconciliation

**Latest Truth Source (audit 발견):**
- Workspace 모델 — metadata Json field 0 → 새 column 추가 필수 (schema migration)
- `/api/workspaces/[id]` PATCH 라우트 land (zod schema name/slug)
- `apps/web/src/app/dashboard/settings/page.tsx` — React Query + mutation 패턴 land (form section 자연)
- `WorkspaceMember.role === ADMIN` 만 settings 변경 가능 (verifyWorkspaceAccess helper)

**Conflicts Found:**
- 직전 §11.209d-approver-routing 의 임계치 hardcoded — workspace 별 운영 정책 미반영
- env config (Option B) 는 redeploy 필요 → 운영 중 변경 불가

**Chosen Source of Truth (Option A):**
- Workspace.approvalThresholdKrw Int @default(10000000) — schema migration
- selectApproverByAmount 가 threshold 인자 받음 (없으면 APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW default)
- request-approval/route.ts — workspace.approvalThresholdKrw 조회 후 helper 에 전달
- settings page — ADMIN role 만 visible 한 form section ("결재 임계치 (KRW)")
- /api/workspaces/[id] PATCH zod schema 에 approvalThresholdKrw 추가

**Environment Reality Check:**
- vitest @ apps/web (host)
- prisma migrate deploy (host) — DB 변경
- prisma generate (host) — type 갱신

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — 직전 approver-routing 의 운영 가용성 확장
- 호영님 운영 중 임계치 변경 가능 (회사 정책 반영)

## 2. Work Type
- [x] Schema (1 column 추가)
- [x] API (PATCH zod schema 확장)
- [x] Web (settings page form section)
- [x] Workflow / Ontology Wiring (helper threshold 인자)

## 3. Overview

Workspace 별 결재 임계치 변경 가능 — admin UI form + DB column. 직전 hardcoded default (1,000만원) 는 backward compat fallback 으로 유지.

**Success Criteria:**
- [ ] schema.prisma — Workspace.approvalThresholdKrw Int @default(10000000)
- [ ] migration SQL (ALTER TABLE ADD COLUMN + DEFAULT)
- [ ] selectApproverByAmount 가 threshold 인자 받음 (optional, default APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW fallback)
- [ ] request-approval/route.ts — workspace.approvalThresholdKrw select + helper 에 전달
- [ ] /api/workspaces/[id] PATCH — zod schema approvalThresholdKrw 추가 (positive int) + ADMIN 권한 체크
- [ ] settings/page.tsx — ADMIN role 만 visible 한 form section (input number + 저장 mutation)
- [ ] 한국어 label ("결재 임계치 (KRW)" / 도움말 "X KRW 이상 결재는 OWNER escalation")

**Out of Scope (별도 batch):**
- per-user approval limit
- 부서별 routing 매트릭스
- multiple-OWNER round-robin
- threshold 다중 단계 (예: 100만원 / 1,000만원 / 1억원)

**User-Facing Outcome:**
- workspace ADMIN 이 settings 에서 결재 임계치 변경 가능
- 즉시 다음 결재 요청부터 반영
- workspace 별 다른 임계치 정책

## 4. Product Constraints

**Must Preserve:**
- [x] backward compat (default 10,000,000 — 기존 workspace 영향 0)
- [x] self-approval 차단 lock
- [x] mutation atomic (helper read-only)
- [x] ADMIN role 체크 (admin UI / PATCH 모두)

**Must Not Introduce:**
- [x] per-user limit (별도 batch)
- [x] dead button (ADMIN 외 사용자에게 form hide)

**Canonical Truth Boundary:**
- Source of Truth: Workspace.approvalThresholdKrw (DB)
- Default fallback: APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW (helper 상수)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| schema column 추가 | workspace 별 분리 + 운영 중 변경 가능 | migration 부담 (호영님 host prisma migrate deploy) |
| Int + default | 단순 type, NULL 회피 backward compat | 향후 multi-tier 임계치 시 재설계 |
| ADMIN role gate | 정책 변경 권한 제한 | MEMBER 는 form 미visible |

**Dependencies:**
- 직전 §11.209d-approver-routing helper (land)
- /api/workspaces/[id] PATCH (land)
- settings/page.tsx React Query 패턴 (land)

**Integration Points:**
- `apps/web/prisma/schema.prisma` — Workspace.approvalThresholdKrw 추가
- `apps/web/prisma/migrations/.../migration.sql` (NEW)
- `apps/web/src/lib/billing/approver-routing.ts` — selectApproverByAmount threshold 인자 추가
- `apps/web/src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts` — workspace select + helper 호출 변경
- `apps/web/src/app/api/workspaces/[id]/route.ts` — zod schema 확장
- `apps/web/src/app/dashboard/settings/page.tsx` — form section 추가

## 6. Global Test Strategy

- vitest unit (helper threshold 인자 시나리오)
- vitest source-level grep (schema + migration + route + form)

## 7. Implementation Phases (3 phases, 5-7h)

### Phase 0: Context & Truth Lock ✅
- audit 완료 (위 §0)

### Phase 1: 🔴 RED (1.5-2h)
- 🔴 RED:
  - `schema/workspace-approval-threshold.test.ts` — schema + migration + Int default 10000000
  - `lib/billing/approver-routing.test.ts` — threshold 인자 추가 case (workspace threshold 사용 vs default fallback)
  - `api/workspaces/workspace-patch-threshold.test.ts` — zod schema + ADMIN gate
  - `dashboard/settings-approval-threshold-form.test.ts` — form section + 한국어 label + ADMIN visibility

### Phase 2: 🟢 GREEN (3-4h)
- schema.prisma + migration SQL
- approver-routing.ts — threshold 인자 추가
- request-approval/route.ts — workspace.approvalThresholdKrw select + helper 호출
- /api/workspaces/[id] PATCH — zod schema 확장
- settings/page.tsx — form section 추가

### Phase 3: ✋ Quality Gate + ADR + commit (1h)
- vitest pass + regression 0
- ADR-002 #approver-routing-threshold-admin-ui CLOSED entry
- commit message draft + 호영님 host (git push + prisma generate + prisma migrate deploy)

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| migration backward compat | Low | High | default 10000000 (모든 기존 workspace 자동 채움) |
| ADMIN role check 누락 (form/PATCH) | Med | High | helper verifyWorkspaceAccess + zod 검증 |
| 사용자 입력 validation (음수, 0, 비현실적 큰 값) | Med | Med | zod min(0).max(10_000_000_000) — 100억 cap |
| settings page React Query invalidate | Low | Low | onSuccess invalidate `['workspace']` |

## 10. Rollback Strategy

- Phase 1: 테스트 revert
- Phase 2: 5 file revert + DB rollback (`ALTER TABLE Workspace DROP COLUMN approvalThresholdKrw`)
- Phase 3: full revert via git revert SHA

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ Complete
- **Next validation:** 호영님 host (`git push` + `prisma generate` + `prisma migrate deploy`) + settings 페이지 smoke (ADMIN 로그인 → 임계치 form visible / MEMBER 로그인 → form hide / 변경 후 다음 결재 요청 반영)

**Phase Checklist:**
- [x] Phase 0 complete (audit — schema migration 결정)
- [x] Phase 1 complete (RED tests — 16/19 fail)
- [x] Phase 2 complete (GREEN — 7 file, 20/20 PASS + regression 35)
- [x] Phase 3 complete (ADR + commit + host migration)

## 12. Notes & Learnings

**Implementation Notes:**
- Schema migration 단순 (Int + DEFAULT) — USING cast 불필요, backward compat 자동.
- 별도 component 신설 = settings page 큰 파일 inline 부담 회피, 작은 surgical 보존.
- Optional threshold 인자 + default fallback = 직전 caller backward compat.
- ADMIN role gate 다중 (UI hide + server zod + verifyWorkspaceAccess) = defense in depth.

**Lessons (cluster level):**
1. 큰 파일 inline 회피 = 별도 component 신설.
2. Optional argument + default fallback = backward compat lock.
3. Max cap (100억) = 비현실적 입력 UX 안전망.
4. ADMIN role gate 다중 = defense in depth.
5. Test split (schema / helper / route / form) = 변경 source 정합 검증 분리.

**Deferred Follow-ups:**
- `#approver-routing-multi-tier-threshold` — 다중 단계 (예: 100만원 / 1,000만원 / 1억원)
- `#approver-routing-per-user-limit` — WorkspaceMember.approvalLimit field
- `#approver-routing-department-routing` — 부서별 routing
- `#approver-routing-audit-log` — threshold 변경 audit log
