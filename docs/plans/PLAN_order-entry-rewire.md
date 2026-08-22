# Implementation Plan: 발주 진입 재배선 — 운영 브리핑 은퇴 · confirm 봉합 · 경로 C 은퇴

- **Status:** ⏳ Pending
- **Started:** 2026-08-22
- **Last Updated:** 2026-08-22
- **판정(호영님 2026-08-22):** ① 운영 브리핑 dock 삭제 ② 전체 상세 페이지(/quotes/[id]) 은퇴
  ③ 견적 관리 행 "발주 준비" → 주문 접수 다이얼로그 직접 ④ 경로 C(/api/orders/draft) 은퇴

**CRITICAL INSTRUCTIONS**: 각 phase 완료 시 체크박스 갱신 → quality gate 전 항목 통과 →
Last Updated 갱신 → Notes 기록 → 그 후에만 다음 phase. 게이트 실패 상태로 진행 금지.
⛔ dead button / no-op / placeholder success 금지 · page-per-feature 금지 · same-canvas 유지.

## 0. Truth Reconciliation

- Latest Truth Source: 2026-08-22 실측 (⑪ P4 폐루프)
  - POST /api/orders 유일 UI 호출부 = /quotes/[id] (은퇴 대상 페이지) — 실사용 면에 발주 진입점 0
  - 취소 CTA 0: /my/orders 조회만 · admin 은 전진 전환만 — release 의 UI 진입점 부재
  - confirm 미배선: PurchaseRecord 생성 지점에 ORDER_CONFIRMED 연결 없음 → 이중 계상 창
    (PLAN_order-budget-reservation Success Criteria 3 이월)
  - 경로 C: /api/orders/draft 는 Order 없이 PurchaseRecord 만 생성 (CARD_path-c-order-draft)
  - 다이얼로그 금액 축: vendorRequestId 필수 (없으면 totalAmount 0 → INVALID_AMOUNT — 금일 실측)
- Secondary: CARD_path-c-order-draft(두 가설) · CARD_csrf-raw-fetch-9(purchase-orders/new:105)
- Conflicts: 없음 — 판정으로 갈림 해소 (C 은퇴)

## 1. Priority Fit
- [x] P1 immediate — confirm 창은 예약 활성화 순간부터 실재하는 정합 리스크 ·
  발주 진입점이 은퇴 예정 면에만 있어 실사용 차단

## 2. Work Type
- [x] Feature(진입 재배선) + Bugfix(confirm 봉합·취소 CTA) + API Slimming(경로 C 은퇴)

## 3. Overview
**Success Criteria:**
- [ ] 견적 관리 행 "발주 준비" → 주문 접수 다이얼로그(예산 선택·예상 잔액) 직접 — dock 경유 0
- [ ] 운영 브리핑 dock 소스 제거 · 재유입 sentinel
- [ ] /quotes/[id] 은퇴 — 내부 링크/진입 0 (라우트 처분은 본 슬라이스 범위: 링크 제거까지)
- [ ] 취소 CTA: /my/orders 행에서 취소 가능 (ORDERED 상태 한정 · 확인 다이얼로그)
- [ ] confirm 봉합: 주문 유래 PurchaseRecord 생성 시 ORDER_CONFIRMED 기록 — 이중 계상 0
- [ ] 경로 C 은퇴: /api/orders/draft 호출부 처분 후 라우트 410/제거 — "발주" 는 /api/orders 하나
**Out of Scope (⚠️ 구현 금지):**
- [ ] UserBudget 모델 은퇴 (별도 배치)
- [ ] /quotes/[id] 파일 삭제 (링크 제거·진입 차단까지만 — 삭제는 후속 정리 배치)
- [ ] 리전 정합(iad1↔도쿄) — 인프라 별건

## 4. Product Constraints
- Must Preserve: 견적 관리 workbench/queue 구조 · canonical Budget+BudgetEvent 원장 ·
  budgetEventKey idempotency · csrfFetch 경유
- Must Not Introduce: 새 페이지 · dock 대체물(또 다른 브리핑) · front-only success
- Canonical Truth: 잔액 = Budget.amount − PurchaseRecord(⑤ 창) − 활성예약(원장 파생) — 불변

## 5. Integration Points
- 진입: dashboard/quotes 행 CTA → 주문 접수 다이얼로그 (이식원: /quotes/[id] L1520~ ·
  effectiveVrId 축 = vendor-requests 쿼리 필수 동반 이식)
- confirm: PurchaseRecord 생성 지점 전수 (P0 에서 인벤토리 — 최소 orders/draft·구매 처리 전이)
- 취소: /my/orders → PATCH /api/orders/[id] CANCELLED (기배선 · 멱등)
- C 은퇴: purchase-orders/new/page.tsx:105 등 호출부 인벤토리 후 처분

## 6. Test Strategy
- 소스 sentinel(러너 대조) + 로컬 세션 vitest 게이트 + 프로덕션 폐루프 3상 실측.
- VM vitest 실행 불가 — python 재현은 존재 축만, 구조 축은 tsc(로컬 세션) 몫 (금일 교훈 명기)

## 7. Phases

### Phase 0: Truth Lock — 인벤토리
- Status: [x] Complete (2026-08-22)
- 🔴 dock/상세링크/경로 C 호출부/PurchaseRecord 생성 지점 전수 → 🟢 처분 목록 확정 → 🔵 범위 재확인
- ✋ Gate: 인벤토리에 추정 0 (전부 파일:줄 실측) · 이식 계약(다이얼로그 의존 축) 문서화
- Rollback: 계획만

### Phase 1: 계약 · RED
- Status: [ ] Pending
- 🔴 confirm 계약(생성 지점→ORDER_CONFIRMED·이중 계상 금지) + 진입점 sentinel
  (브리핑 재유입 0 · 행 CTA→다이얼로그 · draft 호출 재유입 0) RED
- ✋ Gate: RED 진짜 RED · 기존 GREEN 불변
- Rollback: 테스트 revert

### Phase 2: confirm 봉합 (UI 보다 먼저)
- Status: [ ] Pending
- 🔴 unit RED → 🟢 PurchaseRecord 생성 지점에 buildConfirmEvent 기록 (idempotent · 예약 없으면 no-op)
- ✋ Gate: unit GREEN · 이중 계상 시나리오 차단 실증 · tsc 불변
- Rollback: 코드 revert (원장 append-only — 무해)

### Phase 3: 표면 재배선
- Status: [ ] Pending
- 🔴 integration sentinel RED → 🟢 dock 삭제 · 행 CTA→다이얼로그 이식(vendorRequestId 축 포함) ·
  /my/orders 취소 CTA · 상세 링크 제거 · draft 호출부 처분 → 🔵 same-canvas 정리
- ✋ Gate: dead button 0 · 진입 dead-end 0 · loading/error/disabled 상태 · 게이트 GREEN ·
  /quotes/[id] 도달성 가드 sentinel (dead 단언 · 진입 링크 재유입 0)
- Rollback: 표면 커밋 revert → 종전 dock 경로

### Phase 4: Rollout · Smoke
- Status: [ ] Pending
- 🔴 실패 모드(이식 다이얼로그 금액 0·취소 중복) → 🟢 배포 후 폐루프 3상
  (행→접수→예약 확인→구매 확정→confirm 원장→취소 별건 주문으로 release) → 🔵 계측 정리
- ✋ Gate: 3상 수치 일치 · 원장 reserved/confirmed/released 정합 · 오진 0
- Rollback: Vercel instant rollback

## 8. Risks
| Risk | P | I | Mitigation |
| --- | --- | --- | --- |
| 다이얼로그 이식 시 vendorRequestId 축 누락 | Med | High | P0 이식 계약 명문화 · P4 금액 실측 |
| confirm 생성 지점 누락(전수 실패) | Med | High | P0 인벤토리 게이트 "추정 0" |
| 상세 페이지 은퇴로 기존 sentinel 파손 | Med | Med | P1 에서 재조준 목록 선확정 |
| C 은퇴가 숨은 호출부를 남김 | Low | Med | orphan-caller 가드 + rg 전수 |

## 9. Rollback Strategy
- P2 실패: confirm 기록 revert (원장 무해)
- P3 실패: 표면 revert → dock 경로 복원 (기능 동등)
- P4 실패: instant rollback + 잔존 예약 release 수동 절차 (⑪ 계획서 절차 재사용)

## 10. Progress
- Overall: 0% · Current: P0 · Blocker: 없음

## 11. Notes & Learnings
- [2026-08-22] P0 인벤토리 (전부 파일:줄 실측 · 추정 0):
  (a) 운영 브리핑 = dashboard/quotes/page.tsx **내장** (5,018줄 파일 내 수술):
      단계 config L203~266 ("전체 상세 열기" secondaryCta 7곳 · "발주 실행 준비/검토" L266)
      · 진입 버튼 L3577 · narrative hook L1943 · sheet 상호배제 L1499·L1656
  (b) /quotes/[id] 진입 링크 6곳: dashboard/quotes/page.tsx L3737·L3818·L4283 ·
      my/orders/page.tsx L176 · vendor/quotes/page.tsx L727 · protocol-upload.tsx L167
      (protocol 업로드 후 랜딩이 은퇴 페이지 — 대체 랜딩 결정 필요, P3)
  (c) 경로 C 호출부 1곳: purchase-orders/new/page.tsx (csrf 카드 :105 과 동일 지점)
  (d) PurchaseRecord 생성 5지점: orders/draft(은퇴로 소멸) · **markPurchased.ts L115
      (confirm 봉합 대상 — quoteId 축 idempotent, quote→orders→reserve 연계로 confirm)** ·
      purchases/route.ts(orderId 축 없음 — 주문 무관 수기 입력, confirm 비대상) ·
      purchases/import×3(대량 입력 — 주문 무관, 비대상)
- P2 confirm 배선의 단일 지점 = markQuoteAsPurchased (경로 C 은퇴 후 유일한 주문 연계 생성점)
- [2026-08-22] (b) 보강 — 로컬 세션 독립 계수가 잡은 누락: /dashboard/quotes/{id} 링크 3곳
  (audit:246 · purchase-orders/[poId]:277 · purchases:1524). 판정: app/dashboard/quotes/
  [quoteId]/page.tsx 는 31줄 서버 리다이렉트(legacy → ?selected=) — **살아 있고 은퇴
  대상 아님, 무손상 존치**. 은퇴 대상은 /quotes/[id] 하나뿐이라는 경계가 명확해졌다.
  🔑 사무국 grep 패턴이 href=`/quotes/ 만 걸어 /dashboard/quotes/ 를 놓쳤다 —
  계수 주체 분리(독립 검증)가 잡았다
- P3 게이트 추가 (로컬 세션 제안 채택): /quotes/[id] 파일 존치 상태에 **도달성 가드
  sentinel** — "이 파일은 dead (진입 링크 0)" 를 단언해 다음 세션의 라이브 착각 방지
  (data-table.tsx false-GREEN 재발 방지 축)
