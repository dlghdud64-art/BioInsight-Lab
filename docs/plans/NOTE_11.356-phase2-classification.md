# §11.356 Phase 2 — sentinel 실패 a/b/c 분류 로그

- **Last Updated:** 2026-06-03
- **Baseline:** `regression` 폴더 풀런 = 166 files (126 pass / 40 fail), 1738 tests (1667 pass / 71 fail). 96% green.
- **분류 기준:** (a) 실제 버그/미구현 스펙 — 테스트가 옳고 코드가 안 따라옴 → 해당 트랙에서 구현/수정 / (b) 테스트 자체 오류 — assert·스캔범위 틀림 → 테스트 수정 / (c) 환경 — import/alias/encoding.
- **확정 사실:** sandbox(Linux)에서도 동일 실패 → **(c) Windows 인코딩 가설 기각.** 실제 내용 불일치.

## 분류 진행 (확정분)
| 파일 | 분류 | 근거 | 조치 |
| :-- | :-- | :-- | :-- |
| `workbench-search-radix-298f` | **(b)** | app-wide import 스캔이 `__tests__` 제외 누락 → 테스트 파일(302a)이 단언 regex로 false positive. 프로덕션 Radix import 실제 0. | ✅ 수정(skip 인자 추가) → 6/6 green. 커밋 초안 작성. |
| `smart-receiving-naming-split-315b` | **(a)** | '스마트 입고'→'스마트 재고 등록 (AI 라벨 스캔)' rename 미구현. 코드에 옛 라벨 잔존. 회귀-가드(스마트 입고 유지) 부분은 pass. | 미조치 — §11.315b 트랙에서 rename 구현 or 센티넬 은퇴 결정 필요(호영님). |

## 미분류 (38 파일 — 정독 대기)
- **app-wide FS 스캔 계열(298f와 동형 (b) 의심):** radix/dropdown/smart-receiving 스캔류 — 각 파일에서 `__tests__` 제외 누락 여부 확인 후 동일 패치 가능.
- **명시적 TDD RED:** 이름에 "RED until GREEN"·"Phase 2 GREEN target" (326, 320, 324, 일부 310/312/317/321) = (a) 미구현, 의도적 red.
- **§11.302 색상 sweep:** amber→yellow/emerald (302d1/302d3/302d6b2, 310/310c) = (a) sweep 미완 or 센티넬 선행.
- **rename/라벨 계열:** 284a/284d(발주 전환→인계? — §11.352 후 라벨 변경 영향 가능), 303(pricing), 308a/308b/295 등.
- **개별 wiring:** sourcing-bar-312, reorder-310/310b, quote-drawer-339, review-339v2, 314b(pdf 폰트), 314b2(에러문구), 279c, 305-2, 309d, 326b, 321 등.

## ⚠️ 작업 제약
- **truncation 버그**: Edit 툴이 멀티바이트 파일(테스트 포함) 끝을 반복 절단. → **테스트 수정은 python/bash 패치로** 진행(Edit 회피).

## 다음 단계 (제안)
1. app-wide FS 스캔 (b) 계열을 한 번에 점검 → `__tests__` 제외 누락분 일괄 python 패치.
2. "RED until GREEN"/색상 sweep (a) 계열은 **목록만** → 각 트랙 결정(구현 vs 은퇴)으로 환류.
3. 개별 (a) 후보(314b 등)는 1건씩 정독.

---
## 진행 업데이트 (2026-06-03, batch 1)
### ✅ (b)/부수효과 — 수정 완료 (3 files green)
| 파일 | 분류 | 조치 |
| :-- | :-- | :-- |
| workbench-search-radix-298f | (b) FS스캔 __tests__ 누락 | skip 인자 추가 → 6/6 green |
| purchases-kpi-label-relabel-284a | (b) §11.352 부수효과 | "발주 전환 대기"→"발주 인계 대기" (7곳) → green |
| purchases-base-whitelist-284d | (b) §11.352 부수효과 | "발주 전환 대기"→"발주 인계 대기" (2곳) → green |

### 🔴 (a) 미구현 스펙 — list only (트랙별 결정 필요, 여기서 안 고침)
스폿 확인 6건 모두 코드에 스펙 미반영 (테스트는 옳음):
- 310c: `toast.info` + 후속 안내 카피 / `bg-emerald-50 border-emerald-200` 미반영
- 279c: vendor-dispatch-workbench `"전송 추적"` statusLabel + `failedCount>0` 분기 미반영 (파일 CRLF)
- 314b2: 에러 메시지 `'견적서 생성에 실패했습니다...'` 미반영 (옛 '견적 요청 전달 실패' 잔존)
- 339-1: 호출부 `unit: q.unit ?? product?.unit` / `price` fallback wiring 미반영
- 302d-1: inventory-main `§11.302d-1` trace marker 주석 누락 (Badge swap 자체는 pass)
- 302d-6b-2: vendor-dispatch `sendReadiness==="ready"?"bg-emerald..."` 색상 미swap

### 결론 (batch 1 후)
- FS스캔 (b) 계열 = 298f 한 건뿐(나머지 amber FS스캔은 pass). 소진.
- 잔여 ~37 = **대부분 (a) 미구현 스펙 백로그**. 일괄 테스트수정 불가 — 각 트랙에서 (구현 vs 센티넬 은퇴) 결정.
- 제 세션 부수효과(§11.352)는 284a/284d로 정리 완료. 다른 세션-부수효과 추가 발견 없음.

### 권장
1. 3개 (b) 수정 푸시 (이번 batch).
2. (a) ~37개는 트랙별 백로그로 — 호영님이 "지금 살아있는 기능에 영향 주는 것"만 우선순위. 다수는 미완 리팩토링(색상 sweep·rename·wiring)이라 급하지 않음.

---
## 진행 업데이트 (2026-06-03, batch 2 — rubric 분류 by 호영님 P-라이브/정합/무해)
> 코드 확인 기반(sandbox 마운트). 미실행분은 테스트명+사유로 분류, P-라이브는 코드 confirm 표기.

### 🔴 P-라이브 (우선 — 사용자가 누르는데 안 되는 것)
- **§11.312 sourcing-bar-ux + §11.312-b** — ✅confirm: 검색 페이지 sourcing bar(비교/견적/검토)가 `SourcingCandidatesSheet` 미연결(렌더 0, setCandidatesSheetMode 0). "검토 N 배지 dead button" 그대로. **실제 dead button.** → §11.312 트랙 구현.
- **§11.339 v2-4** — 하단 바 "검토 배지 클릭 → 견적함 탭 전환(forceQuoteKey)" 미wiring. dead-ish. (확정엔 코드 1회)
- **§11.339-1** — quote drawer 수량 조절 호출부(unit/price fallback) 미반영. 수량 조절 동작 영향 가능. (확정엔 1회)
- **§11.314-b** quote-generate-pdf — Pretendard 한글 폰트 미적용(fallback Helvetica) → PDF 한글 깨짐 가능. 라이브 품질. (확정엔 폰트 등록 1회)

### 🟡 P-정합 (보이지만 틀림 — 라벨/상태/문구)
- §11.314-b-2 에러문구 / §11.305-2 comparison-modal 에러문구 (옛 문구)
- §11.309d smart-receiving 모달 form 필드(srm-quantity)/validation 누락(모달 자체는 wiring됨)
- §11.317 헤더 popup category API / §11.320·321 inventory 상태배너·탭컨트롤(Phase GREEN target=미구현 enhancement)
- §11.303c enterprise-info / §11.303 pricing 콘텐츠 / §11.324 landing-search-triage

### ⚪ P-무해 (후순위 — 색상 sweep·주석·내부 리팩토링 잔여)
- 색상: 302d-1, 302d-3, 302d-6b-2, 310d, 310/310c, reorder-310 color
- dropdown/Radix 제거: 297d, 297e, 303hotfix-f, 295
- eyebrow/live/cleanup: 308b, dashboard-cleanup-stale-files
- smart-receiving naming/entry: 315b, 308a, 308a-v2
- receiving-packsize-split: 326, 326b / 311a 모바일 KPI

### ➕ (b) 추가 발견 — batch-fix 가능 (298f식 false-positive)
- **§11.305-phase3a** — 실제 런타임 버그(setSelectedProductId→setActiveCompareItemId)는 **이미 fix됨**. 테스트 `not.toMatch(/setSelectedProductId\(/)`가 **설명 주석**을 오판. → 테스트 regex를 코드라인 한정(주석 제외)으로 정정하면 green.
- **§11.298d** quotes/page.tsx 파일 머리에 **BOM(﻿×3)** — 인코딩 이슈 의심(§11.351/352 편집 잔류 가능). 확인 필요.

### 결론
- **즉시 가치 = §11.312 (dead button, confirm됨)** 하나가 명확한 라이브 결함. 나머지 P-라이브 3건은 확정에 코드 1회씩.
- 다수(~25건)는 P-무해(색상/주석/리팩토링) — 급하지 않음, 트랙별 천천히 or 센티넬 은퇴.
- (b) 2건(305-phase3a, 298d) 추가 batch-fix 가능.

---
## ⚠️ 정정 (2026-06-03 batch 3) — §11.312 재분류: (a)dead button → (b)stale 테스트
- **batch2 오판 정정:** §11.312를 "confirm된 dead button(P-라이브)"으로 분류했으나 **틀림.** `render=0`만 보고 단정한 추측이었음.
- **코드 정독 결과:** bar(비교/견적/검토)는 **이미 살아있음** — §11.339 v2가 SourcingCandidatesSheet(드로어)를 의도적 제거하고 **QuoteCartPanel 탭전환**으로 일원화. bar onClick = `setCompareFocusKey`/`setQuoteFocusKey`/`setReviewFocusKey`(line 1521/1560/1583) → forceQuoteKey/forceCompareKey(1247-8)로 탭 전환. testid(sourcing-bar-compare-open/quote-open/review-count) 다 존재.
- **§11.312 = (b) stale 테스트.** 옛 sheet 설계 단언. §11.339 v2 supersede.
- **조치:** §11.312 sentinel의 search/page wiring 단언 4개(sheet open/렌더)를 §11.339 v2 동작(FocusKey/QuoteCartPanel forceKey/review-count)으로 갱신. **코드 변경 0.** → 312 **22/22 green**. 컴포넌트/회귀 단언 보존.
- **교훈:** "render 0 = dead" 단정 금지. 대체 설계(sheet→탭) 가능성을 코드로 확인할 것. (메타교훈 ② "화면에 없어보임 ≠ 미구현"의 테스트판.)
- **연관 미확정:** §11.312-b(sourcing-bar-clear-all)·§11.339-v2-4 도 같은 §11.339 v2 supersede 계열(stale) 가능성 — 별도 확인 후 같이 갱신 검토.

### batch 3 확장 — §11.312-b · §11.339-v2-4 도 동일 stale 갱신 완료
- §11.312-b: `<SourcingCandidatesSheet`/`setCandidatesSheetMode` 보존 가드 → `<QuoteCartPanel`/`setCompareFocusKey`등(§11.339 v2 카트 일원화)로 갱신.
- §11.339-v2-4: `forceQuoteKey={reviewFocusKey` → `{(reviewFocusKey + quoteFocusKey)` 합산식 정합.
- 3종(312+312b+339v2-4) **34/34 green. 코드 0.** → §11.339 v2 supersede 계열 stale 소진.
- 정정: batch2의 §11.339-v2-4 "P-라이브(dead-ish)" 분류도 오판 — 코드 동작 살아있고 테스트 표현만 stale이었음.

### batch 3 확장 2 — §11.314-b · §11.339-1 도 stale (P-라이브 후보 전멸)
- **§11.314-b** = stale: `quote-request-pdf-generator.ts` 가 PretendardVariable.ttf 한글폰트 임베드(3경로 fallback + constructor font option). §11.326이 `doc.font("Helvetica")` fallback **의도적 제거**(한글 깨짐 silent 회피→미발견 throw). 테스트 단언만 옛 Helvetica fallback 기대 → `.not.toMatch(Helvetica)` 로 갱신.
- **§11.339-1** = stale: 수량조절 `onQuantityChange→updateQuoteItem` 생존. unit 매핑 표현차(`products.find(...)?.unit`), 가격판정 §11.338은 cart `priceText()`(unitPrice>0?...:"견적 후 확정")로 이동. 테스트를 코드현실로 갱신.
- **결론: P-라이브 후보 4건(312·339v2-4·314b·339-1) 전부 stale. 라이브 결함(a) = 0건.** batch2 "P-라이브" 분류(render0/테스트명 추측)는 전멸 — 방법론 폐기.
- 314b+339-1 **23/23 green. 코드 0.** → batch3 합류(5종 sentinel 갱신).
- **메타교훈 강화:** 코드 정독 없는 분류는 신뢰 불가. "테스트 빨강 = 코드 결함" 단정 금지(테스트 stale일 수 있음). 매 건 코드로 판정.
