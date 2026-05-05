# Implementation Plan: #approver-routing-per-user-limit-admin-ui (Phase 2)

- **Status:** 🔄 In Progress

⛔ DO NOT change Phase 1 schema (WorkspaceMember.approvalLimit Int? — land)
⛔ DO NOT add new page (settings page 안 inline — same-canvas)
⛔ DO NOT bypass ADMIN role gate

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 직전 #approver-routing-per-user-limit Phase 1 — schema + helper land
- `/api/workspaces/[id]/members/[memberId]` PATCH route land (zod = role 만)
- settings page 의 ApprovalThresholdSection (직전 batch) 패턴

**Conflicts Found:**
- Phase 1 의 schema 와 helper 는 server side 만 — admin UI 0 → 호영님 직접 DB 수정 필요
- /members/[memberId] PATCH zod 가 role 만 → approvalLimit update path 0

**Chosen Source of Truth:**
- /api/workspaces/[id]/members/[memberId] PATCH zod 에 approvalLimit?: z.number().int().min(0).max(10_000_000_000).nullable() 추가
- members list GET 응답에 approvalLimit 포함 (이미 select 가능)
- 별도 component WorkspaceMembersApprovalLimitSection 신설 — settings page operator section 안 inline

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — Phase 1 의 자연 follow-up

## 2. Work Type
- [x] API (zod 확장)
- [x] Web (admin UI form)

## 3. Overview

ADMIN 이 workspace settings 에서 각 ADMIN member 의 approvalLimit 설정 가능. null = 무제한, 값 = 한도 KRW.

**Success Criteria:**
- [ ] /members/[memberId] PATCH zod 에 approvalLimit 추가
- [ ] PATCH update logic 에 approvalLimit 반영
- [ ] members GET 응답에 approvalLimit 포함
- [ ] WorkspaceMembersApprovalLimitSection (NEW) — ADMIN 만 visible, member list + 입력 form + null 표시
- [ ] settings page 안 mount

**Out of Scope:**
- audit log (PERMISSION_CHANGED 또는 별도 batch)
- bulk update / CSV import
- OrganizationMember.approvalLimit (별도 batch)

## 4. Product Constraints

**Must Preserve:**
- [x] backward compat (null 무제한)
- [x] same-canvas (settings page 안 inline)
- [x] ADMIN role gate

**Canonical Truth Boundary:**
- WorkspaceMember.approvalLimit (DB) = source

## 5. Dependencies
- Phase 1 server (land)
- /members/[memberId] PATCH route (land)
- ApprovalThresholdSection component pattern (재사용)

**Integration Points:**
- /api/workspaces/[id]/members/[memberId]/route.ts — zod + update
- /api/workspaces/[id]/members/route.ts — GET 응답에 approvalLimit 포함
- components/settings/workspace-members-approval-limit-section.tsx (NEW)
- dashboard/settings/page.tsx — import + mount

## 6. Implementation Phases (3 phases, 4-6h)

### Phase 1: 🔴 RED (1.5h)
- members PATCH zod test (approvalLimit + max cap)
- WorkspaceMembersApprovalLimitSection test (form + ADMIN visibility + 한국어)
- members GET response approvalLimit 포함 test

### Phase 2: 🟢 GREEN (2-3h)
- /members/[memberId]/route.ts — zod 확장 + update logic
- /members/route.ts — GET response select 추가
- workspace-members-approval-limit-section.tsx (NEW) — list + form + mutation
- settings/page.tsx — import + mount

### Phase 3: ADR + commit (0.5-1h)

## 11. Progress Tracking
- **Overall:** 0%
- **Current:** Phase 1

## 12. Notes & Learnings
(빈 섹션)
