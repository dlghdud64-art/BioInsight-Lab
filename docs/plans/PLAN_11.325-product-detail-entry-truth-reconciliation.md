# Implementation Plan: §11.325 — 제품 상세 진입 동선 Truth Reconciliation

- **Status:** ✅ Complete (§11.325 Truth + §11.325b Phase 0~3 sandbox 완료, 호영님 Phase 3 push 대기)
- **Spec received:** 2026-05-30 (호영님 spec §11.321 → 번호 충돌 매핑 §11.325)
- **Estimated Completion:** Truth audit 완료(0.5h), §11.325b 배선 작업 별도 (2~3h)
- **호영님 모델 권장:** Opus 4.7로 충분

---

## 🔖 번호 매핑

- 호영님 spec 번호: **§11.321** (제품 상세 진입 동선 Truth Reconciliation)
- 충돌: §11.321 = 재고 탭 세그먼트 컨트롤 (이미 사용)
- 새 매핑: **§11.325** (§11.320~§11.324 다음 미사용)

---

## 📊 Sandbox Audit 회신 (Q1~Q5)

### ✅ Q1. 제품 상세 페이지 라우트 존재 — **YES**

- `apps/web/src/app/products/[id]/page.tsx` **존재** (1293 lines, 풀 구현)
- "use client" + useSession + useProduct hook + useCompareStore + Image + Dialog/Card/Button/Badge 등 full UI 인프라
- 가설 B 사실 = 별도 제품 상세 페이지 라우트 존재

### ⚠️ Q2. §11.314 Part A "시약 정보 조회" — **별도 컴포넌트 미존재**

- `ReagentInfoLookup*` / `reagent-info-lookup*` 검색 = 0 매칭
- 단 `apps/web/src/app/_workbench/_components/product-detail-summary.tsx` (262 lines) 존재 — 워크벤치 inline summary 컴포넌트 (라벨 스캔 진입 결과 화면 후보, 추가 audit 필요)

### 🔴 Q3. 검색 결과 카드 클릭 동작 — **표면별 분기, 워크벤치 dead UI 확정**

**비로그인 `/search` 랜딩** (`app/search/page.tsx` 340 lines + `app/search/SearchResultList.tsx`):
- `ProductCard` 컴포넌트 사용 (`components/search/product-card.tsx`)
- line 95: `<Link href={`/products/${product.id}`} className="block">` — **카드 본체 Link wrap, /products/[id] 진입 정상**
- line 177: 추가 Link (제품명 등) + stopPropagation
- **✓ 정상 배선**

**로그인 워크벤치** (`app/_workbench/search/page.tsx`):
- `ProductCard` 미사용 (grep 0 매칭)
- `apps/web/src/app/_workbench/_components/sourcing-result-row.tsx` (363 lines) 사용 — 별도 row 컴포넌트
- line 208: `onClick={onSelect}` — 카드 본체 click = **선택 토글 (`onSelect` callback), 상세 진입 아님**
- line 319: `<ChevronRight ... className="h-3.5 w-3.5 ... hidden sm:block mt-1 ..." />` — **🚨 onClick 0, 시각 affordance only = dead UI!**
- `/products/` link 0 매칭 — **워크벤치 검색 카드는 제품 상세 페이지 진입 동선 미배선**

### ⚠️ Q4. 제품 상세 모달/패널 — **별도 모달/Drawer 미존재, 워크벤치 inline summary 존재**

- `ProductDetailDrawer` / `ProductDetailModal` / `ItemDetailPanel` 검색 = 0 매칭
- `app/_workbench/_components/product-detail-summary.tsx` (262 lines) 존재 — 워크벤치 inline product detail summary 컴포넌트
- 비교 검토 모달(`comparison-modal.tsx`) 내부 detail = 추가 audit 필요

### 🎯 Q5. 의도/누락 판별 — **(b) 미배선** (혼합)

- 비로그인 `/search` (ProductCard): ✅ 정상 배선
- 워크벤치 `/_workbench/search` (sourcing-result-row): 🚨 **미배선 + dead UI**
- 제품 상세 페이지 자체는 풀 구현(1293 lines)
- 호영님이 보신 `>` 아이콘 = sourcing-result-row.tsx line 319 ChevronRight = **명확한 dead UI**

---

## 🚦 회신 결과별 분기 — **§11.325b 배선 작업 진입 권장**

| 호영님 spec 회신 조건 | 본 audit 결과 | 조치 |
|---|---|---|
| Q1 라우트 존재 + Q5 (b) 미배선 | ✅ 라우트 존재 + 워크벤치 미배선 | **§11.325b 진입** — sourcing-result-row.tsx → /products/[id] 배선 |
| dead UI(`>` 아이콘) 즉시 정리 | ✅ ChevronRight onClick 0 | **§11.325b 와 통합 처리** — wiring 추가 또는 명시적 "상세 보기" 버튼 |

---

## 🛠 §11.325b 권장 작업 사양 (호영님 결정 대기)

### 옵션 A (호영님 spec 권장): 명시적 "상세 보기" 버튼 + ChevronRight wiring
- sourcing-result-row.tsx 에 명시적 "상세 보기" 버튼 추가
- ChevronRight 도 onClick 추가 (동일 동작) 또는 "상세 보기" button 으로 교체

### 옵션 B: 카드 본체 → /products/[id] (ProductCard 비로그인 패턴 정합)
- onSelect 가 선택 토글이라면 명시적 체크박스/버튼으로 분리
- 카드 본체 click → router.push(`/products/${id}`) 또는 `<Link href>` wrap

### 옵션 C: dead UI 제거만 (배선 보류)
- 워크벤치는 상세 진입 없이 비교/견적 액션만 (의도적 설계로 결정)
- ChevronRight 제거 (dead UI 정리)

**→ 호영님 spec "B 권장" 명시 = 옵션 A 권장.**

### §11.325b 예상 작업
- 대상 file: `app/_workbench/_components/sourcing-result-row.tsx` (단일)
- 변경:
  · ChevronRight onClick 추가 → `router.push(`/products/${product.id}`)` 또는 Link wrap
  · 또는 명시적 "상세 보기" 버튼 신설 (선호도에 따라)
  · onSelect 동작 보존 (체크박스/별도 영역으로 분리하지 않음, 호영님 spec 옵션 A 정합)
- sentinel: dead UI 0 단언 (ChevronRight wiring 또는 명시적 button)
- 회귀: 비교 추가/견적 담기 동작 영향 0, 모바일/데스크톱 일관성
- Estimated: 1~2h (Phase 0+1 sentinel + Phase 2 배선 + Phase 3 회귀+closeout)

---

## 🔍 추가 audit 권장 (호영님 §11.325b 진입 시)

1. `product-detail-summary.tsx` (262 lines) 의 정확한 역할
   - 라벨 스캔 결과 화면 (§11.314 Part A 후보)?
   - 워크벤치 inline drawer?
   - `/products/[id]` 페이지와 데이터 호환?
2. `app/_workbench/search/page.tsx` 내부 sourcing-result-row.tsx 사용 횟수 / 다른 caller
3. ProductCard 와 sourcing-result-row.tsx 통합 가능성 (호영님 spec 옵션 C 분리 결정 시)

---

## 📝 호영님 검토 후 결정 사항

- [ ] §11.325b 배선 작업 진입 승인 (옵션 A 권장)
- [ ] dead UI(ChevronRight) 즉시 정리 방향 — wiring 추가 vs 제거 vs 명시적 button 교체
- [ ] product-detail-summary.tsx 의 §11.314 Part A 정합 여부 추가 audit 필요 여부
- [ ] §11.325b 우선순위 (release-prep 후순위 vs P1 즉시)

---

## 11. Notes

- Truth Reconciliation 결과 호영님 의심대로 dead UI 확정 + 워크벤치 미배선
- 비로그인 vs 워크벤치 검색 카드 분기 = 의도/누락 혼재 (비로그인 OK, 워크벤치 누락)
- §11.314 Part A "시약 정보 조회" 구체 위치는 product-detail-summary.tsx 가 후보, 추가 confirm 필요
- §11.318-CORRECTION canonical 표면 결정 (host workbench) cross-reference 필요 진입 시

---

## 12. 추가 audit 결과 (호영님 §11.325b 진입 결정 후 sandbox 확인)

### product-detail-summary.tsx 정체 확정
- `<ProductDetailSummary>` 컴포넌트 + `toDetailData(product)` adapter (262 lines)
- prop: `variant: "full" | "compact"`, `showDetailLink?: boolean`, `compareCount`, `requestCount`, `onToggleCompare/Request`
- **§11.314 Part A "시약 정보 조회" 아님** — 일반 inline summary 컴포넌트 (워크벤치 우측 rail render)
- 라벨 스캔 진입 결과 화면이 아니라 워크벤치 dock 안에 inline render 되는 detail summary

### sourcing-context-rail.tsx Detail render 위치
- line 12: `import { ProductDetailSummary, toDetailData } from "./product-detail-summary";`
- line 51: `const detailData = toDetailData(product);`
- line 88-97: `<ProductDetailSummary data={detailData} variant="full" showDetailLink={true} ... />`
- **워크벤치 우측 rail = 이미 ProductDetailSummary inline render** (same-canvas 패턴 정합)
- `showDetailLink={true}` = `/products/[id]` full-page 보조 link 활성

### _workbench/search/page.tsx 의 wiring chain
- line 1133-1137: `<SourcingResultRow ... isSelected={railProduct?.id === product.id} ...>`
- line 1155: `onSelect={() => setActiveResultId(product.id)}` — card click → page state 갱신
- line 1214: `<SourcingContextRail ...>` — rail render with active product

### 🎯 결론 — 호영님 spec "패널/모달 우선 same-canvas" 패턴 사실상 이미 구현됨
- 카드 click → activeResultId state → rail 안 ProductDetailSummary render = 동작 정상
- **문제는 시각 affordance 부재** (사용자가 click → rail trigger 인지 못함)
- ChevronRight (line 319) = onClick 0 dead UI — 시각 affordance 만 보이고 동작 0 → 사용자 혼란
- 명시적 "상세 보기" 라벨 0 — onSelect 의 의미가 "선택 토글" 인지 "상세 진입" 인지 모호

→ **§11.325b 작업 = wiring 신설이 아니라 시각 affordance 명확화**
- ChevronRight 에 onClick={onSelect} + cursor-pointer + hover affordance 추가
- 명시적 "상세 보기" button 추가 (옵션 A, button + ChevronRight 둘 다 동일 onSelect 호출)
- showDetailLink={true} 보존 (rail 안 보조 link, /products/[id] 비로그인 진입로 정합)

---

## 13. §11.325b 진입 계획 (호영님 4 결정 반영)

### 호영님 결정 (4건)
1. ✅ §11.325b 진입 승인 + 옵션 A (명시적 "상세 보기" 버튼)
2. ✅ ChevronRight wiring 추가 (제거 X), hover + cursor pointer + button 과 동일 동작
3. ✅ 상세 진입 표면 = `product-detail-summary.tsx` 패널/모달 우선 (same-canvas), `/products/[id]` = 비로그인 진입로만
4. ✅ P1 즉시, §11.318-CORRECTION 과 병행 가능

### Phase 구조 (4 phase, ~1.5h) ✅ ALL COMPLETE (호영님 push 대기)

- **Phase 0**: Truth Lock ✅ COMPLETE (위 §10, §12 audit 완료)
- **Phase 1**: RED sentinel ✅ COMPLETE — 8 it, COMMIT_11.325b-phase0-1.md
- **Phase 2**: GREEN 작업 ✅ COMPLETE — sourcing-result-row.tsx 3 Edit (데스크탑 button + ChevronRight wrap + 모바일 button), COMMIT_11.325b-phase2-wiring.md
- **Phase 3**: 회귀 + closeout ✅ COMPLETE — 기존 sentinel 3건 영향 0 audit, PLAN closeout, COMMIT_11.325b-phase3-closeout.md

### Phase 3 회귀 audit 결과 (sandbox grep)

**Caller audit:**
- sourcing-result-row.tsx 유일 caller = `app/_workbench/search/page.tsx` (예상대로)
- props 시그니처 변경 0 → caller 영향 0

**기존 sentinel 영향 0 (3건):**
- `__tests__/dashboard/sourcing-button-outline-parity-268b.test.ts` — target = page.tsx Operating Status Bar button, sourcing-result-row 와 무관
- `__tests__/dashboard/sourcing-mobile-search-258a.test.ts` — target = page.tsx 모바일 검색 form, 검색 결과 카드 별개
- `__tests__/regression/sourcing-triage-removal-292.test.ts` — TRIAGE / 카드 배지 / Shortlist "제거" 단언, 신규 button 추가 영향 0

**§11.325b sentinel 자연 GREEN:**
- 8 it 모두 Phase 2 작업으로 자연 정합 (Phase 3 sandbox 추가 작업 0)

**모바일 final 검증:**
- 데스크탑 (sm:flex 영역): [비교 추가] [견적 담기] [상세 보기] [▶ ChevronRight button] — 4 elements, h-8 px-3 통일 패턴
- 모바일 (sm:hidden 영역): [비교 추가] [견적 담기] [상세 보기] — 3 elements, 375px overflow 0 예상 (각 button h-8 px-3 + gap-1.5)
- ChevronRight 모바일 hidden (`hidden sm:inline-flex`) — 모바일은 button 만으로 affordance

### 회귀 0 (Phase 3 audit 결과)
- caller 영향 0 (props 보존)
- 기존 sentinel 3건 영향 0
- sourcing-context-rail.tsx ProductDetailSummary render 보존
- /products/[id] 라우트 보존
- 비교/견적 담기 wiring 보존

### canonical 보존 (회귀 0)
- `onSelect={() => setActiveResultId(product.id)}` 보존 (page state 갱신)
- `isSelected={railProduct?.id === product.id}` 보존 (선택 상태 시각)
- onToggleCompare / onToggleRequest wiring 보존 (line 281-313)
- ChevronRight 시각 (className/size) 보존, onClick 만 추가
- showDetailLink={true} 보존 (rail ProductDetailSummary 안 /products/[id] 보조 link)
- /products/[id] 라우트 자체 보존 (비로그인 ProductCard 진입로)

### Risk
| Risk | 확률 | Mitigation |
|---|---|---|
| ChevronRight onClick 추가 시 카드 본체 onClick 과 propagation 충돌 | Med | stopPropagation 또는 이벤트 분리 |
| 모바일 ChevronRight `hidden sm:block` (line 319) — 모바일에서 button 만 보임 | Low | 모바일은 명시적 button 으로 충분, ChevronRight 데스크탑 보강 |
| "상세 보기" button 추가로 카드 액션 영역 overflow | Low | 모바일 영역 (line 323 sm:hidden) 정합 확인 |

### Rollback
- Phase 1 fail: sentinel 삭제
- Phase 2 fail: sourcing-result-row.tsx revert (단일 file)
- Phase 3 fail: sentinel 갱신만 revert
