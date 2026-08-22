# Implementation Plan: 발주 예약 — canonical Budget (§⑪ 판정 반영)

- **Status:** 🔄 In Progress
- **Started:** 2026-08-22
- **Last Updated:** 2026-08-22
- **판정:** 호영님 2026-08-22 — canonical 예산 = Budget · (나) 예약(reserved) 도입

**CRITICAL INSTRUCTIONS**: 각 phase 완료 시 체크박스 갱신 → quality gate 전 항목 통과 →
Last Updated 갱신 → Notes 기록 → 그 후에만 다음 phase. 게이트 실패 상태로 진행 금지.
⛔ dead button / no-op / placeholder success 금지 · canonical truth 를 UI state 가 대신 들지 않게.

## 0. Truth Reconciliation

- Latest Truth Source: 호영님 판정(2026-08-22) + 동일자 프로덕션 실측
  - UserBudget 테이블 실행 0 (통합 API 유일 행 = Budget 행) — 8/18 폐루프 차감·원장 전부
    PurchaseRecord→Budget 파생 축이었음
  - 읽기 축은 /api/user-budgets 가 이미 UserBudget ∪ Budget 통합 반환
  - 쓰기 축만 낙오: /api/orders L166 tx.userBudget 단일 조회 → NO_BUDGET
- Secondary: HANDOFF_2026-08-18 §4 ⑪ (모델 3택 전제 — 실측으로 "쓰기 축 낙오" 재정의, 실측 우선)
- 자산: BudgetEvent 원장 기존재 — eventType(approval_reserved/…/po_void_released) ·
  budgetEventKey idempotency · pre/postCommitted. categoryId nullable. budgetId 없음 → additive 확장 대상
- 승격: ⑤ yearMonth 월 창 — canonical 확정으로 "canonical 기간 산출 결함". Budget.description 의
  `period:YYYY-MM-DD~YYYY-MM-DD` 파싱으로 해소 (분리 커밋)
- 해제 대상 tripwire: `order-no-budget-message-p12` 의 "조회 대상은 그대로 UserBudget 하나다"
  — P0 에서 명시 해제 (갈래=(나) · 근거=본 판정)

## 1. Priority Fit
- [x] P1 immediate — 주문 접수가 프로덕션 dead end(NO_BUDGET). 폐루프 미도달 4단계
  (발주→발주 메일→입고 회신→입고 상세)의 유일 선행 차단.

## 2. Work Type
- [x] Feature (예약 수명주기) + Migration/Rollout (additive 1필드) + Bugfix(⑤·⑫)

## 3. Overview
**Success Criteria:**
- [ ] 주문 접수 시 Budget 에 예약이 잡히고 잔액이 즉시 반영된다 (실측: 850,000 예약 → 예상 잔액 3,300,000)
- [ ] 주문 void/취소 시 예약 release
- [ ] 구매 완료 전이 시 예약 confirm — PurchaseRecord 와 이중 계상 0
- [ ] NO_BUDGET 오진(⑫) 소멸 — Budget 선택 시 발주 정상
- [ ] ⑤ 해소 — 9월 구매도 기간 창 안에 집계

**Out of Scope (⚠️ 구현 금지):**
- [ ] 경로 C(/api/orders/draft) 존폐 — 호영님 보류 유지
- [ ] UserBudget 모델 삭제/데이터 이관 — 쓰기 경로 소거까지만, 은퇴는 별도 배치
- [ ] CategoryBudget(경로 A) 통합

## 4. Product Constraints
**Canonical Truth Boundary:**
- Source of Truth: Budget (금액·기간) + BudgetEvent (예약 원장) + PurchaseRecord (확정 지출)
- Derived: 잔액 = amount − Σ(PurchaseRecord, 기간 내) − Σ(활성 예약)
- Persistence Path: /api/orders 트랜잭션 내 BudgetEvent 기록 (idempotency key)
**Must Not:** 새 페이지 0 · UI state 가 잔액 truth 대신 들기 금지 · placeholder success 금지

## 5. Architecture
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| BudgetEvent.budgetId String? additive | 기존 원장·idempotency 재사용, 신설 모델 0 | categoryId 축과 한 테이블 공존 |
| 잔액 파생식에 예약 합류 | canonical 파생 원칙 유지 | 집계 비용 소폭 증가 |
| UserBudget 쓰기 경로 소거 | 실사용 0 실측 | 모델 잔존(은퇴 별도) |

## 6. Test Strategy
- 예약 수명주기 unit (reserve/release/confirm · idempotency 중복 0)
- /api/orders integration (Budget 예약 경로 · NO_BUDGET 소멸 · 타 견적 가격 주입 차단 불변)
- 이중 계상 회귀: confirm 후 잔액 = 확정만 반영 1회
- ⑤: 9월 날짜 PurchaseRecord 로 기간 창 테스트 (HANDOFF §2 지시 이행)
- 러너 = 로컬 세션 vitest (VM 실행 불가 — npm/npx 금지 확정)

## 7. Phases

### Phase 0: Truth Lock & Tripwire 해제
- Status: [ ] Pending
- 🔴 tripwire 단언 현행 RED 조건 확인 → 🟢 명시 해제 커밋(갈래·근거) → 🔵 ⑤ 실측 고정
- ✋ Gate: 해제 커밋에 판정 근거 링크 · 다른 sentinel 무손상 (전체 게이트 GREEN)
- Rollback: revert (문서·테스트만)

### Phase 1: 계약 · Failing Tests
- Status: [ ] Pending
- 🔴 수명주기·이중계상·NO_BUDGET 재현 실패 테스트 → 🟢 계약 스캐폴드 → 🔵 명명 정리
- ✋ Gate: RED 가 진짜 RED (프로브) · 기존 178 GREEN 불변
- Rollback: 테스트 스캐폴드 revert

### Phase 2: 코어 — 마이그레이션 + 예약 서비스 + 잔액 파생
- Status: [ ] Pending
- 🔴 unit RED → 🟢 BudgetEvent.budgetId additive migration (§9.1a: 대상 ref 단언 xhid…dhsw ·
  dry-run 보고 → 호영님 "진행" 후 적용) · reserve/release/confirm 서비스 · 잔액식 + period 파싱(⑤)
- ✋ Gate: unit GREEN · 개발 DB(tvkl)·프로덕션 순서 = 코드보다 컬럼 먼저 · tsc 불변
- Rollback: 컬럼 nullable additive — 코드 revert 만으로 안전

### Phase 3: 배선 — /api/orders · ⑫ · UI
- Status: [ ] Pending
- 🔴 integration RED → 🟢 budgetId→Budget 예약 경로 · UserBudget 쓰기 소거 · void→release ·
  ⑫ 문구 사실화 · 주문/예산 화면 잔액에 예약 반영 → 🔵 same-canvas 유지
- ✋ Gate: dead button 0 · front-only success 0 · loading/error 상태 · 게이트 GREEN
- Rollback: 라우트 revert → Phase 2 상태

### Phase 4: Rollout · Smoke
- Status: [ ] Pending
- 🔴 실패 모드 정의(예약 잔존 고아·중복 이벤트) → 🟢 배포 → 폐루프 재실측
  (RFQ-2608-6QRG 주문 접수 → 예약 850,000 → 잔액 3,300,000 → void → 원복) → 🔵 계측 정리
- ✋ Gate: 실측 수치 일치 · 오진 문구 0 · rollback 문서화
- Rollback: Vercel instant rollback + release 이벤트 수동 실행 절차 기재

## 9. Risks
| Risk | P | I | Mitigation |
| --- | --- | --- | --- |
| 이중 계상 (confirm↔PurchaseRecord) | Med | High | P1 회귀 테스트 선행 · 전이 규칙 단일화 |
| ⑤ 얽힘으로 diff 비대 | Med | Med | period 파싱 분리 커밋 |
| 마이그레이션 대상 DB 오인 재발 | Low | High | §9.1a ref 단언 절차 (금일 신설) |
| 경로 A(BudgetEvent categoryId 축)와 키 충돌 | Low | Med | budgetEventKey 네임스페이스 분리 |

## 10. Rollback Strategy
- P2 실패: 코드 revert (컬럼은 additive nullable — 존치 무해)
- P3 실패: 라우트 revert → 주문은 종전 NO_BUDGET 상태 (기능 저하 없음 — 원래 dead end)
- P4 실패: Vercel instant rollback + 잔존 예약 release 수동 SQL 절차 (문서화 후 실행)

## 11. Progress
- Overall: 0% · Current phase: P0 · Blocker: 없음

## 12. Notes & Learnings
- (기록 시작)
