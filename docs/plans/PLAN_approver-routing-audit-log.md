# Implementation Plan: #approver-routing-audit-log

- **Status:** ✅ Complete (CLOSED 2026-05-05)
- **Started:** 2026-05-05
- **Last Updated:** 2026-05-05
- **Actual Completion:** 2026-05-05 — Phase 0 audit (createAuditLog + AuditEventType land 발견) → Phase 1 RED 10/15 fail → Phase 2 GREEN (2 routes + 1 stale test cleanup, 15/15 + 10/10 PASS) → Phase 3 ADR close

⛔ DO NOT add new AuditEventType enum (schema migration 회피 — 기존 SETTINGS_CHANGED + WORK_QUEUE_TASK_GENERATED 재사용)
⛔ DO NOT block mutation atomic — audit log = best effort (try/catch graceful)
⛔ DO NOT log sensitive data (password, API key) in changes/metadata field

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `lib/audit/audit-logger.ts` `createAuditLog(params)` helper land — `AuditLog` model + `AuditEventType` enum (19 values: USER_LOGIN/SETTINGS_CHANGED/WORK_QUEUE_TASK_GENERATED 등)
- 기존 caller — quote/inventory/budget mutation routes 가 createAuditLog 호출 (try/catch graceful)
- 직전 #approver-routing-multi-tier-validation-zod-refine — PATCH route + request-approval route 모두 audit 0

**Conflicts Found:**
- threshold 변경 audit 0 → operational 추적성 부족
- 결재 매핑 audit 0 → "왜 X 가 결재자가 됐나" 추적 불가

**Chosen Source of Truth:**
- (1) `/api/workspaces/[id]` PATCH 안에 threshold 변경 시 createAuditLog (eventType: SETTINGS_CHANGED, entityType: "WORKSPACE", changes: { before: { low, high }, after: { low, high } })
- (2) `request-approval/route.ts` 안에 PR INSERT 후 createAuditLog (eventType: WORK_QUEUE_TASK_GENERATED, entityType: "PURCHASE_REQUEST", metadata: { source, totalAmount, appliedThresholds, approverId, requesterId })
- 둘 다 best effort (try/catch graceful — mutation 결과 영향 0)

**Environment Reality Check:**
- vitest @ apps/web (host)
- DB 변경 0 (기존 enum 재사용)
- 호영님 host 직접 audit 페이지 (dashboard/audit 또는 비슷) 에서 검증

---

## 1. Priority Fit
- **Post-release lock-completion (P1.5)** — operational 추적성 (compliance) + 결재 매핑 audit
- 직전 multi-tier matrix 의 자연 follow-up

## 2. Work Type
- [x] Workflow / Ontology Wiring (audit log 호출 추가)
- [x] Web (route 안 try/catch)

## 3. Overview

threshold 변경 + 결재 매핑 결과 audit log 기록 — operational 추적성 확보.

**Success Criteria:**
- [ ] /api/workspaces/[id] PATCH — threshold 변경 시 createAuditLog (SETTINGS_CHANGED + before/after)
- [ ] request-approval/route.ts — PR INSERT 성공 후 createAuditLog (WORK_QUEUE_TASK_GENERATED + metadata)
- [ ] 둘 다 try/catch graceful (mutation atomic 보호)
- [ ] sensitive data 미포함

**Out of Scope:**
- 새 AuditEventType enum 추가 (schema migration)
- audit log 조회 UI 변경
- audit log filter / search 신설

## 4. Product Constraints

**Must Preserve:**
- [x] mutation atomic (audit log = try/catch graceful)
- [x] 기존 audit log 인프라 (createAuditLog signature)
- [x] sensitive data 0 (password / API key)

**Must Not Introduce:**
- [x] schema migration (enum 신설 0)
- [x] mutation 결과 의존 (audit fail 시 silent)

**Canonical Truth Boundary:**
- Source of Truth: AuditLog row (DB)
- mutation: PurchaseRequest / Workspace (이미 land)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 기존 enum (SETTINGS_CHANGED + WORK_QUEUE_TASK_GENERATED) 재사용 | schema migration 회피 | enum 의미 약간 모호 (operational 의미는 명확) |
| metadata 에 source / amount / approverId 포함 | 결재 매핑 추적성 | metadata size 증가 (Json field, 무시 가능) |
| try/catch graceful | mutation atomic 보호 | audit log fail 시 silent (console.error만) |

**Dependencies:**
- `lib/audit/audit-logger.ts` createAuditLog (land)
- AuditEventType enum (land)
- 직전 multi-tier matrix (land)

**Integration Points:**
- `/api/workspaces/[id]/route.ts` — PATCH 안 createAuditLog 호출
- `request-approval/route.ts` — PR INSERT 성공 후 createAuditLog 호출

## 6. Global Test Strategy

- vitest source-level grep — createAuditLog 호출 + eventType + try/catch + metadata

## 7. Implementation Phases (3 phases, 3-5h)

### Phase 0: Context & Truth Lock ✅
- audit 완료 (위 §0)

### Phase 1: 🔴 RED (1h)
- 🔴 RED:
  - `api/workspaces/workspace-patch-audit-log.test.ts` — PATCH route 의 createAuditLog 호출 + SETTINGS_CHANGED + before/after + try/catch
  - `api/work-queue/request-approval-audit-log.test.ts` — request-approval route 의 createAuditLog + WORK_QUEUE_TASK_GENERATED + metadata + try/catch

### Phase 2: 🟢 GREEN (1.5-2h)
- /api/workspaces/[id]/route.ts — PATCH 안 createAuditLog (threshold 변경 시만, before/after capture)
- request-approval/route.ts — PR INSERT 후 createAuditLog (candidate.source + appliedThresholds + amount)

### Phase 3: ✋ Quality Gate + ADR + commit (0.5-1h)
- vitest pass + regression 0
- ADR-002 #approver-routing-audit-log CLOSED entry
- commit message draft

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| audit log fail → mutation block | Low | High | try/catch graceful |
| sensitive data leak (예: password) | Low | High | metadata 명시적 whitelist |
| metadata size 폭증 | Low | Low | 필요한 필드만 (source/amount/approverId) |
| AuditEventType enum 의미 약화 | Med | Low | ADR 명시 (재사용 정합) |

## 10. Rollback Strategy

- Phase 1: 테스트 revert
- Phase 2: 2 file revert
- Phase 3: full revert via git revert SHA

## 11. Progress Tracking

- **Overall completion:** 100%
- **Current phase:** ✅ Complete
- **Next validation:** 호영님 host (`git push`) + audit page 에서 SETTINGS_CHANGED + WORK_QUEUE_TASK_GENERATED 로그 확인

**Phase Checklist:**
- [x] Phase 0 complete (audit)
- [x] Phase 1 complete (RED tests — 10/15 fail)
- [x] Phase 2 complete (GREEN — 2 routes + 1 stale cleanup, 15/15 + 10/10 PASS)
- [x] Phase 3 complete (ADR + commit)

## 12. Notes & Learnings

**Implementation Notes:**
- before snapshot capture = update 전 fetch + after = updateData ?? beforeValue (partial update 정합).
- 기존 enum 재사용 (SETTINGS_CHANGED + WORK_QUEUE_TASK_GENERATED) — schema migration 회피.
- sensitive data whitelist (metadata 명시적 필드만).
- 직전 stale test 1개 cleanup (helper swap 후 패턴 변경 정합).

**Lessons (cluster level):**
1. Audit log = best effort lock (mutation atomic 보호).
2. 기존 enum 재사용 vs 신설 — 작은 surgical 우선.
3. before snapshot capture = update 전 fetch.
4. sensitive data whitelist = 명시적 metadata 필드만.
5. stale test cleanup = helper swap 후 caller 변경 정합.
6. Karpathy lesson — operational 추적성 0 = silent assumption.

**Deferred Follow-ups:**
- `#approver-routing-audit-log-ui-filter` — audit UI dedicated filter
- `#approver-routing-audit-log-export-csv` — CSV 내보내기
- `#approver-routing-audit-log-retention-policy` — 1년 후 archive
- `#approver-routing-event-type-enum-add` — dedicated enum 신설
