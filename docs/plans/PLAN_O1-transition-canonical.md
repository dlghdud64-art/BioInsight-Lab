# Implementation Plan: O1 — Quote 전이 canonical 단일화

- **Status:** ⏳ Pending
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-14
- **출처:** docs/audit/ONTOLOGY_SECURITY_AUDIT_2026-06-14.md (O1 HIGH) + 호영님 도메인 결정(a/b/c)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 — 체크박스 / quality gate / Last Updated / Notes / 다음 phase.
⛔ quality gate 실패·SoT 충돌·dead button/no-op 금지.
⛔ 전이 규칙은 호영님 확정 도메인 결정이 유일 입력 — 임의 추가 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** audit 리포트 O1 + 호영님 결정.
**Conflicts (해소):** quotes status route 로컬 `ALLOWED_STATUS_TRANSITIONS`(route.ts:12-20) vs canonical `state-machine.ts:20-28` 불일치. → **canonical이 SoT**, 로컬 제거.
**호영님 확정 규칙 (canonical QUOTE 최종):**
- PENDING→[PARSED, SENT, CANCELLED]
- PARSED→[SENT, CANCELLED]
- SENT→[RESPONDED, COMPLETED, CANCELLED]
- RESPONDED→[COMPLETED, CANCELLED]
- COMPLETED→[PURCHASED]
- PURCHASED→[]
- **CANCELLED→[PENDING]** ← 유일 변경(O1-a 허용)
- 금지 확정: COMPLETED→CANCELLED(b), PENDING/PARSED→COMPLETED·RESPONDED→PURCHASED skip(c).

**Environment:** sentinel readFileSync+regex(격리 node). 실 vitest·build·push = operator. prod write 0(코드/route만, 스키마 무변경).

## 1. Priority Fit
- [x] Post-release HIGH 보완 (audit O1). 우선순위 1.

## 2. Work Type
- [x] Bugfix (canonical SoT drift) · [x] Workflow/Ontology Wiring (전이 정합)

## 3. Overview
**Description:** quote status 전이 검증을 canonical `validateTransition`(state-machine.ts)로 일원화. 로컬 중복 테이블 제거, CANCELLED→PENDING 재활성화만 canonical에 반영.
**Success Criteria:**
- [ ] `state-machine.ts` ALLOWED_QUOTE_TRANSITIONS에 CANCELLED→[PENDING] 추가(그 외 무변경)
- [ ] `quotes/[id]/status/route.ts` 로컬 테이블 제거 → `validateTransition("QUOTE", from, to)` 사용
- [ ] 에러 응답 한글 라벨/allowedTransitions UX 보존(STATUS_LABELS)
- [ ] S1 stale 주석(:47-48 "인증된 사용자면 허용") 실제(enforceAction role 강제)에 맞게 정정
- [ ] sentinel GREEN (단일화 + 규칙 정합 + 회귀 0)
**Out of Scope (⚠️):**
- [ ] 다른 도메인(ORDER/PURCHASE/RECEIVING) 전이 변경
- [ ] COMPLETED→CANCELLED·skip 전이 추가(금지 확정)
- [ ] 권한 로직 변경(S2 별 트랙)

## 4. Product Constraints
**Must Preserve:** canonical truth(state-machine SoT), enforceAction 권한, 에러 UX(라벨/allowedTransitions).
**Must Not Introduce:** 로컬↔canonical drift 재발, dead import, no-op.
**Canonical Truth Boundary:**
- Source of Truth: `lib/operations/state-machine.ts` (validateTransition)
- Derived: route 에러 응답(STATUS_LABELS 표시)
- Persistence: quote.status update(무변경)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| 로컬 테이블 제거→validateTransition | SoT 단일화, drift 차단 | route 에러 응답을 TransitionResult 기반 재작성 |
| CANCELLED→[PENDING]만 canonical 추가 | 호영님 a) 허용, 그 외 엄격 유지 | 재활성화 권한은 quote_status_change role(별도) |

**Touched:** `lib/operations/state-machine.ts`, `app/api/quotes/[id]/status/route.ts`, sentinel 신규.

## 6. Global Test Strategy
sentinel(readFileSync+regex): canonical CANCELLED→PENDING 존재·COMPLETED→CANCELLED 부재·skip 부재 / quotes route validateTransition 사용·로컬 테이블 부재·STATUS_LABELS 보존·enforceAction 보존·주석 정정. 실 vitest·build = operator. 라이브 전이 smoke = P3.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [ ] Pending
- 🔴 확정 규칙 vs 현재 코드 diff 고정. 🟢 canonical 최종형 확정. 🔵 scope=2파일.
- ✋ Gate: 충돌 0, 규칙 호영님 확정과 일치. Rollback: planning-only.

### Phase 1: Sentinel (RED)
- Status: [ ] Pending
- 🔴 RED: state-machine CANCELLED→PENDING / quotes route validateTransition·로컬부재·주석정정 계약 — 구현 전 FAIL.
- ✋ Gate: RED 진짜 실패, 기존 sentinel 무회귀. Rollback: sentinel revert.

### Phase 2: GREEN — canonical 단일화
- Status: [ ] Pending
- 🟢 state-machine.ts: ALLOWED_QUOTE_TRANSITIONS CANCELLED `[]→[PENDING]`. quotes route: 로컬 `ALLOWED_STATUS_TRANSITIONS` 제거, `validateTransition("QUOTE", currentStatus, status)` 호출, `!result.valid` 시 기존 400 응답(STATUS_LABELS + allowedTransitions 파생은 canonical map에서 재구성). dead import 해소. :47-48 주석 정정.
- ✋ Gate: 계약 GREEN, 에러 UX 보존, enforceAction 무회귀, build EXIT 0. Rollback: 2파일 revert.

### Phase 3: Smoke + Rollback
- Status: [ ] Pending
- 🟢 라이브(Chrome): quote status PATCH — CANCELLED→PENDING 허용, COMPLETED→CANCELLED 거부, skip 거부 확인. audit 기록 유지.
- ✋ Gate: 전이 규칙 라이브 정합. Rollback: canonical/route revert(전이 분기 무파괴).

## 9. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| validateTransition 반환형으로 에러 응답 재작성 시 UX 회귀 | Med | Med | STATUS_LABELS·allowedTransitions 보존 sentinel |
| canonical 변경이 타 caller(12 validateTransition 파일)에 영향 | Low | Med | CANCELLED→PENDING 추가만(확장), 기존 전이 무변경 |

## 10. Rollback
- P1: sentinel revert / P2: 2파일 revert / P3: 전이 분기 revert. 데이터 비파괴(스키마 무변경).

## 11. Progress
- Overall: 0% · Current: P0 대기 · Checklist: [ ]P0 [ ]P1 [ ]P2 [ ]P3

## 12. Notes
- [2026-06-14] 호영님 도메인 확정: a) CANCELLED→PENDING 허용, b) COMPLETED→CANCELLED 금지, c) skip 전이 금지. canonical 변경 = CANCELLED→[PENDING] 한 줄.
