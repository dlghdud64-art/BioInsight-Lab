# Implementation Plan: 랜딩 제품 미리보기 목업 갱신 (§랜딩 목업 갱신)

- **Status:** 🔄 In Progress (P1 sandbox 완료)
- **Started:** 2026-07-13
- **Source:** 업로드 `랜딩 목업 갱신 핸드오프.md`(§0–5) + 단독 실행 목업 `랜딩 목업 갱신.html`(self-unpacking 번들, 시각 참조).

**CRITICAL:** 각 phase 후 — ✅체크 · 🧪gate(operator build+vitest) · 승인 전 편집 금지 · dead/모순 목업 금지.

---

## 0. Truth Reconciliation
- **문제:** 랜딩 제품 미리보기가 개선 전 작업창(발주 전환 큐)을 담아 광고-실물 불일치. 발주 전환(order conversion)은 제품에서 제거 → 목업 전반 삭제.
- **대상(실렌더):** `app/page.tsx` → `BioInsightHeroSection`(히어로+구매운영 카드) + `FinalCTASection`(재고 목업) + `MainFooter`. 편집 = 이 2섹션(+ 하위 `ops-console-preview-section`).
- **기결정:**
  - **3D 플렉서스 캔버스 이미 존재**(`landing-plexus-perf` 센티넬 잠금) → 핸드오프 §1 배경·§5 QA "3D/모바일 성능" 충족, 재구축 금지.
  - **amber = 예외 승인(호영님 2026-07-13):** 랜딩은 마케팅 정적 페이지(앱 신호등-lock 아님, landing-amber 센티넬 0), 핸드오프는 inline HEX(Tailwind `amber-*` 클래스 아님) → inline hex amber만 사용(Tailwind amber-* 0).
  - **선택 아이템 칩 = (b) 현행 유지(호영님):** 핸드오프 "공급사 미정" 칩은 현 선택 아이템(BioKorea 공급사 확정·비교 가능)과 모순 → 미도입, 최저가·기존거래 유지.

## 1. Phases

### Phase 1: 히어로 구매운영 카드 (발주 전환 제거 + 용어 정합)
- **Status: [x] Complete (sandbox) → operator gate 대기**
- **편집:**
  - `bioinsight-hero-section.tsx`: 캡션 "견적 요청부터 선택안 확정까지…"(발주 전환 제거) · KPI "전환 대기"→"회신 대기".
  - `ops-console-preview-section.tsx`: statusLabel "발주 전환 가능"→"비교 가능" · ctaLabel "발주 전환 준비"→"선택안 확정" · 탭 "전환 가능 1"→"비교 가능 1" · 운영상태 "전환 가능"→"비교 가능" · 헤더 주석 발주 전환 리터럴 제거.
- **add-list(4):** bioinsight-hero-section.tsx · ops-console-preview-section.tsx · landing-ops-mockup-truth-p1.test.ts(신규) · 본 PLAN.
- **sandbox 검증:** 두 파일 "발주 전환/전환 대기/전환 가능" grep 0(주석 포함) · 신규 라벨 존재 · 랜딩 5센티넬(cta/plexus/reveal/second-section) 무접촉.
  ⚠ bash mount stale → operator build+vitest 필수.

### Phase 2: 재고 운영 섹션 (실제 화면 반영) — `final-cta-section.tsx`
- **재정의(호영님 2026-07-13):** §2 요소 대부분 이미 충족 — KPI4·상태pill(만료임박/재주문/입고미처리)·LOT 브리핑 드로어(다크 #1A2840, Lot·유효기간레드·보관·잔량·최근입고 + 재주문검토/입고반영/Lot수정)·좌측 3기능카드 전량 존재. **유일 갭 = 안전재고 게이지 막대.**
- **P2-gauge Status: [x] Complete (sandbox) → operator gate 대기**
- **편집(1파일):** `INVENTORY_ITEMS`에 current/safety 추가(2/2 green·1/3 amber·0/2 red 3색 시연) + `gaugeColor` 헬퍼(0 레드 #EF4444·미달 앰버 #F59E0B·정상 그린 #22C55E) + 행 sub 아래 게이지 막대(width=min(현재/안전,1)*100%, inline hex, Tailwind amber-* 0).
- **add-list(3):** final-cta-section.tsx · landing-inventory-gauge-p2.test.ts(신규) · 본 PLAN.
- **sandbox 검증:** 게이지 헬퍼·3색 토큰·current/safety·render 반영 · Tailwind amber-* 0 · KPI4/pill/LOT드로어/3카드 보존.
  ⚠ bash mount stale → operator build+vitest 필수.
- **sweep:** 랜딩 5센티넬 중 final-cta 읽는 것(second-section-polish·reveal-trigger-364) — reveal/polish 잠금, 행 게이지 추가 무접촉 예상.

### Phase 3: 아이콘 통일
- Status: [ ] Pending
- **델타:** 이모지 전면 제거 → LabAxis 라운드 사각 + 라인 SVG(stroke2, 24 viewBox). 기능카드 box/clock/alert(앰버) · 운영상태 doc/check/clock/shield · LOT grid/clock/pin/box/refresh.
- **Gate:** 이모지 0 · 라인 SVG 통일.

## 2. Test Strategy
sentinel(readFileSync) 광고-실물 truth guard. 랜딩 5센티넬 무회귀. operator=build+전체 vitest.

## 3. Rollback
Phase별 단일 commit revert.

## 4. Progress
Overall ~66%(P1 배포 2b305bfc · P2 sandbox) · Next P3(아이콘 통일).
- P1 배포: `2b305bfc`(히어로 용어 정합).
- P2 sandbox: 안전재고 게이지(§2 나머지 이미 충족).
