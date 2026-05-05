# Implementation Plan: #approver-routing-per-user-limit (Phase 1 server)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-05

⛔ DO NOT add OrganizationMember.approvalLimit (별도 batch — workspace 만)
⛔ DO NOT add admin UI (별도 batch — server wiring 우선)
⛔ DO NOT change matrix (low/mid/high) — approvalLimit 은 candidate 검증 layer 만 추가

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `WorkspaceMember` model — userId/workspaceId/role (ADMIN/MEMBER) 만, approvalLimit 0
- 직전 selectApproverByAmount helper — candidate fetch (workspace_admin / self_admin / org_admin / org_owner) + return
- 매트릭스 (low/mid/high) 가 amount 기반 escalation

**Conflicts Found:**
- 동일 workspace ADMIN 이 모든 결재 처리 — 단일 건 한도 0 → 큰 결재도 workspace_admin 매핑
- per-user 한도 개념 0 → 부서별/역할별 한도 정책 반영 불가

**Chosen Source of Truth:**
- WorkspaceMember.approvalLimit Int? — null = 무제한 (default), 값 = 단일 건 한도
- helper: candidate fetch 시 user.approvalLimit 함께 join → amount > limit 시 다음 tier fallback (low → mid → high)
- organization member (ADMIN/OWNER) 는 한도 무제한 (최고 결재 — 본 batch out)

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — 매트릭스 정교화 마지막 server-side layer

## 2. Work Type
- [x] Schema (1 column 추가)
- [x] Workflow / Ontology Wiring (helper logic 확장)

## 3. Overview

WorkspaceMember.approvalLimit 추가 + helper 가 candidate 의 한도 검증 후 fallback. amount 가 candidate 의 approvalLimit 초과 시 자동으로 다음 tier escalation.

**Success Criteria:**
- [ ] schema — WorkspaceMember.approvalLimit Int?
- [ ] migration SQL (ADD COLUMN, nullable)
- [ ] helper — workspace_admin / self_admin 분기 시 user.approvalLimit join + 검증 + fallback
- [ ] approvalLimit null 시 무제한 (default)
- [ ] test (schema + helper unit 시나리오)

**Out of Scope:**
- admin UI (별도 batch — `#approver-routing-per-user-limit-admin-ui`)
- OrganizationMember.approvalLimit
- audit log 신설 (PERMISSION_CHANGED 또는 새 enum 별도 batch)

## 4. Product Constraints

**Must Preserve:**
- [x] backward compat (null = 무제한, 모든 기존 member 영향 0)
- [x] 직전 매트릭스 (low/mid/high) 분기 보존
- [x] organization member 한도 무제한 (escalation 보장)

**Canonical Truth Boundary:**
- WorkspaceMember.approvalLimit (DB) = source
- helper 가 candidate fetch 시 user 정보 + approvalLimit join

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| WorkspaceMember 만 (org 미포함) | 작은 surgical, 단순 | org member 한도 별도 batch |
| Int? null = 무제한 | backward compat | "한도 0" 의미 모호 (0 = 모든 결재 거부) |
| helper 안 검증 | 단일 source | helper 복잡도 증가 |

## 6. Implementation Phases (3 phases, 3-4h)

### Phase 1: 🔴 RED (1h)
- schema test + helper approvalLimit 검증 시나리오 (4-5 cases)

### Phase 2: 🟢 GREEN (1.5-2h)
- schema.prisma + migration SQL
- helper — candidate fetch 시 user.approvalLimit join + 검증 + fallback

### Phase 3: ADR + commit (0.5h)

## 11. Progress Tracking
- **Overall:** 0%
- **Current:** Phase 1

## 12. Notes & Learnings
(빈 섹션 — phase 진행 시 채움)
