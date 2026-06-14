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
**P0 확정 (조사 완료 2026-06-14):**
- **approvalLimit schema = 3곳:** `User.approvalLimit`(BigInt?, §11.97 — settings 운영정책 *표시용*) / `WorkspaceMember.approvalLimit`(Int?) / `OrganizationMember.approvalLimit`(Int?, null=무제한). 결재 한도 canonical = **OrganizationMember.approvalLimit**(approver-routing 정합, org 컨텍스트). User 필드는 표시용 별개.
- **canonical 한도 검증 패턴 = `approvalLimit == null || approvalLimit >= totalAmount`** — `selectApproverByAmount`(approver-routing.ts:120-123)가 DB-side filter로 동일 사용. helper가 이 패턴 재사용(SoT 정합).
- **갭 정확화:** 요청 *라우팅*(selectApproverByAmount)엔 한도 반영됨. **승인 실행 시점에 actor 한도 재검증이 부재** → 권한 보유 actor가 자기 한도 초과 건 직접 승인 가능.
- **동작 확정(호영님):** 한도 초과 actor 직접 승인 → **403 차단 + "상위 승인자 필요" 안내**. 자동 escalation 라우팅은 후속 트랙(복잡도↑).
- **승인 실행 경로 = 5곳:** `request/[id]/approve`(purchase_request, totalAmount — **1차 대상 확정**) / `ai-actions/[id]/approve` / `admin/orders/[id]/status` / `receiving-drafts/[id]/approve` / `ai-actions/generate/quote-rationale`. ⚠️ **P1에서 각 경로 "금액 결재" 성격 분류** — totalAmount 결재 승인만 한도 게이트 대상(입고/일부 ai-action은 금액 결재 아닐 수 있음 → 오적용 방지).
- **helper 위치:** `lib/security/approval-limit-guard.ts`(신규).

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
- Overall: 90% 코드 (P0~P3 완료, single-surface 확정) — operator 실 vitest+build+push + 라이브 smoke 잔여
- Current: P4 smoke(operator/라이브 — 한도 설정 계정 초과 승인 차단 실측)
- Checklist: [x]P0 [x]P1 [x]P2 [x]P3 [ ]P4

## 12. Notes
- [2026-06-14] S2 HIGH 확정 근거: ABAC 빈 슬롯·라우팅 read-only·승인 route 한도 부재. 카테고리 예산축은 해소(무관).
- [2026-06-14] **경로 분류 결과: 금액 결재 승인 = `request/[id]/approve` 1곳**. ai-actions(totalAmount:0)·order_status_change(상태 전이)·receiving(입고 확인)·quote-rationale(generate)는 금액 결재 아님 → 제외(오적용 방지). order 직접 생성(api/orders)은 예산 차단 있음 + create≠결재 → 별 워크플로 이슈로 분리(호영님 결정). → S2 single-surface.
- [2026-06-14] helper `lib/security/approval-limit-guard.ts`(순수함수, null=무제한·amount<=limit). request/approve teamMember 게이트 다음 pre-tx 검증 → 초과 시 403 + requiresHigherApprover. 카테고리 예산 게이트 보존. 격리 self-check 16/16(로직 경계 + wiring + budget 보존).
- [2026-06-14] escalation 자동 라우팅(설계 의도)은 후속 트랙 — 본 트랙은 차단(403)으로 우회 먼저 닫음.
