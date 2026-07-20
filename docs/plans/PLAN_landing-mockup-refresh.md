# Implementation Plan: 랜딩 제품 미리보기 목업 갱신 (§랜딩 목업 갱신)

- **Status:** 🔄 In Progress (P1~P3 배포 완료 · **P4 목업 정합 sandbox** · D·E 후속)
- **⚠ 학습:** 시각 목업이 번들 형식이어도 **원본을 반드시 추출·대조한 뒤 구현**할 것. 산문 핸드오프만으로 채운 추정(카피·표시 아이템·색 규칙)이 원본과 어긋나 P4 재작업 발생. 번들 추출법: `script[type="__bundler/template"]` 디코드.
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
- **재정의(호영님 2026-07-13):** §3 핵심(이모지→라인 SVG 통일)은 **이미 충족** — 랜딩 3파일 데코 이모지 0(`→`는 타이포), 전부 lucide 라인 아이콘. 아이콘 셋·스타일도 표와 거의 정합(기능카드 파란 라운드 사각·운영상태 doc/check/clock/shield·LOT 라인 SVG). **유일 실델타 = §3 "경고만 앰버".**
- **P3-warn-amber Status: [x] Complete (sandbox) → operator gate 대기**
- **편집(1파일):** `final-cta-section.tsx` 기능 3카드에 `tone` 필드(box/clock=blue·부족재주문(alert)=amber) + 렌더 조건(amber → 사각 #FFFBEB·아이콘 #D97706, 그 외 파랑). inline hex, Tailwind amber-* 0.
- **add-list(3):** final-cta-section.tsx · landing-icon-unify-p3.test.ts(신규) · 본 PLAN.
- **sandbox 검증:** tone amber 조건 렌더 · 이모지 0 guard(3파일) · lucide 유지 · Tailwind amber-* 0. ⚠ operator build+vitest 필수.

### Phase 4: 목업 원본 정합 (A·B·C) — 재작업
- **배경(정직 기록):** P1–P3는 핸드오프 `.md` **산문만으로** 구현. 목업 단독 실행본(`랜딩 목업 갱신.html`)이 self-unpacking 번들이라 초기에 파싱 실패 → 카피·선택아이템·게이지 규칙을 **추정**으로 채움. 이후 원본 추출(template script 디코드) 성공 + **7/19 개정본** 수령으로 실불일치 5건 확인. A·B·C(의미·신뢰도 직결) 우선 정합, D·E는 후속.
- **P4 Status: [x] Complete (sandbox) → operator gate 대기**
- **A 히어로 캡션:** 추정 "견적 요청부터 선택안 확정까지, 한 화면에서 운영합니다" → **목업 원문 "견적 비교부터 재고 운영까지, 한 화면에서 관리합니다"**.
- **B 선택된 건:** PCR 튜브 + 최저가/기존거래(내 (b) 결정) → **목업 원문 `PBS-3 (재요청)` · `공급사 미정 · 마감 D-3` + 칩 공급사 미정(#FFFBEB/#B45309/#FDE68A)·마감임박(#FEF2F2/#B91C1C)**. 목업은 선택 건 자체를 공급사 미정 케이스로 교체해 칩 모순을 해소 → 이전 (b) 판단 철회, (a)가 정답이었음.
- **C 게이지:** P2의 `current÷safety` 비율 규칙(.md "0 레드" 문구 기반 추정) 폐기 → **목업 실값**(만료임박 85% `#F59E0B` · 재주문필요 22% `#EF4444` · 입고미처리 60% `#22C55E`). 색=행 심각도, 폭=재고 수준. 목업에 없는 N/M 라벨 제거.
- **센티넬 진화 2:** `landing-ops-mockup-truth-p1`(카피·선택건 칩) · `landing-inventory-gauge-p2`(게이지 실값 + 폐기분 잔재 0). `landing-icon-unify-p3`는 무영향.
- **add-list(6):** bioinsight-hero-section · ops-console-preview-section · final-cta-section · truth-p1(진화) · gauge-p2(진화) · 본 PLAN.
- **잔여:** **E** 미세 색 토큰(KPI `#93c5fd`, 재고 KPI `#dc2626/#b45309`, 탭 활성 `#1e3a8a`, 드로어 보조버튼 `#2f3d57/#1a2438/#cbd5e1`, body `#f1f5fb`) — 후속 배치.

### Phase D: 구매 행 아바타 아이콘 (7/19 개정본 신규)
- **Status: [x] Complete (sandbox) → operator gate 대기** · ⚠ P4 미커밋 상태에서 이어 작업 → **P4+D 합본 커밋**.
- **편집(`ops-console-preview-section.tsx`):** `AV_ICON_PATHS`(목업 원문 tube/flask paths) + `AvatarLineIcon`(24 viewBox·stroke 2·round cap/join) 신설 · QUEUE_ITEMS 3건에 `avKey`/`avBg`(회신완료=tube 파랑 · 선택안검토=flask 파랑 · 추가검토(경고)=flask 앰버) · 행 구조를 목업대로 **[아바타][칩+제목+메타][CTA] 한 행**으로 재구성(칩을 콘텐츠 컬럼 안으로 이동).
- **신규 센티넬:** `landing-row-avatar-d.test.ts` — paths/SVG 스펙/행별 배정/stroke 분기 + 무회귀(칩·제목·메타·CTA·amber-* 0).
- **add-list(P4+D 합본, 8):** hero · ops-preview · final-cta · truth-p1(진화) · gauge-p2(진화) · row-avatar-d(신규) · PLAN.

## 2. Test Strategy
sentinel(readFileSync) 광고-실물 truth guard. 랜딩 5센티넬 무회귀. operator=build+전체 vitest.

## 3. Rollback
Phase별 단일 commit revert.

## 4. Progress
P1 `2b305bfc` · P2 `b351f895` · P3 `d7fc4e97` 배포 · **P4(목업 정합 A·B·C) sandbox** · 잔여 D·E 후속 배치.
- P1: 히어로 용어 정합(발주 전환 제거).
- P2: 안전재고 게이지 도입(이후 P4에서 목업 실값으로 정정).
- P3: 경고 카드 앰버.
- P4: 목업 원본 대조 → 카피·선택건·게이지 정합(추정분 정정).
