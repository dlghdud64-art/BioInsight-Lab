# LabAxis Procurement Governance OS — Architecture Reference

> 설명 문서가 아닌 **설계 권한선과 변경 금지선을 고정**하기 위한 운영형 기술 문서.

---

## 1. Layer Map

```
┌─────────────────────────────────────────────────────────────┐
│ Circular Procurement Chain (50+ engines)                    │
│ Sourcing → Compare → Approval → PO → Dispatch → Fire →     │
│ Sent → Tracking → Ack → Receiving → Stock Release →         │
│ Available Inventory → Reorder → procurement_reentry          │
├─────────────────────────────────────────────────────────────┤
│ Approval Control Plane                                       │
│ ├─ Permission Policy Engine (6 roles, 31 actions, 6 policy) │
│ ├─ Domain Workbenches (fire/stock/exception gate→ws→res)    │
│ ├─ Shared Validator (single authority 8-check consume)      │
│ ├─ SoD Engine (4-phase actor chain)                         │
│ ├─ Dual Approval Engine (2-slot quorum)                     │
│ ├─ Delegation Provenance (cascade conflict)                 │
│ └─ Safety Guards (bulk guard, handoff contract, stale)      │
├─────────────────────────────────────────────────────────────┤
│ Organization Policy Layer                                    │
│ ├─ 6 Domains (budget/vendor/release/restricted/reorder/sod) │
│ ├─ Scope Hierarchy (system<org<dept<team<site<location)     │
│ ├─ Policy Admin Lifecycle (draft→review→publish→rollback)   │
│ ├─ Policy Simulation (5 modes)                              │
│ └─ Policy Drift Invalidation                                │
├─────────────────────────────────────────────────────────────┤
│ Conflict Diagnostics (Single Truth)                          │
│ ├─ PolicyApprovalConflictPayload (canonical)                │
│ ├─ Consumption Contract (14 fields × surface rules)         │
│ ├─ Display Contract (11-level priority)                     │
│ └─ Operator vs Audit separation                             │
├─────────────────────────────────────────────────────────────┤
│ Ownership Governance Layer                                   │
│ ├─ Resolution Engine (narrowest wins)                       │
│ ├─ Authoring Engine (CRUD + assign/reassign/transfer)       │
│ ├─ Governance Lifecycle (draft→review→approved→applied)     │
│ ├─ Simulation Engine (6 dimensions)                         │
│ ├─ Conflict Remediation (7 types + auto-fix)                │
│ ├─ Execution Queue (staged apply + partial failure)         │
│ ├─ Rollout Audit Closure (8-field completeness)             │
│ └─ Loop Closure (handoff + invalidation rules)              │
├─────────────────────────────────────────────────────────────┤
│ Governance Dashboard                                         │
│ ├─ Batch 1: KPI + Bottleneck + Domain + Blockers            │
│ ├─ Batch 2: Breakdown + Hotspot + Reapproval + Impact       │
│ ├─ Action Loop (recommended actions + deep links)           │
│ ├─ Explainability (risk score + ranking + root cause)       │
│ └─ Ownership Panels (backlog/ownerless/overloaded/coverage) │
├─────────────────────────────────────────────────────────────┤
│ React Surface                                                │
│ ├─ Policy Primitives (5): Badge, MessageStack, Approver,    │
│ │   ReapprovalBanner, NextActionHint                        │
│ ├─ Line Delta Primitives (5): DeltaStrip, BlockerRow,       │
│ │   SubsetChips, ThresholdMarker, StatusIndicator           │
│ ├─ Explainability Primitives (6): ExplanationCard,          │
│ │   WinningScopeBadge, ApprovalSourceTrace,                 │
│ │   EscalationSourceTrace, OverriddenRuleList,              │
│ │   WhyThisEffectPanel                                      │
│ ├─ Workbenches (6+2): Fire, Stock, Exception, Variance,     │
│ │   Receiving, Reorder + PolicyAdmin + GovernanceReview     │
│ ├─ Dashboard Panels (8+4): Batch1(4) + Batch2(4) +         │
│ │   Action(3) + Ownership(4)                                │
│ └─ TanStack Query Hooks (use-approval-policy.ts)            │
├─────────────────────────────────────────────────────────────┤
│ Shell / Routing / Continuity                                 │
│ ├─ Route Map (dashboard/inbox/case/workbench/history)       │
│ ├─ Handoff Flow (resolution/stale/drilldown)                │
│ ├─ Case Continuity (domain switch + stale + navigation msg) │
│ ├─ Governance Loop Closure (dashboard context + invalidation)│
│ └─ Breadcrumbs + Rail Persistence                           │
├─────────────────────────────────────────────────────────────┤
│ Compliance / Audit                                           │
│ ├─ 7-section Export Schema                                  │
│ ├─ CSV/JSON Serialization                                   │
│ ├─ Approval Timeline Integration (9 event types)            │
│ └─ Rollout Audit Closure Verification                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Source of Truth Map

| Domain | Canonical Object | Single Writer | Readers |
|--------|-----------------|---------------|---------|
| Permission | `PermissionCheckResult` | `checkPermission()` | all workbenches, inbox, dashboard |
| Approval | `ApprovalSnapshotV2` | `decideApprovalV2()` | consume guard, fire/stock/exception resolution |
| Conflict Diagnostics | `PolicyApprovalConflictPayload` | `buildPolicyApprovalConflictPayload()` | all surfaces (consumption contract) |
| Org Policy | `OrgPolicyDecision[]` | `evaluateAllOrgPolicies()` | conflict diagnostics, policy surface |
| Policy Version | `PolicyVersion` (active) | `applyPolicyLifecycle()` publish | policy surface, drift invalidation |
| Ownership | `ResolvedOwner` | `resolveOwner()` | dashboard, inbox, workbench, actions |
| Ownership Change | `OwnershipChangeRequest` | `applyOwnershipLifecycle()` | review workbench, execution queue |
| Execution | `ExecutionQueueItem` | `applyExecutionAction()` | execution panel, audit |
| Rollout Audit | `PolicyRolloutRecord` | `applyRolloutAction()` | audit closure, history |
| Inbox | `ApprovalInboxItemV2[]` | `projectApprovalInbox()` | inbox workspace, ranking |
| Dashboard Metrics | `GovernanceMetricsSummary` | `computeGovernanceMetrics()` | dashboard panels |
| Case Context | `CaseContextSnapshot` | `applyCaseNavigation()` | workbench, rail, breadcrumbs |

### Preview vs Truth 경계

| Surface | Role | Truth Source |
|---------|------|-------------|
| Dashboard panels | projection | Metrics + Inbox + Ownership engines |
| Inbox item row | projection | `projectApprovalInbox()` |
| Workbench center | decision surface | engine state (never recompute) |
| Workbench rail | reference | `PolicyApprovalConflictPayload` |
| Workbench dock | action execution | engine mutation only |
| Simulation result | preview (NOT truth) | simulation engines |
| React local state | UI navigation only | never approval/policy truth |

---

## 3. Contract Map

### Approval Snapshot Consume Guard (8 checks)
1. single_use — consumed=false
2. expiry — validUntil > now
3. action_key_match — snapshot vs target (with variants)
4. case_id_match
5. entity_version_match
6. payload_content_hash_match
7. policy_evaluation_hash_match
8. scope_match

### Conflict Payload Consumption (14 fields)
See `conflict-payload-consumption-contract.ts` — each field has:
- allowed surfaces
- allowed transforms (none / display_format only)
- `auditSafeTrace` → UI 표시 절대 금지

### Display Priority (11 levels)
1. operatorSafeSummary → 2. blockReasons → 3. escalation → 4. dual → 5. approvalSource → 6. escalationSource → 7. whyEffect → 8. whyPath → 9. winningRules → 10. overridden → 11. conflicts

Surface max: dashboard(2), inbox row(4), inbox rail(8), workbench center(8), workbench rail(11)

### Governance Loop Invalidation Rules
| Trigger | Invalidates |
|---------|------------|
| resolution_complete | kpi, bottleneck, domain, team, owner, actions |
| policy_changed | ALL |
| ownership_changed | owner, coverage, team, actions |
| ownership_change_applied | owner, coverage, ownerless, overloaded, actions |
| ownership_reverted | ALL ownership panels |
| conflict_remediated | conflict, owner, coverage |
| execution_completed | execution, owner, coverage, audit |
| audit_closed | audit, rollout history |

---

## 4. Entry Point Map

| Entry | Route | Engine | Workbench |
|-------|-------|--------|-----------|
| Governance Hub | `/dashboard/approval` | `GovernanceMetricsSummary` | `GovernanceDashboard` |
| Approval Inbox | `/dashboard/approval/inbox` | `projectApprovalInbox` + `rankApprovalInboxItems` | `ApprovalInboxWorkspace` |
| Case Overview | `/dashboard/approval/case/[id]` | `PolicyApprovalConflictPayload` | Case detail |
| Fire Workbench | `/dashboard/approval/case/[id]/fire_execution` | fire approval gate/res | `FireApprovalWorkbench` |
| Stock Workbench | `/dashboard/approval/case/[id]/stock_release` | stock approval gate/res | `StockReleaseApprovalWorkbench` |
| Exception Workbench | `/dashboard/approval/case/[id]/exception_*` | exception approval gate/res | `ExceptionApprovalWorkbench` |
| Policy Admin | `/dashboard/approval/policy-admin` | `PolicyVersion` lifecycle | `PolicyAdminWorkspace` |
| Ownership Admin | `/dashboard/approval/governance/ownership` | ownership authoring | `OwnershipAuthoringWorkspace` |
| Governance Review | `/dashboard/approval/governance/review` | `OwnershipChangeRequest` | `GovernanceReviewWorkbench` |
| History | `/dashboard/approval/history` | timeline + audit | History view |

---

## 5. Mutation Boundary

| Risk Level | Actions | Lifecycle | SoD | Simulation |
|-----------|---------|-----------|-----|------------|
| **immediate** | single assign (non-critical) | skip lifecycle | no | no |
| **reviewed** | create, update, deactivate, critical assign | draft→review→apply | author≠reviewer | optional |
| **governed** | bulk reassign, transfer, >3 affected | draft→review→approve→execute→audit | author≠reviewer, dual | required |

### autoRemediable 허용 범위
- duplicate_scope deactivation → **OK** (safe, single record)
- overload redistribute → **NO** (requires review)
- escalation gap fill → **NO** (requires approval)
- SoD violation fix → **NO** (requires manual reviewer change)

### Irreversible Action 위치
- **dock only** — approve/reject/apply/revert buttons
- **center에서 절대 irreversible action 노출 금지**
- **rail은 reference/explanation만 — action 금지**

---

## 6. Test Coverage Matrix

| Suite | Type | Covers | Count |
|-------|------|--------|-------|
| Fire Approval Scenarios | Integration | approval flow + tier/SoD/policy/snapshot | 12 |
| Governance Stress | Integration | concurrency + stale + bulk + delegation + ranking | 12 |
| Policy Surface Rollout | Integration | 10 workspace policy surface consistency | 12 |
| Multi-Actor Concurrency | Integration | policy drift + cross-session + invalidation | 10 |
| Governance Loop E2E | E2E | drilldown/return/resolution/invalidation/priority | 12 |
| Ownership Authoring E2E | E2E | CRUD + governance loop + resolution | 12 |
| Ownership Governance Stress | Integration | SoD + guard + conflict + execution + audit | 10 |
| Governance Batch 2 E2E | E2E | happy path + remediation + partial failure + audit closure | 4 |
| **Total** | | | **84** |

### 아직 비는 시나리오
- [ ] massive transfer (100+ scopes)
- [ ] simultaneous reviewer contention
- [ ] future-dated overlap chain resolution
- [ ] partial failure followed by re-run (not just rollback)
- [ ] revert after downstream dependency mutation
- [ ] cross-governance: policy publish during ownership execution
- [ ] delegation chain + ownership change intersection

---

## 7. 변경 금지선 (Immutable Rules)

1. **engine output = truth, React = projection** — UI에서 approval/policy/ownership reason 재계산 금지
2. **optimistic unlock 금지** — mutation success 전 상태 변경 금지
3. **blocked ≠ approval_needed ≠ reapproval_needed** — 이 3개 상태 혼합 금지
4. **auditSafeTrace → UI 표시 금지** — export/history에서만 사용
5. **center = judgment, rail = reference, dock = execution** — 역할 교차 금지
6. **consumption contract** — 14 field × surface × transform 규칙 위반 금지
7. **narrowest scope wins** — policy와 ownership 모두 동일 원칙
8. **most restrictive effect wins** — policy merge 시 동일 원칙
9. **SoD: author ≠ reviewer** — policy와 ownership 모두 동일
10. **consumed snapshot retroactive invalidation 불가** — 이미 실행된 것은 되돌리지 않음
