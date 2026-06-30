# Implementation Plan: 웹 모바일 반응형 재스킨 (대시보드·재고·견적·입고)

- **Status:** ✅ Complete (sandbox static) — 1 재고 · 2 견적 · 3 대시보드 · 4 입고 전부. 잔여=operator(`next build`·push·브라우저 ≤375px 육안).
- **Started:** 2026-07-01
- **Last Updated:** 2026-07-01

**CRITICAL:** phase별 quality gate 통과 후 다음. dead button/no-op/fake success 금지. 데스크탑 워크벤치 무접촉. push=operator-shell 단독.

## 0. Truth Reconciliation

**대상 = `apps/web`(labaxis.co.kr) 모바일 반응형.** (※ 앞선 RN apps/mobile 재스킨(64456f45)은 별도 앱 — 호영님 "남겨두기" 확정, 웹과 무관.)

**실측:**
- 웹 각 대시보드 페이지는 이미 반응형: `md:hidden` 모바일 블록 + `hidden md:flex` 데스크탑 워크벤치 공존. → 트랙 = **모바일 블록만 목업 디자인으로 재스킨**(반응형 신규 아님).
- 라우트 매핑: 01 대시보드=`src/app/dashboard/page.tsx`(블록2) · 03 재고=`src/app/dashboard/inventory/inventory-main.tsx`(3880줄, 블록3) · 02 견적=`src/app/dashboard/quotes/page.tsx`(4878줄, 블록2) · 04 입고=`src/app/dashboard/receiving/page.tsx`(432줄, **모바일 블록 0 → 신설**).
- 토큰: 웹 Tailwind 기본 팔레트로 navy(slate-900)/accent(blue-600)/emerald/rose/violet 충당. muted amber #b45821 만 비표준 → arbitrary `bg-[#b45821]`/`bg-[#fdf3ec]`/`border-[#f3d4bf]`(기본 amber-* 오버라이드 회피). **신규 토큰 레이어 불필요.**

**Chosen Source of Truth:** 실측 웹 구조 + design_handoff 목업. 데스크탑 워크벤치(canonical) > 목업(모바일 한정).

**Conflicts/제약:**
1. workbench/rail/dock 데스크탑 보존, page-per-feature 금지 → **모바일 블록 한정 diff**(데스크탑 회귀 0).
2. no-op 금지 — 목업 데모 액션은 기존 웹 핸들러/라우트에 연결(이미 wired된 것 재사용).
3. AI 카드 금지(§AI-UI) — "지금 할 일"은 contextual next-step으로(견적/대시보드).
4. 04 입고: receiving 페이지에 모바일 블록 신설. 단 문서게이트 큐 데이터 유무 확인 필요(없으면 실기능 한정).

## 1. Priority Fit
- [x] 호영님 직접 지시. 데스크탑 무영향(모바일 한정). P1/blocker 단정 아님.

## 2. Work Type
- [x] Web · Design Consistency (모바일 반응형 재스킨, 멀티-page)

## 3. Execution Method (대형 파일 안전)
- 파일도구(Write/Edit) 대형 파일 truncate 이력 → **python 디스크 권위 타깃 편집**, `md:hidden` 블록 범위만.
- 검증: sandbox는 TS transpileModule parse(구문) + 데스크탑 블록 무변경 diff 확인. **권위 게이트 = operator `next build`**(pre-push) + 기기/브라우저 모바일 폭(≤375px) 육안.
- phase별 단일 페이지 = 독립 rollback.

## 4. Phases (권장 순서: 재고 먼저 — 가장 복잡, 패턴 검증)

### Phase 0: Truth lock — ✅ (본 문서)
- 토큰 불필요 확정, 라우트 매핑 확정, 모바일 블록 한정 원칙 확정.

### Phase 1: 03 재고 — ✅ Complete (sandbox static)
- 실체 = `src/components/inventory/mobile-inventory-view.tsx`(전용 컴포넌트, 데스크탑은 `hidden md:flex` 별도) + 헤더 `inventory-main.tsx` md:hidden 블록.
- 적용: ① **amber §11.302** 쨍한 yellow → muted #b45821(badge/dot/rail/카드/요약 전수) ② **안전재고 게이지** 막대(MobileItemCard, 상태색 fill) ③ **필터 칩**(전체/부족/만료임박/위치미지정, same-canvas 필터 state) ④ empty 시 필터 초기화 CTA ⑤ **navy 헤더 밴드**(full-bleed rounded-b, inventory-main md:hidden).
- 보존(no-op 0): onReorder/onEdit/onDelete/onRestock·검색·상세 bottom sheet·스마트입고/스캔 버튼 전부 그대로. 데스크탑 `hidden md:flex` 2개 무변경 확인.
- 검증: 두 파일 transpileModule PARSE OK(miv 911줄 / inventory-main 3883줄). 권위 게이트 = operator `next build` + 브라우저 ≤375px 육안.
- 후속 검토: 상세시트 "AI 재발주 검토"(기존 wired aiPanel) 라벨은 유지(기존 제품 기능, 신규 AI UI 아님).

### Phase 2: 02 견적 — ✅ Complete (sandbox static)
- **구조 차이**: 견적은 재고와 달리 공유 반응형 `QuoteCard`(모바일 분리 없음) → 호영님 확정 "모바일 전용 뷰 신설".
- 신규 `src/components/quotes/mobile-quotes-view.tsx`(자족형, 206줄): 단계 칩(전체/발송대기/회신추적/비교검토/승인입고) + 케이스 카드(단계 레일색·상태 pill·displayTitle·금액 range·회신수·상대시각·next-step). amber #b45821(회신추적). 실필드만(우선순위·마감·공급사수 미표기). AI 카드 없음.
- 와이어링(`dashboard/quotes/page.tsx`): import + 모바일 마운트(`isMobile` 게이트, `MobileQuotesView quotes={filteredQuotes} onSelect={handleQuoteCardSelect}`) + 기존 카드 3섹션·테이블 게이트에 `!isMobile &&` 추가(데스크탑 전용화, 구조 무변경).
- **no-op 0**: onSelect→handleQuoteCardSelect(실). 데스크탑 카드/테이블 그대로(isMobile=false). SSR=데스크탑이라 hydration 안전.
- 검증: 두 파일 transpileModule PARSE OK(miv-quotes 206 / page 4885줄). 권위=operator `next build` + ≤375px 육안.

### Phase 3: 01 대시보드 — ✅ Complete (sandbox static)
- **이미 목업 구조 근접**: KPI=StatLine · 지금할일=ActionInbox/NextStepBanner · 파이프라인=Pipeline · 바로가기=하단 고정바(시약검색/재고등록/견적요청) — 전부 공유 반응형 컴포넌트(데스크탑 공유, 무접촉). 모바일 블록(다음작업/최근이력)엔 쨍한 yellow 없음(amber swap 불필요).
- **명확한 갭 = navy 헤더** → `dashboard/page.tsx`: 모바일 navy 헤더 밴드(md:hidden, full-bleed rounded-b, title+todayLabel+AI리포트 진입 보존) 추가 + 기존 `AppPageHeader`를 `hidden md:block` 래퍼로 데스크탑 전용화(이중 헤더 방지).
- **no-op 0 / 데스크탑 무접촉**: AppPageHeader 내용 무변경(래퍼만). AIInsightDialog 모바일에도 보존. 공유 컴포넌트 미수정.
- 검증: transpileModule PARSE OK(811줄). 권위=operator `next build` + ≤375px 육안.

### Phase 4: 04 입고 — ✅ Complete (sandbox static)
- **실측**: receiving는 이미 카드 기반 반응형 + 실데이터(`useOpsStore` priorityQueue/buckets/dueState/blockerSummary) → 목업 §04 "입고1건=카드+시급도"에 근접(문서게이트=blocker/due로 실재, 가짜 데이터 불필요).
- 갭만 적용(`dashboard/receiving/page.tsx`): ① §11.302 amber 스왑(쨍한 yellow→#b45821: p1 dot·PriorityCard/ActionableRow 좌측보더·DueStateBadge) ② 헤더 카드 반응형 재색 — 모바일 navy(full-bleed rounded-b)/데스크탑 white 유지(stat pill 필터·데이터 그대로).
- **no-op 0 / 데스크탑 무접촉**: 카드/탭/행 wiring 무변경(router.push 실연결). 헤더는 색만 반응형, 데스크탑 동일.
- 검증: transpileModule PARSE OK(434줄), yellow 0. 권위=operator `next build` + ≤375px 육안.

## 5. Risks
| Risk | Mit |
| :-- | :-- |
| 대형 파일 truncate | python 타깃 편집 + parse 검증 |
| 데스크탑 워크벤치 회귀 | md:hidden 블록 한정 diff, 데스크탑 블록 unchanged 확인 |
| 기본 amber-* 오버라이드 | 토큰 신설 안 함, arbitrary hex 사용 |
| no-op 회귀 | 기존 wired 핸들러/라우트 재사용, 미연결=disabled |
| next build 실패 | operator pre-push 게이트, phase별 분리 |

## 6. Rollback
- 페이지별 phase = 해당 파일 모바일 블록 revert(데스크탑/타 페이지 무영향).

## 7. Notes
- RN apps/mobile 재스킨(64456f45)은 남겨둠(별도 앱, 웹 무관).
- amber #b45821 = §11.302 갱신 반영(쨍한 yellow 금지, muted amber).
