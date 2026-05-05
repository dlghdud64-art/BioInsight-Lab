# Implementation Plan: §11.209d-approver-routing

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit (WorkspaceMemberRole OWNER 부재 → 매트릭스 정정) → Phase 1 RED 15/15 fail → Phase 2 GREEN (helper + route swap, 15/15 PASS + regression 131) → Phase 3 ADR close

⛔ DO NOT modify WorkspaceMemberRole enum (현재 ADMIN/MEMBER — schema migration 회피)
⛔ DO NOT add ProcurementRole 별도 enum (별도 batch)
⛔ DO NOT change existing approver fallback chain order (single-admin workspace 호환 유지)
⛔ DO NOT bypass mutation atomic (helper 가 read-only DB query — atomic 영향 0)

---

## 0. Truth Reconciliation

**Latest Truth Source (audit 발견):**
- `WorkspaceMemberRole` enum = **ADMIN / MEMBER** 만 (OWNER 없음)
- `OrganizationRole` enum = VIEWER / REQUESTER / APPROVER / ADMIN / **OWNER**
- `Workspace ↔ Organization 1:1` (Workspace.organizationId @unique, NOT NULL since 2026-04-17)
- 직전 §11.209d-pr-auto-create 의 자동 매핑 = workspace ADMIN 첫 (본인 외) → self-admin fallback. OWNER 매핑 0.

**Conflicts Found:**
- 직전 매트릭스 default 추천 = "workspace OWNER" → schema 부재. 정정 필요.
- "고액 escalation OWNER" 패턴은 workspace 가 아닌 organization 의 OWNER 사용 가능.

**Chosen Source of Truth (재조정 매트릭스):**
- **< 1,000만원**: workspace ADMIN 첫 (본인 외) → self-admin fallback (현재 logic)
- **≥ 1,000만원**: organization OWNER 첫 (본인 외) → organization ADMIN fallback → workspace ADMIN fallback
- threshold 상수 = `APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW = 10_000_000`
- helper return 에 `source` 필드 (workspace_admin / org_owner / org_admin / self_admin) — 추적성

**Environment Reality Check:**
- DB 변경 0 (schema migration 0)
- 기존 OrganizationMember role=OWNER 데이터 활용
- request-approval/route.ts swap 만

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — §11.209d cluster 결재자 매핑 정교화
- multiple-ADMIN workspace silent random 해결
- 고액 결재 OWNER escalation lock

## 2. Work Type
- [x] Workflow / Ontology Wiring (helper + caller swap)
- [x] Web (lib helper)

## 3. Overview

결재 요청 시 결재자 자동 매핑을 금액 임계치 기반으로 정교화. workspace ADMIN 만 사용하던 것을 organization OWNER escalation 으로 확장.

**Success Criteria:**
- [ ] `lib/billing/approver-routing.ts` (NEW) — `selectApproverByAmount` helper
- [ ] threshold 상수 (1,000만원) export — 향후 env/admin UI 변경 가능
- [ ] return shape: `{ userId, email, name, source }` (source 4 enum)
- [ ] request-approval/route.ts swap (workspaceMember 조회 + helper 호출)
- [ ] fallback chain 정합 (org_owner → org_admin → workspace_admin → self)
- [ ] 본인 외 우선 + single-admin fallback 보존

**Out of Scope (별도 batch):**
- ProcurementRole 별도 enum + schema migration
- 부서별 routing (Lab Team / 그룹)
- approval limit per-user setting (admin UI)
- threshold env/admin UI override
- multiple-OWNER 라운드로빈 (현재 first-match)

**User-Facing Outcome:**
- 결재 요청 응답 (PR INSERT) 의 approver 가 금액 따라 다른 사용자
- email 발송 + in-app 알림 모두 정확한 escalation target 사용자에게

## 4. Product Constraints

**Must Preserve:**
- [x] mutation atomic (helper read-only)
- [x] single-admin workspace fallback (self-admin 호환)
- [x] 본인 외 우선 (requester ≠ approver lock)

**Must Not Introduce:**
- [x] schema migration (작은 surgical 우선)
- [x] dead button (helper return null 시 route 가 400 + 운영자 친화 메시지)

**Canonical Truth Boundary:**
- Source of Truth: WorkspaceMember + OrganizationMember + Quote.totalAmount
- Derived Projection: ApproverCandidate (선정 결과)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 임계치 1,000만원 hardcoded | 작은 surgical, ADR 명시 | env/admin UI override 별도 batch |
| OrganizationMember.role=OWNER 활용 | schema 부재 회피 | workspace 안의 별도 OWNER 0 (organization 단위만) |
| source 필드 반환 | audit 추적성 | 호출처가 source 무시 가능 (현재 사용 0) |

**Dependencies:**
- WorkspaceMember + OrganizationMember + Workspace.organizationId (모두 land)
- request-approval/route.ts (land)

**Integration Points:**
- `apps/web/src/lib/billing/approver-routing.ts` (NEW)
- `apps/web/src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts` — 자동 매핑 swap

## 6. Global Test Strategy

- vitest unit test for selectApproverByAmount (mock db with 4 시나리오: 저액+ADMIN / 저액+self_admin / 고액+OWNER / 고액+OWNER 없음 fallback)
- request-approval route grep test (helper import + 사용 정합)

## 7. Implementation Phases (3 phases, 4-6h)

### Phase 0: Context & Truth Lock ✅
- audit 완료 (위 §0)

### Phase 1: 🔴 RED (1-1.5h)
- 🔴 RED:
  - `apps/web/src/__tests__/lib/billing/approver-routing.test.ts` — helper 4 시나리오 + threshold 상수 + source 필드
  - `apps/web/src/__tests__/api/work-queue/request-approval-routing-wiring.test.ts` — request-approval route 의 selectApproverByAmount import + 사용 정합

### Phase 2: 🟢 GREEN (2-3h)
- `lib/billing/approver-routing.ts` (NEW) — helper + threshold 상수
- `request-approval/route.ts` — workspaceMember 의 organizationId select 추가 + 자동 매핑 logic swap
- 직전 매핑 코드 (adminMember + fallbackAdmin) 제거

### Phase 3: ✋ Quality Gate + ADR + commit (1h)
- vitest pass + regression 0
- ADR-002 §11.209d-approver-routing entry CLOSED + 매트릭스 정책 명시
- commit message draft

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| OrganizationMember role=OWNER 데이터 부재 | Med | Med | fallback chain (org_admin → workspace_admin) 보장 |
| 임계치 hardcoded 향후 변경 부담 | Med | Low | ADR + 상수 export — env/admin UI 별도 batch |
| Self-approval (requester == OWNER) | Low | Med | userId !== requesterId 필터 강제 |
| Quote.totalAmount null/0 | Low | Low | 0 이면 < threshold → workspace ADMIN routing |

## 10. Rollback Strategy

- Phase 1: 테스트 revert
- Phase 2: 2 file revert (helper + route)
- Phase 3: full revert via git revert SHA

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ Complete
- **Next validation:** 호영님 host `git push` + 결재 요청 smoke (저액/고액 견적 INSERT 후 approver 매핑 정확)

**Phase Checklist:**
- [x] Phase 0 complete (audit — 매트릭스 재조정)
- [x] Phase 1 complete (RED tests — 15/15 fail)
- [x] Phase 2 complete (GREEN — helper + route swap, 15/15 PASS + regression 131)
- [x] Phase 3 complete (ADR + commit)

## 12. Notes & Learnings

**Implementation Notes:**
- Phase 0 audit 가 WorkspaceMemberRole OWNER 부재 즉시 발견 → 매트릭스 정정 (workspace OWNER → organization OWNER).
- self_admin fallback 은 저액 분기만 — 고액 시 escalation 보호.
- helper 모든 query 가 `userId: { not: requesterId }` 필터 강제 (self-approval 차단 lock).
- DB 변경 0 — 기존 OrganizationMember role=OWNER 데이터 그대로 활용.

**Lessons (cluster level):**
1. Phase 0 audit 가 silent wrong assumption 차단 (Karpathy lesson).
2. self-approval 차단 lock = candidate.userId !== requesterId 강제.
3. self_admin fallback 은 저액에만 — 비즈니스 의도 (escalation) 명시.
4. 임계치 hardcoded + ADR lock = 작은 surgical 우선 (env override 별도 batch).
5. source 필드 = audit 추적성 (현재 사용 0, 향후 monitoring lock).

**Deferred Follow-ups:**
- `#approver-routing-threshold-admin-ui` — admin UI/env 임계치 override
- `#approver-routing-multi-owner-roundrobin` — multiple OWNER 라운드로빈
- `#approver-routing-procurementrole-enum` — ProcurementRole schema migration
- `#approver-routing-department-routing` — 부서별 routing (Lab Team)
- `#approver-routing-per-user-limit` — WorkspaceMember.approvalLimit field
