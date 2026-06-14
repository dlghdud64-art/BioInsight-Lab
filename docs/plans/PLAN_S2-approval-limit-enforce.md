# Implementation Plan: S2 — per-user 단일건 승인한도 서버 강제

- **Status:** ⏳ Pending
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-14
- **출처:** docs/audit/ONTOLOGY_SECURITY_AUDIT_2026-06-14.md (S2 HIGH 확정)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 — 체크박스 / quality gate / Last Updated / Notes / 다음 phase.
⛔ quality gate 실패·SoT 충돌 금지.
⛔ **재무 통제(보안) 트랙 — 경로 전수 누락 0이 핵심.** 한 곳만 막으면 우회.

---

## 0. Truth Reconciliation

**Latest Truth Source:** audit 리포트 S2.
**확정 사실:**
- 카테고리/월 예산 = 서버 강제(해소): `request/[id]/approve/route.ts:131-170` SERIALIZABLE + `validateCategoryBudgetInTransaction` → `BudgetBlockedError` → 403.
- per-user `approvalLimit` = **서버 미강제(HIGH)**: 저장만(`workspaces/[id]/members/[memberId]/route.ts`) + 라우팅 추천(`approver-routing.ts` read-only) + ABAC 빈 슬롯(`abac-rules.ts` export {}) + 승인 실행 route에 한도 체크 부재.
**P0 미확정(이번 phase에서 확정):**
- 추정: `approvalLimit` 필드 = WorkspaceMember(또는 OrganizationMember). members route가 PATCH → 필드 존재 추정. **schema 확인 필요.**
- 승인 실행 경로 전수: `request/[id]/approve` 외 — `work-queue/purchase-conversion/*`, `ai-actions/[id]/approve`, `request/[id]/reject`(반대편), admin orders 등 — **인벤토리 필요.**
- 초과 시 동작: 즉시 403 차단 vs 상위 승인자 escalation(approver-routing 연계). **결정 필요.**

**Environment:** sentinel readFileSync+regex. 실 vitest·build·push = operator. prod write 0.

## 1. Priority Fit
- [x] Post-release HIGH 보안 보완 (재무 통제 구멍). 우선순위 2.

## 2. Work Type
- [x] Bugfix(보안) · [x] Workflow/Ontology Wiring(승인 게이트) · [x] Billing/Entitlement 인접(한도)

## 3. Overview
**Description:** per-user `approvalLimit`을 승인 실행 시점에 서버에서 강제 — actor 한도 초과 단건 승인 차단(또는 escalation). 카테고리 예산 게이트와 동일 위치/패턴(SERIALIZABLE tx) 정합.
**Success Criteria:**
- [ ] 승인 실행 경로 전수 인벤토리 + 각 경로에 한도 게이트(누락 0)
- [ ] actor approvalLimit fetch + 대상 금액 비교 → 초과 시 차단/escalation(P0 결정형)
- [ ] 카테고리 예산 게이트와 동일 tx 정합(race 안전)
- [ ] audit 기록(한도 초과 차단 이벤트)
- [ ] sentinel GREEN + 라이브 차단 smoke
**Out of Scope (⚠️):**
- [ ] 카테고리/월 예산 로직 변경(이미 해소)
- [ ] approvalLimit UI/저장 변경(이미 존재)
- [ ] role 매트릭스 변경(S1 해소)

## 4. Product Constraints
**Must Preserve:** 카테고리 예산 게이트, enforceAction role, self-approval 금지, SERIALIZABLE 정합.
**Must Not Introduce:** front-only 차단(UI만), 경로 누락(우회), N+1.
**Canonical Truth Boundary:**
- Source of Truth: WorkspaceMember.approvalLimit(P0 확정) + 대상 금액(purchaseRequest.totalAmount)
- Persistence: 승인 실행 tx 내 검증(쓰기 전 차단)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| 한도 게이트를 승인 실행 tx 내 배치 | 카테고리 예산과 동일 패턴, race 안전 | 경로별 중복 → 공통 helper 추출 |
| ABAC 슬롯 구현 vs 인라인 | 일관성·재사용 | ABAC 구현은 범위↑ — P0에서 택1(기본: 공통 helper) |

**Touched(예상):** `lib/security/`(공통 한도 helper 신규) 또는 `lib/admin/approval-policy.ts`, 승인 실행 route 전수, sentinel.

## 6. Global Test Strategy
- 단위: 한도 비교 helper(초과/이내/한도 미설정 경계).
- 통합: 각 승인 route 한도 초과 → 차단/escalation.
- 라이브 smoke: approvalLimit 설정 계정으로 초과 단건 승인 시도 → 차단 확인.
- 경로 전수 sentinel: 승인 실행 route 각각이 한도 helper 호출.

## 7. Implementation Phases

### Phase 0: Truth — schema + 경로 인벤토리 + 동작 결정
- Status: [ ] Pending
- 🔴 approvalLimit schema 위치 확인(WorkspaceMember/OrganizationMember). 승인 실행 경로 전수 grep. 초과 동작(403 vs escalation) 호영님 결정.
- ✋ Gate: 필드 출처 확정, 경로 목록 완전, 동작 확정. Rollback: planning-only.

### Phase 1: Sentinel (RED) + 공통 helper 계약
- Status: [ ] Pending
- 🔴 RED: 한도 helper(actorLimit, amount)→{allowed, reason} 계약 + 각 승인 route가 helper 호출 계약 — 구현 전 FAIL.
- ✋ Gate: RED 진짜 실패. Rollback: sentinel revert.

### Phase 2: GREEN — 한도 helper 핵심 로직
- Status: [ ] Pending
- 🟢 helper: approvalLimit null/0(무제한 or 미설정) 정책 + 초과 판정. 단위 테스트 경계.
- ✋ Gate: helper 단위 GREEN, 경계(미설정/0/초과/이내). Rollback: helper revert.

### Phase 3: 승인 경로 전수 wiring
- Status: [ ] Pending
- 🟢 각 승인 실행 route에 helper 게이트(tx 내, 카테고리 예산과 동일 위치). 초과 시 차단/escalation + audit. 누락 0.
- ✋ Gate: 전 경로 적용, dead button/no-op 0, front-only 아님(서버 차단). Rollback: route별 revert.

### Phase 4: Smoke + Rollback
- Status: [ ] Pending
- 🟢 라이브: 한도 설정 계정 초과 승인 차단 + audit 기록 + 한도 내 정상 승인. rollback(helper no-op 시 기존 동작=한도 미강제 복귀).
- ✋ Gate: 차단 라이브 확인, audit 기록, rollback 안전. 

## 8. Addendum B (Billing/Entitlement 인접)
- approvalLimit는 entitlement성 한도 — plan별 default(plan-descriptor) 연계 가능성 P0 확인.

## 9. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| 승인 경로 누락 → 우회 잔존 | **Med** | **High** | P0 전수 인벤토리 + 경로별 sentinel |
| approvalLimit 미설정 계정 정책 모호(무제한?) | Med | Med | P0/P2 경계 정책 명시 |
| escalation 택 시 approver-routing 연계 복잡 | Med | Med | 기본 403 차단, escalation은 후속 |

## 10. Rollback
- P1: sentinel / P2: helper / P3: route별 게이트 / P4: helper no-op(한도 미강제=기존). 데이터 비파괴.

## 11. Progress
- Overall: 0% · Current: P0 대기(schema+경로+동작) · Checklist: [ ]P0 [ ]P1 [ ]P2 [ ]P3 [ ]P4

## 12. Notes
- [2026-06-14] S2 HIGH 확정 근거: ABAC 빈 슬롯·라우팅 read-only·승인 route 한도 부재. 카테고리 예산축은 해소(무관).
- P0 핵심: 승인 실행 경로 전수가 우회 차단의 전제.
