# LabAxis Procurement Governance OS — Architecture Reference

> 설계 권한선과 변경 금지선을 고정하기 위한 운영형 기술 문서.
> 최종 업데이트: Batch 21 (RC0 Midpoint Review / Graduation Re-evaluation Pack) 완료 시점.

---

## 1. Layer Map

```
┌─────────────────────────────────────────────────────────────┐
│ Circular Procurement Chain (100+ engines)                    │
│ Sourcing → Compare → Approval → PO → Dispatch → Fire →     │
│ Sent → Tracking → Ack → Receiving → Stock Release →         │
│ Available Inventory → Reorder → procurement_reentry          │
├─────────────────────────────────────────────────────────────┤
│ Governance Grammar Registry (central vocabulary)             │
│ ├─ 13 stages × 47 statuses × 26 dock actions               │
│ ├─ 11 panels × 3 severity levels × 8 domains               │
│ ├─ Stage visibility (ga / pilot / hidden)                   │
│ └─ Single lookup authority for all labels                   │
├─────────────────────────────────────────────────────────────┤
│ Governance Event Bus                                         │
│ ├─ Publish/Subscribe (domain/caseId/poNumber/severity)      │
│ ├─ Canonical Invalidation Rules (18 rules)                  │
│ ├─ Stale Detection (per-domain freshness tracking)          │
│ └─ Targeted Invalidation (4 scopes)                         │
├─────────────────────────────────────────────────────────────┤
│ 5-Layer Hardening Pipeline                                   │
│ ├─ Concurrency Guard                                        │
│ ├─ Reconnect / Replay                                       │
│ ├─ Persistence Layer                                        │
│ ├─ Idempotent Mutation                                      │
│ └─ Error Boundary                                           │
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
│ Audit / Compliance                                           │
│ ├─ Governance Audit Engine (decision log + compliance)      │
│ ├─ Compliance Snapshot Store (periodic + event-driven)      │
│ ├─ 7-section Export Schema                                  │
│ ├─ CSV/JSON Serialization                                   │
│ ├─ Approval Timeline Integration (9 event types)            │
│ └─ Rollout Audit Closure Verification                       │
├─────────────────────────────────────────────────────────────┤
│ Runtime Signal & Release Readiness                           │
│ ├─ Release Readiness Engine (structural gate checks)        │
│ ├─ App Runtime Signal Provider (5 signal axes)              │
│ │   RS-1 Grammar Coverage                                   │
│ │   RS-2 Hardening Pipeline                                 │
│ │   RS-3 Event Bus Health                                   │
│ │   RS-4 Audit/Compliance Wiring                            │
│ │   RS-5 Pilot Activation Safety                            │
│ ├─ Signal Freshness Tracking (calculatedAt/ageMs/stale)     │
│ └─ Structured Report (overallHealthy/score/critical/warn)   │
├─────────────────────────────────────────────────────────────┤
│ Pilot Activation & Monitoring                                │
│ ├─ Pilot Plan (scope/checklist/rollback plan/monitoring)    │
│ ├─ Activation Checklist (required items gating)             │
│ ├─ Rollback Trigger Evaluator (6 triggers, 4-level rec)    │
│ ├─ Active Pilot Health Summary (checklist ≠ operational)    │
│ ├─ Dashboard / Audit Handoff Tokens                         │
│ └─ Monitoring Surface (center/rail/dock)                    │
├─────────────────────────────────────────────────────────────┤
│ Product Acceptance E2E                                       │
│ ├─ 6 Scenarios (A-F: closed loop / change / discrepancy /  │
│ │   stale / multi-actor / pilot rollback)                   │
│ ├─ 5 Structural Validators (grammar / handoff / irreversible│
│ │   / terminal separation / send state separation)          │
│ └─ Structured Report (accepted / rejected / conditional)    │
├─────────────────────────────────────────────────────────────┤
│ Operational Readiness Final Gate                             │
│ ├─ 7 Category Evaluators                                    │
│ │   1. Structure Integrity                                  │
│ │   2. Runtime Health                                       │
│ │   3. Mutation Safety                                      │
│ │   4. Pilot Safety                                         │
│ │   5. Observability                                        │
│ │   6. Operational Continuity                               │
│ │   7. Scope Control                                        │
│ ├─ Verdict: go / conditional_go / no_go                     │
│ ├─ Activation Scope Recommendation                          │
│ ├─ Release Candidate Snapshot                               │
│ └─ Operational Readiness Workbench (center/rail/dock)       │
├─────────────────────────────────────────────────────────────┤
│ RC0 Pilot Launch (Batch 19)                                  │
│ ├─ RC0 Scope Freeze (stage/domain/PO/duration/actor lock)  │
│ ├─ Scenario Freeze (6 pilot scenarios, PO seed range)       │
│ ├─ Signoff Registry (5 roles, 4 required)                   │
│ ├─ Day-0 Monitoring Pack (13 points × 6 categories)        │
│ ├─ Rollback Drill (10-step template, pass/fail/partial)     │
│ ├─ Launch Readiness (5-condition gate)                      │
│ └─ RC0 Pilot Launch Workbench (center/rail/dock)            │
├─────────────────────────────────────────────────────────────┤
│ Pilot Graduation (Batch 20)                                  │
│ ├─ Pilot Metrics Aggregation (18 KPIs)                      │
│ ├─ Pilot Completion Evaluation (11 criteria, 5 verdicts)    │
│ │   completed_successfully / completed_conditionally /       │
│ │   rollback_required / cancelled / insufficient_evidence    │
│ ├─ Graduation Path (4 paths)                                │
│ │   remain_internal / expand_pilot / ready_for_ga /          │
│ │   rollback_and_reassess                                    │
│ ├─ Restart/Reassess Workflow (4 statuses, remediation)      │
│ └─ Graduation Workbench (center/rail/dock)                  │
├─────────────────────────────────────────────────────────────┤
│ RC0 Midpoint Review (Batch 21)                               │
│ ├─ Non-Compliance Case Review (7 root cause categories)     │
│ ├─ Soft Blocker Pattern Analysis (repeat/concentration)     │
│ ├─ Dwell Risk Analysis (4 risk levels)                      │
│ ├─ Graduation Projection (policy-preserving simulation)     │
│ ├─ Midpoint Verdict (4 levels)                              │
│ │   stable / stable_but_insufficient_time /                  │
│ │   attention_required / risk_increasing                     │
│ ├─ Handoff Token (dashboard/audit/graduation exact links)   │
│ ├─ Export Pack (metrics + analysis + plan + evidence)        │
│ └─ Midpoint Review Workbench (center/rail/dock)             │
├─────────────────────────────────────────────────────────────┤
│ React Surface                                                │
│ ├─ Policy Primitives (5)                                    │
│ ├─ Line Delta Primitives (5)                                │
│ ├─ Explainability Primitives (6)                            │
│ ├─ Workbenches (20+)                                        │
│ ├─ Dashboard Panels (8+4)                                   │
│ ├─ QuoteChainProgressStrip (13-stage, visibility gating)    │
│ ├─ Pilot Activation / Monitoring Workbench                  │
│ ├─ Operational Readiness Workbench                          │
│ ├─ RC0 Pilot Launch Workbench                               │
│ ├─ Graduation Workbench                                     │
│ └─ TanStack Query Hooks                                     │
├─────────────────────────────────────────────────────────────┤
│ Shell / Routing / Continuity                                 │
│ ├─ Route Map (dashboard/inbox/case/workbench/history)       │
│ ├─ Handoff Flow (resolution/stale/drilldown)                │
│ ├─ Case Continuity (domain switch + stale + navigation)     │
│ └─ Breadcrumbs + Rail Persistence                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Quote Chain Stage Map (13 stages)

| Order | Stage | Phase | Label | Visibility |
|-------|-------|-------|-------|------------|
| 0 | quote_review | sourcing | 견적 검토 | ga |
| 1 | approval | approval | 승인 | ga |
| 2 | po_conversion | approval | PO 변환 | ga |
| 3 | po_created | dispatch | PO 생성 | ga |
| 4 | dispatch_prep | dispatch | 발송 준비 | ga |
| 5 | sent | dispatch | 발송 완료 | ga |
| 6 | supplier_confirmed | fulfillment | 공급사 확인 | ga |
| 7 | receiving_prep | fulfillment | 입고 준비 | ga |
| 8 | receiving_execution | fulfillment | 입고 실행 | pilot |
| 9 | stock_release | inventory | 재고 릴리즈 | ga |
| 10 | reorder_decision | inventory | 재주문 판단 | ga |
| 11 | pilot_activation | inventory | 파일럿 활성화 | pilot |
| 12 | release_readiness | inventory | 릴리즈 준비도 | pilot |

---

## 3. Governance Domain Map (8 domains)

| Domain | Scope | Owner Engine |
|--------|-------|-------------|
| quote_chain | Quote → PO conversion | quote-approval-governance-engine |
| dispatch_prep | PO created → ready_to_send | dispatch-preparation-engine |
| dispatch_execution | send scheduled → sent | dispatch-execution-engine |
| supplier_confirmation | sent → confirmed | supplier-confirmation-engine |
| receiving_prep | confirmed → receiving ready | receiving-preparation-engine |
| receiving_execution | receiving start → complete | receiving-execution-engine |
| stock_release | received → released | stock-release-engine |
| reorder_decision | released → reorder/no_action | reorder-decision-engine |

---

## 4. Canonical Source of Truth Map

| Domain | Canonical Object | Single Writer | Readers |
|--------|-----------------|---------------|---------|
| Permission | `PermissionCheckResult` | `checkPermission()` | all workbenches, inbox, dashboard |
| Approval | `ApprovalSnapshotV2` | `decideApprovalV2()` | consume guard, fire/stock/exception |
| Conflict Diagnostics | `PolicyApprovalConflictPayload` | `buildPolicyApprovalConflictPayload()` | all surfaces (consumption contract) |
| Org Policy | `OrgPolicyDecision[]` | `evaluateAllOrgPolicies()` | conflict diagnostics, policy surface |
| Ownership | `ResolvedOwner` | `resolveOwner()` | dashboard, inbox, workbench |
| PO Conversion | `PoConversionDraftObject` | `buildPoConversionDraftObject()` | po-created-reentry |
| Dispatch Prep | `DispatchPreparationObject` | `buildDispatchPreparationObject()` | dispatch-execution |
| Dispatch Execution | `OutboundExecutionState` | state transitions | supplier-confirmation |
| Supplier Confirmation | `SupplierConfirmationObject` | `buildSupplierConfirmationObject()` | receiving-prep |
| Receiving Execution | `ReceivingExecutionObject` | `buildReceivingExecutionObject()` | stock-release |
| Stock Release | `StockReleaseObject` | `buildStockReleaseObject()` | reorder-decision |
| Reorder Decision | `ReorderDecisionObject` | `buildReorderDecisionObject()` | procurement-reentry |
| Grammar | `CHAIN_STAGE_GRAMMAR` / `STATUS_GRAMMAR` / `DOCK_ACTION_GRAMMAR` | governance-grammar-registry | ALL engines + surfaces |
| Runtime Signal | `AppRuntimeSignalReport` | `buildAppRuntimeSignalReport()` | release readiness, pilot monitoring, operational gate |
| Product Acceptance | `ProductAcceptanceReport` | `buildProductAcceptanceReport()` | operational gate |
| Operational Gate | `OperationalReadinessVerdict` | `evaluateOperationalReadinessGate()` | workbench surface |
| Release Candidate | `ReleaseCandidateSnapshot` | `buildReleaseCandidateSnapshot()` | audit, compliance |
| RC0 Launch | `RC0ScopeFreeze` + `LaunchReadinessCheck` | `createRC0ScopeFreeze()` + `evaluateLaunchReadiness()` | graduation engine |
| Pilot Graduation | `PilotCompletionEvaluation` + `GraduationDecision` | `evaluatePilotCompletion()` + `evaluateGraduationPath()` | graduation workbench |
| Restart Assessment | `RestartAssessment` | `createRestartAssessment()` + `evaluateRestartReadiness()` | graduation workbench |

### Preview vs Truth 경계

| Surface | Role | Truth Source |
|---------|------|-------------|
| Dashboard panels | projection | Metrics + Inbox + Ownership engines |
| Workbench center | decision surface | engine state (never recompute) |
| Workbench rail | reference | conflict payload / context snapshots |
| Workbench dock | action execution | engine mutation only |
| Simulation result | preview (NOT truth) | simulation engines |
| Pilot monitoring | observation | runtime signal report (read-only) |
| Operational gate | judgment | 7 category evaluators (read-only) |
| RC0 launch | execution setup | scope freeze + signoff + drill (read-only after freeze) |
| Pilot graduation | judgment | completion + graduation (read-only) |
| Restart assessment | remediation tracking | restart readiness (write: remediation status only) |
| React local state | UI navigation only | never approval/policy truth |

---

## 5. Event Bus & Invalidation

### Event Bus Contract
- Publish/subscribe with filtering: domain, caseId, poNumber, severity
- Domain-scoped subscription (subscriber receives only relevant domain events)
- History tracking with configurable retention

### Targeted Invalidation (4 scopes)
1. `surface_only` — UI re-render, no engine recompute
2. `readiness_recompute` — dispatch/receiving readiness 재계산
3. `state_transition_check` — 상태 전이 가능 여부 재확인
4. `handoff_invalidate` — 다음 stage로의 handoff token 무효화

### Canonical Invalidation Rules
| Trigger Event | Invalidation Scope |
|--------------|-------------------|
| PO conversion completed | dispatch_prep readiness |
| PO conversion reopened | dispatch_prep + po_created |
| Supplier profile changed | dispatch_prep payload |
| Approval snapshot invalidated | dispatch_prep + po_created |
| Policy hold changed | dispatch_prep readiness |
| Attachment added/removed | dispatch_prep readiness |
| Send scheduled | dispatch_execution state |
| Schedule cancelled | dispatch_prep readiness |
| Supplier response received | supplier_confirmation state |
| Receiving completed | stock_release readiness |
| Stock released | reorder_decision readiness |
| Compliance snapshot captured | audit panels |

---

## 6. Hardening Pipeline (5 layers)

| Layer | Purpose | Guard |
|-------|---------|-------|
| Concurrency Guard | 동일 object 동시 mutation 방지 | lock + retry |
| Reconnect / Replay | 연결 끊김 후 이벤트 재수신 | event sequence tracking |
| Persistence | 상태 변경 영속화 | write-ahead + confirm |
| Idempotent Mutation | 중복 실행 방지 | operation ID dedup |
| Error Boundary | 에러 격리 + 복구 | fallback + notification |

---

## 7. Blocker & Severity System

### Unified Severity (3 levels only)
| Severity | Label | Color | Description |
|----------|-------|-------|-------------|
| info | 정보 | sky | 참고 사항 |
| warning | 경고 | amber | 주의 필요, 작업 가능 |
| critical | 심각 | red | 즉시 조치 필요 |

"error"는 severity가 아님. 시스템 예외는 error boundary에서 처리.

### Blocker Severity
| Type | Effect | Color |
|------|--------|-------|
| hard | irreversible action 잠금, 진행 차단 | red |
| soft | 경고 표시, 진행 가능 | amber |

---

## 8. Operational Readiness Final Gate (7 categories)

| Category | Evaluates | Blocker 시 |
|----------|----------|-----------|
| Structure Integrity | release readiness + product acceptance | go 차단 |
| Runtime Health | 5 runtime signals | critical signal → go 차단 |
| Mutation Safety | hardening pipeline + irreversible protection | go 차단 |
| Pilot Safety | checklist + rollback + role gating | go 차단 |
| Observability | audit log + compliance + reporting | audit 불가 → go 차단 |
| Operational Continuity | reconnect + replay + persistence | persistence 이상 → go 차단 |
| Scope Control | PO/domain/duration/stage/role 범위 | 빈 범위 → go 차단 |

### Verdict 결정
- blocker 1건 이상 → `no_go` (score 무관)
- blocker 0건, conditional 1건 이상 → `conditional_go`
- blocker 0건, conditional 0건 → `go`

### Activation Scope
| Scope | 조건 |
|-------|------|
| hold | no_go |
| pilot_limited | conditional_go 또는 go + 보수적 |
| pilot_expanded | go + high score + 0 conditional |
| internal_only | go 전 단계 |

---

## 9. Release Candidate Snapshot

go/conditional_go 승인 시 반드시 고정하는 묶음:

- grammar registry version (stage/status/action count)
- runtime signal report summary
- product acceptance verdict + passed/total
- pilot plan ID + status
- compliance snapshot summary (total/non-compliant/latest)
- rollback recommendation
- gate verdict + score
- approver
- recommended scope
- timestamp

---

## 10. Mutation Boundary

| Risk Level | Actions | Lifecycle | SoD | Simulation |
|-----------|---------|-----------|-----|------------|
| **immediate** | single assign (non-critical) | skip | no | no |
| **reviewed** | create, update, critical assign | draft→review→apply | author≠reviewer | optional |
| **governed** | bulk reassign, transfer, >3 affected | draft→review→approve→execute→audit | author≠reviewer, dual | required |
| **irreversible** | go/conditional_go/send_now/approve | confirmation + role gating | required | N/A |

### Irreversible Action 보호
- dock only — center/rail에서 irreversible action 절대 금지
- stale 상태 시 잠금
- confirmation dialog 필수
- role gating 필수
- snapshot validity fail 시 잠금

---

## 11. Test Coverage Matrix

| Suite | Type | Count |
|-------|------|-------|
| Fire Approval Scenarios | Integration | 12 |
| Governance Stress | Integration | 12 |
| Policy Surface Rollout | Integration | 12 |
| Multi-Actor Concurrency | Integration | 10 |
| Governance Loop E2E | E2E | 12 |
| Ownership Authoring E2E | E2E | 12 |
| Ownership Governance Stress | Integration | 10 |
| Governance Batch 2 E2E | E2E | 4 |
| Batch 13 Productization | Unit | 22 |
| App Runtime Signal | Unit | 30 |
| Pilot Monitoring | Unit | 30 |
| Product Acceptance E2E | E2E | 36 |
| Operational Readiness | Unit | 33 |
| RC0 Pilot Launch | Unit | 42 |
| Pilot Graduation | Unit | 40 |
| RC0 Midpoint Review | Unit | 30 |
| **Total** | | **347** |

---

## 12. 변경 금지선 (Immutable Rules)

1. **engine output = truth, React = projection** — UI에서 approval/policy/ownership reason 재계산 금지
2. **optimistic unlock 금지** — mutation success 전 상태 변경 금지
3. **blocked ≠ approval_needed ≠ reapproval_needed** — 상태 혼합 금지
4. **auditSafeTrace → UI 표시 금지** — export/history에서만 사용
5. **center = judgment, rail = reference, dock = execution** — 역할 교차 금지
6. **consumption contract** — 14 field × surface × transform 규칙 위반 금지
7. **narrowest scope wins** — policy와 ownership 동일 원칙
8. **most restrictive effect wins** — policy merge 동일 원칙
9. **SoD: author ≠ reviewer** — policy와 ownership 동일
10. **consumed snapshot retroactive invalidation 불가**
11. **ready_to_send ≠ sent** — dispatch_prep과 dispatch_execution은 다른 domain
12. **blocker 1건이라도 있으면 go 불가** — score가 아무리 높아도 무시
13. **grammar registry 외 label 하드코딩 금지**
14. **checklist 완료율 ≠ 운영 건강도** — 절대 같은 것으로 취급 금지
15. **pilot activation이 engine 코드를 수정하면 안 됨**
16. **acceptance/gate는 read-only** — truth를 변경하지 않음
17. **stage/domain 추가는 grammar registry에서만** — 개별 engine에서 하드코딩 금지
18. **RC0 scope freeze 후 변경은 새 RC0 생성** — 기존 RC0 수정 금지
19. **signoff 전원 완료 전 launch 금지** — 부분 서명으로 launch 불가
20. **rollback drill 미통과 시 launch 금지** — drill pass가 launch readiness 필수 조건
21. **duration 만료 = pilot 완료 아님** — evidence 기반 완료 판정만 허용
22. **rollback 후 즉시 relaunch 금지** — reassessment + remediation 완료 후에만 restart
23. **GA 승인은 irreversible에 준하는 판단** — role gating + confirmation 필수
24. **midpoint review는 read-only 분석** — graduation policy 변경 없이 projection만 제공
25. **projection은 시뮬레이션** — completed_conditionally를 강제로 success로 바꾸는 로직 금지

---

## 12-A. 전역 오버레이 패턴 (Global Overlay Directives)

> Gemini 3.1 Pro Preview 지시문을 LabAxis governance grammar 에 맞게 정제하여 확정.

1. **문맥 유지 (Context Preservation)**
   - 사용자가 대시보드에서 복잡한 태스크(발주 실행, 상세 내역 검토 등)를 수행할 때, 페이지 이동을 최소화한다.
   - 우측에서 슬라이드되는 **Global Peek Drawer (Sheet)** 패턴을 사용하되,
     본격 검토는 반드시 full workbench (center/rail/dock) 로 hand-off 한다.
   - peek drawer 에서 terminal action (승인/발송/삭제 등) 을 직접 수행하지 않는다.

2. **전역 상태 관리 (Global State)**
   - overlay 열림/닫힘 상태는 Zustand 기반 전역 store (`useOrderPeekOverlayStore`) 에서 관리한다.
   - 개별 컴포넌트 `useState` 로 overlay 를 제어하지 않는다.
   - 앱 내 어느 곳(Action Ledger, Notification, Order Card 등) 에서든
     `openById(caseId)` 또는 `open(payload)` 1회 호출로 동일 drawer 를 호출할 수 있어야 한다.

3. **최상위 마운트 (Top-level Mounting)**
   - overlay 컴포넌트는 `DashboardShell` (최상위 레이아웃) 에 단일 mount 한다.
   - 하위 컴포넌트에 mount 할 경우 z-index 충돌, overflow:hidden 잘림,
     modal-in-modal focus trap 문제가 발생한다 — 원천 차단.

4. **ID 기반 데이터 참조 (ID-based Data Fetching)**
   - overlay store 에 무거운 객체 데이터를 통째로 넣지 않는다. `activeCaseId` (식별자) 만 저장한다.
   - drawer 컴포넌트 내부에서 해당 ID 를 이용해 domain store (`useOrderQueueStore` 등) 에서
     최신 데이터를 find 하여 렌더링한다. (Single Source of Truth 유지)
   - payload 기반 호출도 지원하되, payload 는 "호출자가 zip 한 hint" 이며 canonical truth 가 아님을 명시한다.

5. **workbench 와의 경계 (Overlay ≠ Workbench)**
   - overlay (peek drawer) 는 1-shot read-only summary 이다. center/rail/dock grammar 를 흉내내지 않는다.
   - overlay 에서 mutation / irreversible action / approval 결선 을 수행하지 않는다.
   - "워크벤치 열기" CTA 가 유일한 결선 경로이다.

---

## 13. File Map (핵심 파일)

### Governance Infrastructure
- `governance-grammar-registry.ts` — 중앙 어휘 레지스트리 (13 stages, 47 statuses, 26 actions)
- `governance-event-bus.ts` — 이벤트 발행/구독/무효화
- `governance-audit-engine.ts` — 감사 로그 + 컴플라이언스 스냅샷
- `governance-hardening-pipeline.ts` — 5-layer 보호

### Chain Engines (per stage)
- `po-conversion-engine.ts` → `po-created-reentry-engine.ts` → `dispatch-preparation-engine.ts` → `dispatch-execution-engine.ts` → `supplier-confirmation-engine.ts` → `receiving-execution-engine.ts` → `stock-release-engine.ts` → `reorder-decision-engine.ts`

### Release & Pilot
- `release-readiness-engine.ts` — 구조 gate 검증
- `app-runtime-signal-provider.ts` — 5 runtime signal
- `pilot-activation-engine.ts` — pilot plan/checklist/rollback
- `pilot-monitoring-engine.ts` — rollback trigger/health/handoff
- `product-acceptance-engine.ts` — 6 scenario E2E 검증
- `operational-readiness-gate-engine.ts` — 최종 7-category gate
- `rc0-pilot-launch-engine.ts` — RC0 scope freeze/signoff/drill/launch readiness
- `pilot-graduation-engine.ts` — completion evaluation/graduation path/restart/metrics
- `rc0-midpoint-review-engine.ts` — non-compliance/blocker pattern/dwell risk/projection/midpoint verdict

### Workbenches
- `quote-chain-workbenches.tsx` — progress strip (visibility gating)
- `pilot-activation-workbench.tsx` — activation + monitoring
- `operational-readiness-workbench.tsx` — final gate
- `rc0-pilot-launch-workbench.tsx` — RC0 launch
- `graduation-workbench.tsx` — pilot graduation/GA approval
- `rc0-midpoint-review-workbench.tsx` — midpoint review/projection/handoff
