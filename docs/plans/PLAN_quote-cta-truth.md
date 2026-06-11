# PLAN — #quote-cta-truth: 상세 "견적 담기" fake success 수리 + 견적 truth 승계 (§번호 호영님 배정)

- **Status:** ✅ P0~P2 완료 (2026-06-11) — 클로드코드 vitest/build/push + P3 라이브 smoke 대기
- **P0 판정:** 견적함 canonical = provider quoteItems + localStorage("quote-cart-storage-v2").
  호영님 ⓐ 결정(저장소 합류). pending-action add_request 는 선언만 존재(복원 미구현) 기록.
- **구현:** `lib/quote/quote-cart-storage.ts` 신규(키·read/add 단일 출처, computeAddToQuote 경유,
  fetch 0) / provider 키 literal → 공유 import / 상세 CTA 2곳(데스크탑+모바일 하단 바 —
  **모바일 바의 두 번째 fake CTA 는 sentinel 이 검출**) 실 결선 + 조건부 toast + 이미 담김
  상태 / "견적함에 포함됨" 배지(§1-2⑤ ③ deferred 해소) / sentinel `quote-cta-truth`(8 tests).
- **mobile parity 큐:** apps/mobile 견적 담기 동형 점검 — 후속.
- **Started:** 2026-06-11
- **승인:** 호영님 2026-06-11 (이 세션 실행)

## 0. Truth & Priority

- **Source:** §1-2⑤ 보고(2026-06-11) + Image4 rail 증거("견적 요청: 미포함").
- **✅ ⒜ 확정 (repo 정독 완료, 추정 아님):** `products/[id]/page.tsx` L851-866 —
  "견적 담기" onClick = `GET /api/products/${id}` 조회 후 `response.ok` 면 무조건
  "견적 담기 완료" toast. mutation 0 = front-only fake success (§4 위반).
- **✅ ⒞ 부분 확정:** `quoteItems` = `useTestFlow`(test-flow-provider) —
  `_workbench/layout` + `app/app/layout` 마운트, `products/[id]` 는 경계 밖.
  → P2 결선은 provider 합류 불가: ⓐ 서버 persist 경로 vs ⓑ pending-action
  (sessionStorage, `app/app/search` 복원 패턴 기성) 택일 = P0 ⒝ 실질 쟁점.
- **Conflict:** 없음. §1-2⑤ ③ deferred(견적 배지 승계)와 동일 seam → 본 batch 통합.
- **Priority Fit:** P1-adjacent — 핵심 거래 CTA live correctness 결함.
- **Work type:** Bugfix + Workflow/Ontology wiring. Scope: Small (web 상세 CTA + 배지).
- **Out of Scope:** mobile 견적 담기 parity(별도 큐 — compare 비대칭과 동형),
  견적함 영속화 재설계(P0 판정이 client-only 확정 시 별도 트랙).

## Phase 분해

### P0 Truth Lock — [진행 중]
- ⒜ CTA fake success — ✅ 확정 (상기).
- ⒝ 견적함 canonical source 판정: workbench `addProductToQuote` 실체(서버 persist
  vs client-only), `/api/quotes` 계열 add 경로 유무, pending-action 패턴 적용성.
- ⒞ 견적 배지 truth source 확정 (⒝ 종속).
- **✋ Gate:** "어느 견적함이 canonical 인가" 호영님 1줄 결정.
- Rollback: planning-only.

### P1 Failing sentinel (RED)
- 단언: 담기 → 실 상태 전이(견적함/배지 "포함") / 무조건 success toast 금지(조건부) /
  견적 배지 truth 승계 / GET-only 패턴 부재.
- **✋ Gate:** 실패 real, 기존 회귀 0.

### P2 Provider/경로 결선 (GREEN)
- CTA → P0 확정 경로 바인딩, toast 조건부化, 배지 동일 truth 바인딩.
- 4상태: loading / error / 이미 담김(disabled or 제거 토글) / 성공.
- **✋ Gate:** no-op·front-only 0, truth boundary 준수, same-canvas.

### P3 Smoke / Rollback
- 담기→반영→배지 전이 + 실패 경로. mobile parity 큐잉 기록.
- Rollback: 단독 revert.

## Key Risks
- 견적 source client-only 확정 시: 본 batch 는 "fake toast 제거 + 실제 상태 반영"까지
  보장, persist 는 별도 트랙 (catalog honesty 동형).
- 워크벤치 견적함(임시 컨텍스트) vs 영속 견적 요청이 다른 개념일 가능성 — P0 게이트.
- mobile 비대칭 drift — 별도 큐 명시로 차단.
