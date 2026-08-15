# Implementation Plan: 소싱 제품 상세 정보밀도·CTA 정리 (§product-detail-refinement)

- **Status:** 🔵 Phase 2 완료 · **Phase 3 대기** (게이트 배선 완료)
- **Started:** 2026-07-25 · **Last Updated:** 2026-08-15

> ▶ **다음 세션 첫 줄: Phase 3 — `<CollapsedRow>` 선작성.**
> 착수 조건 닫힘(신설 쓰기 0, §7.12) · fixture 112/112 · 대조 대상 109.
> **EXIT 에서 `compareLabels()` 가 처음 실물을 잰다.**
>
> 🛑 **COMP 게이트는 아직 실물을 재지 않는다.** Phase 3~5 미구현이라
> 지금 도는 것은 **fixture 자기 무결성 + 비교기 실증**뿐이다
> (`src/__tests__/design/product-detail-comp-conformance.test.ts` 상단 등급 한계).
> **"게이트 배선됨" 을 "시안 정합 확보됨" 으로 읽지 말 것** —
> 이 저장소가 반복해서 만난 형태다(200 위장 · 델타 +1 · tsc 27→21 · 동명이인 정의부).

**CRITICAL INSTRUCTIONS** (phase 완료 시): ① 체크박스 갱신 ② quality gate 명령 실행 ③ 전 항목 통과 확인 ④ Last Updated 갱신 ⑤ Notes 기록 ⑥ 그 후 다음 phase.

⛔ quality gate skip 금지 · 미해소 truth 충돌 진행 금지 · dead button / no-op / front-only success 금지
⛔ 검증 = 하네스 원문 실행 · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`
⛔ **결정 교체 게이트 (호영님 승인 2026-07-25 "3건 전부 교체"):** 본 트랙은 §product-detail
  PD-B / PD-C / PD-L 의 3개 결정을 **교체**한다. → 각 sentinel 대체 = 별도 커밋 + 본 승인 주석 인용 필수.

---

## 결정 기록 (호영님 2026-07-25)

| # | 질문 | 결정 | 영향 |
| :--- | :--- | :--- | :--- |
| D1 | 트랙 실행 순서 | **본 트랙 → `PLAN_product-detail-sian-flat`** (직렬) | sian-flat P3/P4 는 본 트랙 종료 후 **대상 목록 재작성** 필요 (MSDS 배너·다크 영업 카드·stock-mini 3개가 본 트랙에서 삭제/흡수되므로 restyle 대상에서 제외). 병렬 편집 금지 |
| D2 | PD-B / PD-C / PD-L 교체 | **3건 전부 교체** | sentinel `product-detail-{completeness-pd-b, msds-pd-c, layout-pd-kl}.test.ts` 3종 대체 승인. 각 대체는 별도 커밋 + 본 표 인용 |
| D3 | buyer 권한 밖 액션 2종 | **buyer 에겐 버튼 미생성** (항목은 노출, 액션만 부재) | dead button 0 확보. 핸드오프 4종 → buyer 실효 2종(`정보 요청`·`SDS 업로드`)으로 축소. disabled 처리 **금지** |
| D4 | 프로토타입 `.dc.html` | **✅ 수령 완료 (2026-07-25)** | `소싱 제품 상세 개선 (단독).html` (22MB dc-bundle). 압축 해제·토큰 전수 추출 완료 → §0-B. **Phase 1 진입 blocker 해소** |
| D5 | 체크리스트 색 토큰 | **✅ 프로토타입 amber hex 그대로** (2026-07-25 최종) | 근거 3: ① CEO **2026-06-21 §11.302 예외 승인**이 이미 존재(hex amber 명시 허용) ② CLAUDE.md §9 금지 대상은 **Tailwind `amber-*` 클래스**이며 hex 는 레포의 문서화된 예외 경로 ③ 대비 전수 검증 통과(§0-C). **yellow 환산안은 철회** — 근거였던 "§9 위반" 판정이 오독이었음 |
| D6 | buyer 액션 3항목 (D3 수정) | **✅ `정보 요청` 으로 수렴** (2026-07-25) | 위험도 분류·사용 용도·보관 조건 → buyer 에겐 `정보 요청`(→`/support`), ADMIN·SUPPLIER 에겐 `안전 정보 편집`/`스펙 편집`. **역할별 액션 라벨 분기**. D3(버튼 미생성)는 이 3항목에 한해 **철회** — 6항목 전부 액션 보유 |

---

## 0. Truth Reconciliation (코드 실측 2026-07-25)

**Latest Truth Source:**
- 호영님 핸드오프 `소싱 제품 상세 핸드오프.md` (2026-07-25) — §0 문제 4건 · §1 본문 · §2 우측 패널 · §3 연계 · §4 QA 7항
- 프로토타입 `소싱 제품 상세 개선.dc.html` (1a 본문 · 1b 우측 패널) — **미확보. P1 진입 전 확보 필요**

**Secondary References:**
- `apps/web/docs/plans/PLAN_product-detail-sian-flat.md` — **Status 🔄 In Progress (2026-06-20)**, 시안 플랫 restyle 미완
- `docs/plans/PLAN_sourcing-product-surface.md` — §1-2④⑤⑥⑦ (PD 이전 트랙)
- `docs/plans/PLAN_sourcing-counter-timing.md` — **✅ Complete (2026-07-25, `9fe0eb2b`)**
- sentinel 8종: `product-detail-{completeness-pd-b, msds-pd-c, layout-pd-kl, alt-card-pd-g, hero-keyfacts-pd-e, honesty-125, back-affordance}.test.ts`

**실측 확정 (repo `C:\Users\young\ai-biocompare`, main HEAD `9fe0eb2b`):**

| 항목 | 실측 |
| :--- | :--- |
| 라우트 | `apps/web/src/app/products/[id]/page.tsx` — **1422줄 단일 파일** |
| 완성도 | `components/products/product-completeness.tsx` + `lib/product-detail/completeness.ts` — 분모 **8필드 고정**, 100% 시 숨김, **미등록 = 1줄 축약 + `정보 요청`(→`/support`) 링크 1개** |
| 완성도 색 | hex 커스텀 amber `#fbf0db / #f0dcae / #92610c`, bar `#dd9011` |
| 상세 스펙 0건 | **buyer 에게 완전 숨김** (`L507`: `(specification \|\| regulatoryCompliance \|\| canEditSpec)`) |
| MSDS 미등록 | `L769~` **앰버 경고 배너 + SDS 요청(→`/support`)** 별도 존재 |
| 위험도 칩 | `L643` `위험도: {label} · MSDS {등록\|없음}` — 배너와 **중복 표시 확정** |
| 규제 포털 | `L875~` `getRegulationLinksForProduct()` → **버튼 grid `lg:grid-cols-3`**, 소스 `lib/regulation/links.ts` 에 식약처 포털·식약처 안전정보포털·환경부 화학물질안전원·화학물질안전원 + 조건부 2 = **최대 6** |
| 담김 배지 | `L999~` `비교에 포함됨`(blue) + `견적함에 포함됨`(emerald) **2개**, **해제 액션 없음** |
| 주 CTA | `L1015~` 파란 `#2f6be0` 대형 버튼. `inQuoteCart` 시 라벨만 `견적함에 담김` + 클릭 시 **toast 만 반환(이동 0)** = 사실상 dead |
| 보조 CTA | `grid grid-cols-2` 안에 **`비교 추가` 1개만** → 레이아웃 결함(반쪽 빈칸) |
| 재고 조회 | `L1077~` **별도 stock-mini 링크 카드**(→`/dashboard/inventory`) — 보조 CTA 밖 |
| 다크 카드 | `L1085~` `맞춤 견적 문의` 그라데이션 카드(→`/support`) |
| 대체품 추천 | `L1099~` `AlternativeProductsSection` — **페이지 최하단**, 안전·규제 아래 |
| 하단 트레이 | `components/products/quote-tray-bar.tsx` — `비우기`(clear) + **`/dashboard/quotes`** = 견적 요청 목적지 |
| 🔴 **quote-cart remove** | `lib/quote/quote-cart-storage.ts` export = `readQuoteCart` / `addToQuoteCart` **2개뿐. 단일 품목 제거 함수 부재** |
| 🔴 권한 | `L191` `canEditSpec = ADMIN \|\| SUPPLIER` → **buyer 는 스펙·안전 편집 액션 없음** |

---

## 0-B. 프로토타입 실측 (`소싱 제품 상세 개선 (단독).html` · 2026-07-25 수령)

**추출 경로:** dc-bundle(22.7MB) → `__bundler/manifest` 21 entry(JS 3 + Pretendard woff/woff2 18) → gzip 해제 → `__bundler/template` JSON 언이스케이프 → `<x-dc>` 인라인 스타일 전수. **본문 1a = 760px · 우측 1b = 330px.**

### 1a 체크리스트 카드 — 토큰 전수

| 요소 | 값 | Tailwind 대응 |
| :--- | :--- | :--- |
| 카드 bg / border | `#fffbeb` / `1px #fde68a` | **amber-50 / amber-200** |
| 제목 `등록이 필요한 정보 6개` | `#92400e` · 13px · 800 | **amber-800** |
| 진행 바 track / fill | `#fef3c7` / `#d97706` · h6 · `999px` | **amber-100 / amber-600** |
| 퍼센트 `25%` | `#92400e` · 12px · 800 | amber-800 |
| 항목 텍스트 | `#78350f` · 12px | **amber-900** |
| 항목 불릿 `○` · 액션 라벨 | `#b45309` · 11.5px · 700 | **amber-700** |
| 하단 안내문 | `#a16207` · 11.5px | **yellow-700** |
| 그리드 | `grid-template-columns:1fr 1fr` · `gap:7px 18px` | — |

✅ **D5 최종 — 프로토타입 amber hex 채택.** 판정 근거는 §0-C.

---

## 0-C. D5 확정 — amber hex 채택 근거 + 대비 검증

### ① 이미 승인된 예외였다 (결정적)

`product-detail-completeness-pd-b.test.ts` 실측:

```
// CEO 2026-06-21 §11.302 예외 승인: 완성도 = 시안 amber 톤(arbitrary hex #fbf0db/#dd9011).
//   단 amber/orange Tailwind 클래스는 0(app-wide-amber-removed 가드 정합), 빨강 금지 보존.
```

→ 레포는 이미 **"hex = 승인된 예외 / Tailwind 클래스 = 금지"** 선을 명시적으로 긋고 있었다. `product-detail-msds-pd-c.test.ts`, `scan-hub-color.test.ts` 도 같은 문구로 동일 예외를 잠근다(총 3개 컴포넌트).

### ② 내 §9 위반 판정이 오독이었다

CLAUDE.md §9 의 금지 대상은 `Tailwind amber-*/orange-* 클래스`(16 amber-removed sentinel 이 지키는 것)이며, **hex 리터럴은 애초에 대상이 아니다.** 따라서 프로토타입 amber hex 는 정책 우회가 아니라 **정책이 허용한 경로**. "yellow 환산이 §9 준수"라는 내 앞선 서술은 근거 없음 → **철회.**

### ③ 대비 전수 통과 (WCAG 2.1 AA)

| 요소 | 값 | vs `#fffbeb` | 판정 |
| :--- | :--- | :--- | :--- |
| 제목 · 퍼센트 | `#92400e` | **6.84** | ✅ AA |
| 항목 텍스트 | `#78350f` | **8.75** | ✅ AA |
| 항목 불릿 · 액션 라벨 | `#b45309` | **4.84** | ✅ AA |
| 하단 안내문 | `#a16207` | **4.75** | ✅ AA |
| 진행 바 fill | `#d97706` | **3.07** | ✅ 비텍스트(3.0) |

⚠️ **잔여 1건:** 진행 바 fill 이 track `#fef3c7` 대비 **2.86** 으로 경계 대비가 낮다. 카드 bg 대비 3.07 은 통과하므로 AA 자체는 충족하나, 저시력 사용자에게 진행률 경계가 흐릴 수 있음. → **Phase 3 에서 track 을 `#fef3c7` 유지 + fill 에 `inset 0 0 0 1px rgba(146,64,14,.18)` 정도의 미세 경계 추가 검토**(색 변경 아님, 접근성 보강).

### 확정 토큰 = §0-B 표 그대로

§0-B 8개 값을 **변경 없이** 사용한다. 현행 `product-completeness.tsx` 의 `#fbf0db` / `#f0dcae` / `#92610c` / `#dd9011` / `#f3e1b5` → §0-B 값으로 갱신(amber → amber, 시안 톤 정합).

⛔ **불변:** Tailwind `amber-*` / `orange-*` **클래스는 여전히 0개**. 빨강 금지 유지. app-wide-amber-removed 가드 **무접촉**.

### 1a 체크리스트 6항목 — 라벨 × 액션 (시안 확정)

| # | 라벨 | 액션 라벨 | buyer 가능? |
| :--- | :--- | :--- | :--- |
| 1 | 규격/용량 | `정보 요청` | ✅ |
| 2 | MSDS/SDS | `업로드 · 요청` | ⚠️ 요청만(업로드 = ADMIN·SUPPLIER) |
| 3 | 규제 규격 | `정보 요청` | ✅ |
| 4 | 위험도 분류 | `안전 정보 편집` | ❌ → **D6: `정보 요청`** |
| 5 | 사용 용도 | `스펙 편집` | ❌ → **D6: `정보 요청`** |
| 6 | 보관 조건 | `스펙 편집` | ❌ → **D6: `정보 요청`** |

🔴 **D7 (2026-07-25 Phase 2 검증 중 발견) — 위 6항목이 완성도 8필드와 1:1 대응하지 않는다.**

`COMPLETENESS_FIELDS` 실측 = `catalogNumber` · `specification` · `regulatoryCompliance` · `grade` · `manufacturer` · `usageDescription` · `storageCondition` · `msdsUrl`.

| §0-B 항목 | 완성도 필드 | 상태 |
| :--- | :--- | :--- |
| 규격/용량 · 규제 규격 · 사용 용도 · 보관 조건 · MSDS/SDS | ✅ 5개 대응 | 정상 |
| **위험도 분류** | ❌ **필드 없음** | `getProductSafetyLevel()` **파생값** — 빈 필드가 아니라 `classified === false`(미분류) 신호 |
| — | 카탈로그 번호 · 등급 · 제조사 | §0-B 매트릭스에 **누락** (프로토타입 샘플 제품에서 이미 채워져 있었을 뿐) |

**⚠️ 결정적 위험:** 계약⑤가 위험도 칩(`page.tsx` L636–643)을 삭제한다. 그런데 위험도 분류는 완성도 필드가 아니라 `missingLabels` 에 **절대 나타나지 않는다.** → 칩 삭제 + 체크리스트 미표시 = **미분류 상태가 화면에서 완전 소멸.** `safety-decision-engine.ts` canonical 주석 `false=미분류(unknown): level=LOW 라도 '일반' 오도 금지` 와 본 계획서 `미등록 사실 은폐 0` 을 **동시 위반.**

✅ **D7 확정:** 체크리스트 행 = **`missingLabels`(완성도 파생) + 위험도 분류 행(`classified === false` 일 때만, 별도 소스)**. 위험도는 **표시 전용 행**이며 `COMPLETENESS_FIELDS`·분모 8 에 **넣지 않는다**(회귀 0 블록 보존). 이것만이 두 sentinel 을 동시에 만족하는 유일 해.

✅ **D8 확정:** 항목 수는 **데이터 파생**(가변). 프로토타입의 `6개` 는 샘플 제품값 — **하드코딩 금지.** 8필드 전부 미등록 + 미분류면 9행이 렌더된다.

✅ **D6 해소:** 권한 밖이 **3항목**(#4·#5·#6)임을 확인하고, buyer 에겐 이 3개를 `정보 요청`(→`/support`)으로 수렴. **6항목 전부 액션 보유 · dead button 0 · 미등록 사실 은폐 0.**

**최종 역할별 액션 매트릭스 (Phase 1 계약② 의 정본):**

| # | 라벨 | buyer | ADMIN · SUPPLIER |
| :--- | :--- | :--- | :--- |
| 1 | 규격/용량 | `정보 요청` → `/support` | `정보 요청` → `/support` |
| 2 | MSDS/SDS | `SDS 요청` → `/support` | `업로드 · 요청` (업로드 = `SdsDocumentsSection`) |
| 3 | 규제 규격 | `정보 요청` → `/support` | `정보 요청` → `/support` |
| 4 | 위험도 분류 | `정보 요청` → `/support` | `안전 정보 편집` → 안전 편집 Dialog |
| 5 | 사용 용도 | `정보 요청` → `/support` | `스펙 편집` → 스펙 편집 Dialog |
| 6 | 보관 조건 | `정보 요청` → `/support` | `스펙 편집` → 스펙 편집 Dialog |

**D7·D8 반영 — 매트릭스 보강 (3필드 누락분 + 위험도 행):**

| # | 항목 | 소스 | buyer | ADMIN·SUPPLIER |
| :-- | :--- | :--- | :--- | :--- |
| 7 | 카탈로그 번호 | `catalogNumber` | `정보 요청` → `/support` | `스펙 편집` |
| 8 | 등급 | `grade` | `정보 요청` → `/support` | `스펙 편집` |
| 9 | 제조사 | `manufacturer` | `정보 요청` → `/support` | `스펙 편집` |
| 4′ | **위험도 분류** | `classified === false` **(완성도 아님)** | `정보 요청` → `/support` | `안전 정보 편집` |

⛔ 계약② FAIL 조건: buyer 에게 `스펙 편집`·`안전 정보 편집` 라벨 노출 / **미등록 항목 중 액션 없는 항목 존재** / `disabled` 버튼 사용 / **미분류인데 위험도 행 미렌더** / 항목 수 `6` 하드코딩.

✅ **분모 8 정합 확인:** 시안 `미등록 6개` + `25%` → 8필드 중 2개 등록 = 25%. 현행 `computeCompleteness`(분모 8 고정)와 **정합**. 6 = 미등록 개수이지 분모 아님. **canonical 계산 무접촉 확정.** 단 시안 6개 라벨이 현행 `missingLabels` 문자열과 일치하는지는 Phase 1 대조 항목.

### 1a 접힘 행 — 3회 반복 (공용 컴포넌트 확정)

공통: `padding:11px 13px` · `border:1px #e2e8f0` · `radius:10px` · `bg:#fafbfc` · `gap:9px` · 리딩 `▸` `#94a3b8 11px` · 라벨 `#475569 12.5px 700` · 상태 `#94a3b8 11.5px` · 액션 `#2563eb 11.5px 700 margin-left:auto`

| 행 | 라벨 | 상태 | 액션 |
| :--- | :--- | :--- | :--- |
| 1 | 상세 스펙 | `미등록` | `정보 요청` |
| 2 | 등록된 SDS 문서 | `0건` | `SDS 업로드` |
| 3 | **국내 규제기관 포털** | `6개 링크` | `식약처 포털 ↗` · `화학물질안전원 ↗` · `더보기`(`#64748b`) |

🟡 **계획 정정:** 규제 포털이 **별도 섹션이 아니라 접힘 행 3번째**로 통합됨. `<CollapsedEmptyRow>` 추출은 "3회 이상 시 검토"가 아니라 **확정 요구사항**.

### 1a 대체품 추천 (안전·규제 위)

- 헤더: `대체품 추천` + 부제 `가격·스펙이 공개된 유사 제품 3건 — 정보 미등록 품목일수록 먼저 확인`
- 카드 3열 `flex:1` · `border 1px #e2e8f0` · `radius:11px` · `padding:12px`
- 배지: `가격 공개` = `#15803d` / `#f0fdf4`, `SDS 있음` = `#1d4ed8` / `#eff6ff` (10.5px · 700 · `radius:5px`)
- 카드 하단: `비교` · `상세 ›` 2분할 아웃라인 `h28`
- **배지는 조건부** — 시안 3카드가 각각 (둘 다) / (가격만) / (SDS만) 로 다름 = **실 데이터 파생 확정, 장식 아님**

### 1a `제품 사양` 카드

- 제목 옆 green 배지 `4개 확인` (`#15803d`/`#f0fdf4`) — **sian-flat P3 의 "N개 항목 확인 배지"와 동일 요구.** 두 트랙 교집합 → 본 트랙에서 처리
- 2열 정의 그리드 · `border 1px #eef2f7` · `radius:10px` · 셀 `padding:10px 13px` · 라벨 `#94a3b8 11px` / 값 `#0f172a 12.5px`

### 1b 우측 패널 — **수직 순서 확정**

```
공급가 (VAT 별도)        #94a3b8 11px 700
견적 후 확정             #0f172a 15px 800
가격이 공개되지 않아…     #64748b 11.5px (납기·최소 주문 포함 1줄)
───────── divider #eef2f7
✓ 견적함·비교함에 담김   [해제]   bg #f0fdf4 · border #dcfce7 · text #15803d · h≈34 · radius 9
[ 견적 요청서 만들기 → ]          bg #16a34a · #fff · h40 · radius 10 · 13px 700
견적 요청은 무료이며 구매 의무가 없습니다   #94a3b8 11px center
[ 비교 검토 ] [ 재고 조회 ]        2분할 · h32 · border #e2e8f0 · #334155 11.5px
```

- `해제` 라벨 = `#64748b` · 700 · `margin-left:auto`
- 🟡 **가격 영역이 담김 칩보다 위** — 내 이전 Phase 4 순서(칩 → 주CTA → 보조)에 **가격 블록 선두**를 추가해야 함
- 🔴 **다크 `맞춤 견적 문의` 카드가 시안 1b 에 아예 없음.** 푸터 텍스트 링크의 **위치·문구·스타일 근거 없음** → 핸드오프 md §2 문구만이 근거. Phase 4 에서 최소 구현(`/support` 링크 1줄) 후 확인 요청
- 🔴 **미담김 상태 시안 없음.** 1b 는 담김 상태 전/후 대비만 제시. 미담김 분기(파란 `견적함에 담기`)는 **md §2 문구 근거로 현행 유지**

**Conflicts Found (전부 결정 교체 게이트 대상):**

1. **PD-L vs 핸드오프 §1** — 현행: 빈 상세 스펙 카드 **buyer 숨김**. 핸드오프: **접힌 한 줄 `▸ 상세 스펙 · 미등록 · [정보 요청]`** 노출. → **정반대.** sentinel `product-detail-layout-pd-kl.test.ts` 잠금.
2. **PD-C vs 핸드오프 §1** — 현행: MSDS 미등록 **경고 배너 유지**(PD-C 결정). 핸드오프: **하위 중복 배너 삭제**, 상단 체크리스트 1개로 통합. sentinel `product-detail-msds-pd-c.test.ts` 잠금.
3. **PD-B vs 핸드오프 §1** — 현행: 미등록 **1줄 축약 + 링크 1개**. 핸드오프: **6항목 2열 + 항목별 액션 4종**. sentinel `product-detail-completeness-pd-b.test.ts` 잠금.
4. ~~**완성도 색 토큰 충돌**~~ — **충돌 아님으로 종결.** 2회 오판 후 정정: (i) "핸드오프 = yellow 정합" → 실제는 amber hex, (ii) "amber hex = §9 위반" → 실제는 **CEO 2026-06-21 승인된 예외**. §9 금지 대상은 Tailwind 클래스 한정. **D5 = 프로토타입 amber hex 그대로**(§0-C).
5. **핸드오프 §3 (헤더 카운터 중복 제거)** — `§sourcing-counter-timing` 에서 **2026-07-25 이미 종결**(`ccae0a44` 헤더 카운터 제거). → **본 트랙 스코프에서 삭제.**
6. **`PLAN_product-detail-sian-flat` 미완(In Progress)** 위에 본 트랙이 적재됨.
   - 실측: **Phase 1~5 전부 미체크**, Last Updated 2026-06-20, `page.tsx` mtime 2026-06-20 이후 정지(5주).
   - **정면 충돌 3건:** sian-flat P3 `MSDS 앰버 배너 유지`·`reg-link 3열 카드 restyle` / P3 `미등록 dashed 1줄` / P4 `stock-mini·다크 영업 카드 플랫 restyle` — **전부 본 트랙의 삭제·흡수 대상.**
   - **→ D1 결정: 본 트랙 선행.** 구조 확정 후 sian-flat 이 시각 토큰을 입힘(재작업 0). 역순은 삭제될 요소 3개를 restyle 하는 낭비.
   - 시각 토큰 충돌 시 **시안 플랫 토큰이 상위**, 본 트랙은 **구조·정보밀도·CTA 우선순위만** 손댐.

**Chosen Source of Truth:**
- 핸드오프 `소싱 제품 상세 핸드오프.md`. PD-B/C/L 은 **정보 분산(3중 경고)** 문제를 인지하기 전 결정이므로 교체.
- 단 **PD-L 의 원 취지(빈 카드가 화면 지배 방지)는 보존** — 핸드오프의 "접힌 한 줄"이 같은 목적의 상위 해법.
- canonical truth 무접촉: 완성도 계산(분모 8 고정), `quote-cart-storage-v2`, `compare-store` 값 로직 **변경 0**. 본 트랙은 **표시 계층 + 제거 액션 1개 신설**.

**Environment Reality Check:**
- [x] repo 연결 확인 (`C:\Users\young\ai-biocompare`, main `9fe0eb2b`)
- [x] runnable: `vitest run`(격리), `npm run build`(**operator 전용** — sandbox 는 공유 node_modules 오염 금지)
- [x] 프로토타입 `.dc.html` **수령·해제·토큰 전수 추출 완료(D4)** → §0-B
- [ ] 런타임 스모크: `www.labaxis.co.kr` 로그인 세션 필요 (Claude in Chrome)

---

## 1. Priority Fit

- [ ] P1 immediate
- [x] **Release blocker (부분)** — 아래 2건만
- [x] Post-release (나머지)
- [ ] P2 / Deferred

**Why:**
- **Blocker 2건:** ① `견적함에 담김` 버튼이 클릭 시 toast 만 반환 = **정직성 위반(no-op 클래스)**. ② `grid-cols-2` 반쪽 빈칸 = 레이아웃 결함.
- **나머지 5건**(체크리스트 통합·0건 접힘·규제 포털 축소·대체품 이동·다크 카드 강등)은 **정보밀도 개선 = post-release**.
- 신규 데이터 모델·스키마 변경 0. `PLAN_product-detail-sian-flat` 미완이 상위 우선이면 **본 트랙 전체 defer 가능**(호영님 판단).

---

## 2. Work Type

- [x] Design Consistency (주 — 정보밀도·CTA 위계)
- [x] Bugfix (`견적함에 담김` no-op · 반쪽 grid)
- [x] Feature (**단일 품목 견적함 해제** — 신규 storage mutation)
- [x] Web
- [ ] 스키마/모델 변경 0 · [ ] 완성도 계산 로직 변경 0 · [ ] Mobile(별도)

**Scope:** Medium — 6 phases, 9~13h.

---

## 3. Overview

**Feature Description:**
`/products/:id` 상세에서 (a) 미등록 경고 3중 분산(완성도 배지 · MSDS 배너 · 위험도 칩)을 **상단 체크리스트 1개**로 통합, (b) 데이터 0건 섹션을 **접힌 한 줄 + 액션**으로 축약, (c) 규제 포털 6버튼을 **상시 2 + 더보기 텍스트 링크**로 축소, (d) 대체품 추천을 **안전·규제 위로 승격**, (e) 우측 패널 CTA 위계를 **담김 상태 기준으로 재배치**하고 `해제` 를 실 mutation 으로 신설.

**Success Criteria (핸드오프 §4 QA 7항 = 인수 기준):**
- [ ] 미등록 경고가 **상단 체크리스트 1개로만** 존재 (MSDS 배너·위험도 칩 중복 표기 제거)
- [ ] 0건 섹션이 **접힌 한 줄 + 액션**으로 렌더 (`▸ 상세 스펙 · 미등록 · [정보 요청]` / `▸ 등록된 SDS 문서 · 0건 · [SDS 업로드]`)
- [ ] 대체품이 **안전·규제 위**, 대비 배지(`가격 공개`·`SDS 있음`) 표기
- [ ] 담김 상태에서 주 CTA = **`견적 요청서 만들기 →`** (green `#16a34a`, → `/dashboard/quotes`)
- [ ] **`해제` 클릭 시 서버/스토리지 반영 후 상태 변경** (front-only success 금지)
- [ ] 규제 포털 **2 + 더보기**
- [ ] 다크 `맞춤 견적 문의` 카드 제거 → 푸터 텍스트 링크 강등

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] 완성도 **계산 로직**(분모 8필드·필드 목록) 변경
- [ ] `quote-cart-storage-v2` / `compare-storage` **스키마** 변경
- [ ] 헤더 카운터 정리 — **§sourcing-counter-timing 종결분**(무접촉)
- [ ] 시안 플랫 restyle 전반 — `PLAN_product-detail-sian-flat` 소관
- [ ] 모바일 하단 바(`L1162`) 재설계 — 별도 트랙
- [ ] `/compare` 라우트·비교 트레이
- [ ] catalog spec backfill (operator 레인)
- [ ] 신규 AI/추천 모델 — `AlternativeProductsSection` 은 **위치·배지만** 변경

**User-Facing Outcome:**
빈 데이터 제품에서도 화면 절반이 "없음" 카드로 낭비되지 않고, 이미 담은 품목은 **다음 행동(견적 요청서 작성)** 이 주 CTA 로 보인다.

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock — 상세는 dock 대상, 구조 무접촉
- [x] same-canvas — **신규 페이지 0**
- [x] canonical truth — 완성도 파생·quote/compare storage 값 로직 불변
- [x] invalidation discipline — `quote-cart-changed` 이벤트 계약 승계

**Must Not Introduce:**
- [x] page-per-feature
- [x] chatbot/assistant 재해석
- [x] dead button / no-op / placeholder success ← **본 트랙 최대 리스크**
- [x] preview 가 actual truth 를 덮음

**Canonical Truth Boundary:**
- **Source of Truth:** `db.product`(`useProduct`) · `quote-cart-storage-v2`(localStorage) · `compare-store`
- **Derived Projection:** `computeCompleteness()`(8필드) · `getDisplaySpecs()` · `getRegulationLinksForProduct()` · 담김 배지 · 하단 트레이 카운트
- **Snapshot / Preview:** 없음
- **Persistence Path:** `addToQuoteCart` / **신규 `removeFromQuoteCart`** / `compare-store.removeProduct` / `PATCH safety·spec`

**UI Surface Plan:**
- [x] Inline expand (0건 섹션 접힘/펼침)
- [x] Existing route section (`/products/:id` 본문 · 우측 레일)
- [ ] New page — **없음**

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| `removeFromQuoteCart(productId)` 를 `lib/quote/quote-cart-storage.ts` 에 신설 | 해제 CTA 가 front-only 가 되지 않으려면 실 mutation 필수. 기존 `addToQuoteCart` 와 동일 계층 | storage 표면 확대. `quote-cart-changed` 이벤트 발행 누락 시 트레이 drift → 계약 테스트로 봉합 |
| 체크리스트 항목별 액션을 **역할 분기 매핑 테이블**로 분리 (**D6 확정**) | buyer 는 `canEditSpec=false` → `스펙 편집`/`안전 정보 편집` 노출 시 dead button 확정 | 매핑 테이블 유지비. buyer 는 3항목이 `정보 요청` 으로 수렴 → 같은 목적지(`/support`)로 3개 중복. 대신 **6항목 전부 액션 보유 · dead button 0** |
| 규제 포털 상시 2 = `lib/regulation/links.ts` 배열 **선두 2** 고정 | 소스 순서가 이미 식약처 포털 → 화학물질안전원. 별도 우선순위 필드 불필요 | 카테고리별 조건부 링크가 선두에 오면 의도와 달라짐 → 명시 id 화이트리스트로 고정 |
| 대체품 섹션은 **JSX 위치만 이동**, 컴포넌트 무변경 | 최소 diff. `product-detail-alt-card-pd-g` sentinel 보존 | 대비 배지(`가격 공개`·`SDS 있음`) 추가 시 컴포넌트 1곳 수정 불가피 |
| 다크 카드 → 푸터 텍스트 링크 | 주 CTA 경쟁 제거. 목적지 `/support` 동일 유지 | 영업 문의 전환 하락 가능 → 링크 유지로 동선 보존 |

**Dependencies:**
- **Required Before Starting:** 프로토타입 `소싱 제품 상세 개선.dc.html` 확보 · PD-B/C/L 교체 승인
- **External Packages:** 없음
- **Touched:** `app/products/[id]/page.tsx` · `components/products/product-completeness.tsx` · `lib/quote/quote-cart-storage.ts` · `lib/product-detail/completeness.ts`(읽기) · `components/products/quote-tray-bar.tsx`(읽기) · sentinel 3종 교체

**Integration Points:**
- `/support` (정보 요청 · SDS 요청 · 영업 문의)
- `/dashboard/quotes` (견적 요청서 만들기 — 하단 트레이와 동일 목적지)
- `/dashboard/inventory` (재고 조회)
- `SdsDocumentsSection` (SDS 업로드 — `canUpload` = ADMIN·SUPPLIER 게이트 승계)

---

## 6. Global Test Strategy

Red-Green-Refactor 엄수.

- **표시 계층 변경** → sentinel(readFileSync + regex, CLAUDE.md 패턴) 필수
- **`removeFromQuoteCart`** → 단위 테스트 필수 (제거 후 read 결과 · 이벤트 발행 · 미존재 id 안전성)
- **역할 분기(액션 매트릭스)** → buyer / SUPPLIER / ADMIN 3케이스 매트릭스 테스트
- **user-visible critical flow** → 담기→해제→재담기 스모크 1회 (런타임)
- 새 sentinel 마다 **"회귀 0" describe 블록 필수** (CLAUDE.md)
- `npm run build` = **operator 전용**. sandbox 에서는 "실행 불가" 명시

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock ✅ (본 문서 §0 로 완료)
**Goal:** truth source·충돌·실행 가능 명령 잠금.
- Status: [x] Complete

**🔴 RED:** PD-B/C/L 충돌 3건 · 핸드오프 §3 중복 1건 · `removeFromQuoteCart` 부재 · buyer 권한 공백 식별
**🟢 GREEN:** 실측표 확정, Chosen Source of Truth 기록
**🔵 REFACTOR:** §3 을 스코프에서 제거(이미 종결), 시안 플랫 트랙과 경계 분리

**✋ Quality Gate:** [x] 미해결 충돌 0 (전부 §0 기록) · [x] 우선순위 판정 기록 · [ ] **프로토타입 미확보 = 잔여 blocker**
**Rollback:** 문서만, 코드 변경 0

---

### Phase 1: Contract & Failing Tests
**Goal:** 의도된 동작을 실패 테스트로 고정.
- Status: [x] **Complete (2026-07-25)** — `product-detail-refinement.test.ts`

**실행 결과(호영님 격리 실행):** 36 tests → **26 FAIL / 10 PASS** (exit 255 = RED 존재, 정상)
- 회귀 0 블록 **6/6 PASS** ✅ — 분모 8필드 · 100% 배지 숨김 · quote-cart 스키마 · 규제 링크 소스·면책 · 완성도 진입점 · PD-K 썸네일
- 계약 ①~⑦ **26 RED** — ①4 / ②4 / ③4 / ④8 / ⑤2 / ⑥1 / ⑦3

**🔴 false-GREEN 1건 발견·수정:**
계약⑥ `상시 2개 화이트리스트 + 더보기` 가 **구현 없이 PASS**. 원인 = 구 단언 `toMatch(/더보기/)` 가
**컴플라이언스 링크 섹션의 기존 더보기**(L862 `showMoreComplianceLinks`)에, `toMatch(/국내 규제기관 포털/)`
가 기존 제목(L874)에 각각 매칭. 두 문자열 모두 규제 포털 축소와 무관. → 전용 식별자 3단언으로 교체
(`REG_PORTAL_ALWAYS`/`mfds`·`kchem` · `showMoreRegPortal` · `CollapsedRow` 근접도). 동시에 컴플라이언스
링크 섹션을 **회귀 0 명시 보존 대상**으로 격리.

**선(先)만족 앵커 3건(정상 — 억지 RED 전환 대상 아님):**
② `disabled 금지`(COMP 에 버튼 부재) · ⑦ `Tailwind amber/orange 0`(app-wide 가드 승계) · ⑦ `빨강 금지`(§11.302 승계)

**✋ Quality Gate 판정:** ✅ 통과 — RED 실재 확인, 기존 sentinel 무회귀, false-GREEN 1건 봉합 완료

**🔴 RED:**
- 계약①: `removeFromQuoteCart(id)` — 제거 후 `readQuoteCart()` 에 미포함 + `quote-cart-changed` 발행 + 미존재 id no-throw
- 계약②: 체크리스트 액션 매트릭스 — role × 미등록필드 → 노출 액션 (buyer 에 `스펙 편집` 노출 시 FAIL)
- 계약③: 0건 섹션 = 접힌 한 줄 렌더 + 액션 1개 (숨김이면 FAIL)
- 계약④: 담김 상태 주 CTA 라벨 = `견적 요청서 만들기` + href `/dashboard/quotes` (파란 담기 버튼이면 FAIL)
- 계약⑤: MSDS 배너·위험도 칩 중복 문구 부재
- 계약⑥: 규제 포털 노출 버튼 ≤ 2 + `더보기` 존재

**🟢 GREEN:** 계약 스캐폴딩만(구현 0)
**🔵 REFACTOR:** sentinel 파일명·§ 태그 정리 (`product-detail-refinement.test.ts`)

**✋ Quality Gate:**
- [ ] 6개 계약 전부 **실제 FAIL** 확인(false-RED 금지)
- [ ] 기존 sentinel 8종 baseline-delta 확인 (PD-B/C/L 3종은 **교체 예정 표시**, 나머지 5종 PASS 유지)
- [ ] lint/typecheck 결과 또는 "실행 불가" 명시

**Rollback:** 테스트 파일 revert

---

### Phase 2 결과 (2026-07-25 · commit `8d1e443f`)

**Status: [x] Complete — 단, 범위 축소 + 결함 2건 이월**

게이트 실측: **15 passed / 24 failed (39)** · F10 EXIT 0 · 회귀 0 블록 6건 보존 · ③~⑦ 누출 0.

| 계약 | 결과 |
| :--- | :--- |
| ① `removeFromQuoteCart` | **4/4 GREEN** ✅ |
| ② 역할 분기 | **2/5 GREEN** (lib 파생 + disabled) — 나머지 3은 COMP grep → **Phase 3 이관** |
| ③~⑦ | RED 유지 (의도대로) |

**🔴 내 지시 오류:** "계약②(4) GREEN + UI 무접촉(lib 2파일만)" 은 **양립 불가**였다. 계약②의 5단언 중 3개가
`product-completeness.tsx` 를 grep 하는데 lib 만 만지라고 지시했다. **계약 파일을 내가 쓰고도 그 의존을
Phase 지시에 반영하지 않은 것.** → 계약②를 **②-lib(Phase 2)** / **②-UI(Phase 3)** 로 분리한다.
"lib-only 로 최대 2 GREEN 이 상한" 이라는 실측 판정이 정확했다.

**🔴 검증 중 발견 — 결함 2건 (Phase 3 필수 선결):**

1. **[High] 위험도 분류 소멸 위험** → **D7** 신설(§0-B). 계약⑤가 위험도 칩을 삭제하는데 위험도는 완성도
   필드가 아니어서 `missingLabels` 에 안 뜬다. 칩 삭제 + 체크리스트 미표시 = 미분류 상태 화면 소멸.
   `safety-decision-engine` canonical(`미분류를 '일반'으로 오도 금지`) 위반.
2. **[Med] `ACTION_BY_FIELD` 3필드 누락** — `catalogNumber` · `grade` · `manufacturer` 가 매핑에 없어
   **폴백(`info_request`)** 으로 떨어진다. → ADMIN·SUPPLIER 가 **자기가 편집 가능한 필드에 `정보 요청`** 을 본다.
   폴백이 조용히 삼켜서 테스트도 통과. **폴백을 privileged 에 대해 throw 또는 `spec_edit` 으로 교정 필요.**

**✋ Quality Gate 판정:** ⚠️ 조건부 통과 — lib 2파일 자체는 정확(계약① 4/4, 분모·스키마 불변, F10 0).
D7·D8 및 결함 2를 Phase 3 착수 전 계약에 반영할 것.

### Phase 2 (원안): quote-cart 해제 mutation + 완성도 액션 모델
**Goal:** 표시 이전에 **실 동작**을 먼저 확보. (no-op 원천 차단)
- Status: [ ] Pending

**🔴 RED:** 계약①②의 단위 테스트
**🟢 GREEN:**
- `lib/quote/quote-cart-storage.ts` 에 `removeFromQuoteCart(productId)` 신설 — read → filter → write → `quote-cart-changed` dispatch
- `lib/product-detail/completeness.ts` 에 **액션 매핑 파생** 추가(계산 로직 불변, `missingLabels` → `{ label, actionKind, href|handler, requiresRole }[]`)
- buyer 에게 role 미달 액션은 **버튼을 만들지 않음**(disabled 아님 — dead button 회피)

**🔵 REFACTOR:** `addToQuoteCart` 와 이벤트 발행 경로 공통화

**✋ Quality Gate:**
- [ ] 계약①② GREEN
- [ ] 완성도 **분모 8·필드 목록 무변경** 확인(회귀 0 describe)
- [ ] storage 스키마 무변경 확인
- [ ] overfetch/N+1 신규 0 (localStorage 전용)

**Rollback:** `quote-cart-storage.ts` · `completeness.ts` 파일 단위 revert (UI 무접촉이라 독립)

---

### Phase 3: 본문 재구성 (핸드오프 §1)
> ⛔ **EXIT 게이트: COMP 적합성 대조 (§7.6).** 이 Phase 의 산출 화면을 COMP fixture 와 문자열/값 대조한다. **불일치 1건 = RED.** 눈으로 확인하지 않는다.

**Goal:** 3중 경고 → 체크리스트 1개, 0건 섹션 접힘, 규제 포털 축소, 대체품 승격.
- Status: [ ] Pending

**🔴 RED:** 계약③⑤⑥ + 대체품 위치 계약
**🟢 GREEN:**
0. **`<CollapsedRow>` 공용 컴포넌트 선작성** — §0-B 접힘 행 토큰(`p 11/13`·`#e2e8f0`·`r10`·`#fafbfc`·`▸`·라벨 `#475569`·상태 `#94a3b8`·액션 `#2563eb`). **3회 사용 확정**
1. `ProductCompleteness` → **체크리스트 카드**로 확장 (**색 = §0-B amber hex 8토큰 그대로** · 진행 바 · 6항목 `grid 1fr 1fr gap 7/18` · 역할별 액션 = §0-B 매트릭스 · §0-C 진행 바 경계 보강 검토)
2. MSDS 미등록 배너(`L769~`) **삭제** · 위험도 칩(`L643`) 에서 `· MSDS 없음` 중복 문구 제거
3. 상세 스펙 0건 → `▸ 상세 스펙 · 미등록 · [정보 요청]`
4. SDS 0건 → `▸ 등록된 SDS 문서 · 0건 · [SDS 업로드]`
5. 규제 포털 → **접힘 행 3번째로 통합** `▸ 국내 규제기관 포털 · 6개 링크 · [식약처 포털 ↗][화학물질안전원 ↗][더보기]` (별도 섹션 아님 — §0-B 정정)
   - 상시 2개 = `lib/regulation/links.ts` id **`mfds` · `kchem`** 화이트리스트 고정(배열 순서 의존 금지 — `me`("환경부 화학물질안전원")와 `kchem`("화학물질안전원") 혼동 주의. 프로토타입 라벨 = `화학물질안전원` = **kchem**)
   - 더보기 상태는 **전용 식별자**(`showMoreRegPortal` 등). ⚠️ 기존 `showMoreComplianceLinks`(컴플라이언스 링크 섹션, L862)와 **별개 블록** — 재사용·병합 금지, 해당 섹션은 무접촉
6. `제품 사양` 카드 제목 옆 green `N개 확인` 배지 (`#15803d`/`#f0fdf4`) — sian-flat P3 교집합
7. `AlternativeProductsSection` JSX 를 **안전·규제 위**로 이동 + 3열 카드 + **조건부** 대비 배지(`가격 공개` `#15803d/#f0fdf4` · `SDS 있음` `#1d4ed8/#eff6ff`) + 카드 하단 `비교`·`상세 ›` + 부제 문구
8. 추천 "분석 중…" = 스켈레톤 대신 접힘 유지 → 결과 도착 시 자동 펼침 (**timeout·error 상태 명시 필수**)

**🔵 REFACTOR:** `<CollapsedRow>` 사용처 3곳 일관성 확인, 인라인 스타일 → Tailwind 토큰 환산

**✋ Quality Gate:**
- [ ] 계약③⑤⑥ GREEN
- [ ] 미등록 경고 표기 지점 **정확히 1곳**
- [ ] 접힘 행 액션 = 실 라우트/핸들러 (dead 0)
- [ ] 추천 자동펼침에 **timeout·error 분기 존재**(영구 접힘 금지)
- [ ] 터치 영역 ≥ 44px (CLAUDE.md §8)
- [ ] JSX 구조 안정성 §10 (ternary 안 단독 comment 금지 · fragment)
- [ ] first fold: 필터/배너/KPI 합산 < 화면 50%
- [ ] 🟡 **§0-B amber hex 8토큰 전수 일치 — 보류** (해제 조건: **§0-B yellow 확정**)
      ⚠️ **"미적용"·"제외" 로 적지 않는다** — 폐지로 읽힌다(§상태표기 규칙).
      보류 사유: ②-b(amber 금지 위반 2곳)가 §0-B 토큰 정본 재판정을 요구한다
- [ ] ✅ **②-a `안전재고 미달` `#b45309` → red `#b91c1c`** (대비 6.47 AA) — **Phase 3 동반**
      §11.283a 신호등 의미 충돌이지 색 규칙 위반이 아니다. red 는 §0-B 에 이미 정본 →
      **토큰 재판정 불요.** ②-b 와 층이 다르다(컴포넌트 vs 토큰 정본)
- [ ] **Tailwind `amber-*`/`orange-*` 클래스 0개** (app-wide 가드 정합) · 빨강 0
- [ ] 구 hex(`#fbf0db` `#f0dcae` `#92610c` `#dd9011` `#f3e1b5`) 잔존 0
- [ ] PD-B/C/L sentinel 교체분 = **별도 커밋 + 승인 주석**

**Rollback:** `page.tsx` 본문 hunk + `product-completeness.tsx` revert → Phase 2 상태

---

### Phase 4 지시 — 런타임 스모크 (정적 게이트 사각지대)

**원칙:** 아래 6종은 **48/48 이 전부 GREEN 인 상태에서도 깨질 수 있다.** 문자열은 있는데 배선이
틀린 경우를 잡는 것이 목적. `pnpm dev` 로 실제 클릭할 것.

| # | 시나리오 | 무엇이 깨질 수 있나 | 계약이 못 보는 이유 |
| :-- | :--- | :--- | :--- |
| **S1** | **미분류 제품** 상세 진입 | 위험도 행이 실제로 렌더되는가 (**D7 의 존재 이유**) | `classified` 전달은 검사하나 `level !== "unknown"` **판정이 뒤집혔는지**는 모름 |
| **S2** | **ADMIN 로그인** → 체크리스트 `스펙 편집` 클릭 | Dialog 가 열리는가 | 핸들러 prop **전달**만 검사. 핸들러가 빈 함수여도 GREEN |
| **S3** | 담김 상태 → `해제` 클릭 | 견적함·비교함 **동시** 소멸 + 주 CTA 가 `견적 담기` 로 복귀 | 호출 여부만 검사. 순서·재읽기 타이밍은 모름 |
| **S4** | 규제 포털 `더보기` 토글 | 나머지 4개가 펼쳐지는가 · 상시 2개가 `mfds`·`kchem` 인가 | 화이트리스트 **상수 존재**만 검사. 실제 필터 결과는 모름 |
| **S5** | 완성도 **100% 제품** 진입 | 카드가 숨는가 (`pct >= 100` 조기 return) | 조건문 존재만 검사 |
| **S6** | **모바일 폭**(375px) 상세 | 2열 그리드·CTA·접힘 행이 깨지지 않는가 | 반응형은 정적 검사 불가 |

**S1 이 최우선.** D7 은 이 트랙에서 유일하게 **정보 은폐(안전 관련)** 로 이어지는 항목이고,
계약⑧은 배선만 볼 뿐 판정 방향(`!== "unknown"`)이 뒤집혔는지는 못 잡는다. 미분류 제품 1건을
직접 열어 위험도 행을 **눈으로** 확인할 것.

**스모크 후 문서:**
- 계약 파일 헤더의 `본 파일은 Phase 1 = RED` 문구 → 현재 상태로 갱신
- SPEC 에 §product-detail-refinement 항목 추가(D1~D8 결정 + 계약 ①~⑨)
- `completeness.ts` 리워딩 주석 원복

### Phase 4 (원안): 우측 패널 CTA 재배치 + 해제 wiring (핸드오프 §2)

> ➕ **재발주 배너 표시부 포함** (§7.7-1) — reorder 레코드 **파생 조회, 쓰기 0**.
> `[재발주안에 합류]` 버튼은 **미생성**(별도 카드).
> ⛔ **EXIT 게이트: COMP 적합성 대조 (§7.6).** 이 Phase 의 산출 화면을 COMP fixture 와 문자열/값 대조한다. **불일치 1건 = RED.** 눈으로 확인하지 않는다.

**Goal:** 담김 상태 기준 CTA 위계 확정, 해제를 실 mutation 에 연결.
- Status: [ ] Pending

**🔴 RED:** 계약④ + 담기→해제→재담기 상태 전이 테스트
**🟢 GREEN:**
**§0-B 수직 순서 엄수:** 가격 → divider → 담김 칩 → 주 CTA → 무료 문구 → 보조 2분할

1. **가격 영역 선두 배치** — `공급가 (VAT 별도)`(`#94a3b8 11px 700`) / `견적 후 확정`(`#0f172a 15px 800`) / 1줄 설명(`#64748b 11.5px`, 납기·최소 주문 포함). 3행 반복 테이블 제거
2. divider `1px #eef2f7`
3. 담긴 상태: 배지 2개 → **칩 한 줄 `✓ 견적함·비교함에 담김 [해제]`** (`bg #f0fdf4` · `border #dcfce7` · `text #15803d` · 해제 `#64748b 700`)
4. `[해제]` → `removeFromQuoteCart()` + `compare-store.removeProduct()` 실행 후 상태 반영 (**낙관적 갱신 금지 — 결과로만**)
5. 담김 시 주 CTA = **`견적 요청서 만들기 →`** `bg #16a34a` · `h40` · `r10` · `13px 700` → `/dashboard/quotes`
6. 미담김 시 주 CTA = 기존 파란 `견적함에 담기` 유지 (**시안 없음 — md §2 문구 근거**)
7. 무료 문구 `#94a3b8 11px center`
8. 보조 = `비교 검토` · `재고 조회` **2분할** `h32` · `border #e2e8f0` · `#334155 11.5px` (별도 stock-mini 카드 흡수 → 중복 제거)
9. 다크 `맞춤 견적 문의` 카드 삭제 → **푸터 텍스트 링크**(→`/support`) — **시안 부재, 최소 구현 후 확인 요청**

**🔵 REFACTOR:** CTA 분기를 단일 `primaryCta` 파생값으로 정리

**✋ Quality Gate:**
- [ ] 계약④ GREEN · 상태 전이 3케이스 GREEN
- [ ] **front-only success 0** — 해제 실패 시 상태 미변경 + destructive toast
- [ ] `grid-cols-2` 반쪽 빈칸 해소 확인
- [ ] 하단 트레이 카운트와 **즉시 동기화**(`quote-cart-changed`)
- [ ] loading / error / disabled 상태 존재
- [ ] 목적지 `/dashboard/quotes` 가 트레이와 **동일**함 확인

**Rollback:** `page.tsx` 우측 레일 hunk revert. Phase 2 의 `removeFromQuoteCart` 는 미호출 상태로 잔존(무해)

---

### Phase 5: Smoke / Rollback / 문서 정리
> ⛔ **EXIT 게이트: COMP 적합성 대조 (§7.6).** 이 Phase 의 산출 화면을 COMP fixture 와 문자열/값 대조한다. **불일치 1건 = RED.** 눈으로 확인하지 않는다.

**Goal:** QA 7항 런타임 확인 + 회수 경로 확정.
- Status: [ ] Pending

**🔴 RED:** rollout 실패 모드 정의 — ① 해제 후 트레이 미갱신 ② buyer 에게 편집 액션 노출 ③ 추천 영구 접힘 ④ 규제 링크 `더보기` 미확장
**🟢 GREEN:**
- 런타임 스모크(Claude in Chrome, `www.labaxis.co.kr`): 미등록 제품 1건 + 완전 제품 1건 × buyer 세션
- QA 7항 전수 체크
- `PLAN_product-detail-sian-flat` 과의 시각 토큰 충돌 잔여 기록

**🔵 REFACTOR:** 임시 계측 제거, Notes 확정

**✋ Quality Gate:**
- [ ] QA 7항 전부 PASS
- [ ] sentinel 전체 baseline-delta **0** (교체 3종 제외, 교체분은 승인 주석 대조)
- [ ] `npm run build` GREEN (**operator 실행**)
- [ ] rollback 경로 문서화 완료

**Rollback:** phase 별 hunk revert. 전면 회수 시 `page.tsx` + `product-completeness.tsx` + `quote-cart-storage.ts` 3파일 revert → PD-B/C/L sentinel 복원

---

### Phase 6: COMP 재대조 (신설)

Phase 3·4·5 를 개별 통과해도 **합류 후 화면이 COMP 와 같다는 보장은 없다.**
전 화면을 fixture 전량과 재대조한다. **불일치 1건 = RED, 롤백.**

---

## 7.6 COMP 적합성 게이트 (conformance gate)

### 원칙 — 눈으로 확인하지 않는다

> 이 저장소에서 도출기가 열 번 틀린 이유가 전부 **"읽어서 확인"** 이었다
> (팬텀 파라미터 · 200 위장 · 델타 +1 · tsc 27→21 · 동명이인 정의부).
> COMP 대조도 같은 함정에 있다 — **시안을 보고 "맞는 것 같다" 는 판정이 아니다.**

### 방식

```
COMP 파일의 레이블·토큰을 fixture 로 **고정** → 렌더 결과와 문자열/값 대조
불일치 1건 = RED
```

- 추출 실적: 22MB dc-bundle 중 **실마크업 59KB** (나머지는 폰트·런타임 블롭)
- fixture 산출물: `src/__tests__/fixtures/product-detail-comp.json` — **Phase 0 회신 후 생성**

### 선행 조건 — 게이트 자신의 자기검증 (첫 실행 전)

| | 내용 |
|---|---|
| corrupt→RED | fixture 레이블 **하나를 바꿔** 게이트가 실제로 떨어지는지 실증 |
| 오탐 0 | 정상 렌더에서 통과하는지 병치 실증 |

🛑 **corrupt→RED 단독으로 게이트를 채택하지 않는다** — 탐지를 증명할 뿐 정밀도를 증명하지 않는다.
🛑 게이트 출력이 **줄어드는 것도 RED** 다(검사 중단일 수 있다). 불일치 **건수가 아니라 항목 분포**를 대조한다.

### 적용 지점

Phase 3 EXIT · Phase 4 EXIT · Phase 5 EXIT · **Phase 6 전량 재대조**

---

## 7.7 시안 ↔ 핸드오프 대조 — **호영님 회신 반영 (2026-08-15)**

### 🔴 1. 재발주 합류 배너 — **분리 확정**

```
재고관리에서 재발주 검토 중인 품목입니다 · 권장 9개   ← 파생 읽기. 쓰기 0   → Phase 4 포함
[재발주안에 합류]                                    ← 쓰기. 역방향 경로   → 미생성·별도 카드
```

**근거는 불변식이다.** 역방향 합류는 `제품상세 → 재발주안` **쓰기**인데,
진입 시 판정할 상태가 **어디에도 설계돼 있지 않다**:

- 그 품목이 **이미 다른 재발주안에 있으면?**
- 이미 **`견적 진행 중`** 이면?
- 권장 수량이 **재고관리 산출과 다르면** 무엇이 이기나?

핸드오프에도 시안 주석에도 없다.

> 🛑 이 상태로 Phase 2 트랜잭션에 넣으면 **설계되지 않은 불변식을 트랜잭션 안에 봉인**한다.
> 이 트랙이 계속 피해온 형태다(팬텀 파라미터 · 200 위장 · `$transaction` 안 전역 `db`).

⛔ **버튼은 미생성.** `disabled` 아님 — D3 상시 제약(dead button 0)과 정합.

### ✅ Phase 2 범위 확정 — **단방향만**

```
재발주 → 소싱 → RFQ    ← Phase 2 트랜잭션 범위
제품상세 → 재발주안     ← 범위 밖. 불변식 설계 후 별도 카드
```

배너 **표시부**는 reorder 레코드 **파생 조회**로 충분하고 **Phase 4 에서 닫힌다**(쓰기 0).

### 2 · 5 — 회신 없이 진행. fixture 는 시안 실측값

| # | 항목 | 처리 |
|---|---|---|
| 2 | buyer 편집 링크 제거 (시안 주석 ④) | 상시 제약과 일치 — 그대로 |
| 5 | 검색 결과 `4건 · 품명 시작 일치` 라벨 | 핸드오프 누락 — **fixture 에 시안 실측값** |

### 📌 3 · 4 — **불일치가 아니라 핸드오프 §5 문서 결손** (정정)

| # | 항목 | 플랜 본문 | 핸드오프 §5 |
|---|---|---|---|
| ~~3~~ | amber `#b45309` | **§0-B 확정 + 대비 4.84 AA 실측** | 토큰 목록 부재 |
| ~~4~~ | radius | **컴포넌트별 실값 확정** (10 · 11 · 9 · 5 …) | `"카드 14–16"` 만 |

→ **둘 다 COMP §7 대조 대상에서 제외한다.** 시안이 플랜과 어긋난 게 아니라
  **핸드오프 §5 가 플랜·시안 양쪽 어느 쪽과도 안 맞는다**(`14–16` 은 실값과 불일치).
  핸드오프 v2 §5 갱신 항목으로만 남긴다.

⚠️ 4번 성격 확인은 **플랜 본문 실측**으로 했다(L176·189·190·197·206·207).

## 7.8 토큰 정본 — **플랜 §0-B 확정** (호영님 2026-08-15)

```
정본   PLAN §0-B        ← 대비 실측 보유 (#b45309 = 4.84 AA)
파생   핸드오프 §5       ← v2 갱신 시 **정본에서 재생성**. 강등
참조   fixture colors    ← 시안 실측. 정본과 불일치 시 **회신 대상**이지 자동 승패 아님
```

정본이 안 정해져 있어서 같은 대조가 재발했다.

> 이 트랙의 **귀속 규칙과 같은 축**이다 —
> 드리프트를 **소비자가 아니라 정의부**에 귀속하는 것과,
> 토큰을 **파생 문서가 아니라 정본**에 귀속하는 것이 같은 형태다.

⚠️ fixture 가 정본과 어긋나도 **fixture 가 자동으로 지지 않는다** — 회신으로 판정한다.
  (시안이 정본보다 새로울 수 있다. 자동 승패는 §placeholder-success 형태를 만든다.)

## 7.9 합류 버튼 불변식 — **별도 카드 등재 · 여는 시점 확정**

`§reorder-join-invariant` (신설 예정) — 등재만. **지금 열지 않는다.**

**미설계 불변식 1건** — "이미 다른 재발주안에 있음".

나머지 2개(양방향 동기화 · 권장 수량)와 배너 문구는
핸드오프 md §3 **line 37 · 38 · 40** 에 확정돼 있다(2026-08-09, 시안과 같은 날).

> 🛑 **3/4 설계됨을 근거로 미생성 결정을 뒤집지 말 것.**
> `line 40` 은 **방어 대상**("이중 생성 방지")을 정의했을 뿐 **방어 판정 기준**이 없다.
> 무엇을 막을지는 적혀 있는데 **무엇이 중복인지**가 없다 —
> 이 상태로 쓰기를 열면 **방어 문구가 있어서 안전해 보이는 경로**가 된다.

📌 근거 갱신 이력: "불변식 3개 미설계"(구) → **"1개 미설계, 그 1개가 이중 생성 판정 기준"**(현).
  같은 폴더 지시문을 안 읽어 생긴 오판이고, §7 의 "헤더 미독" 과 **동형 재발**이다.

> ⏳ **여는 시점 = Phase 5 완료 후.**
> 단방향이 **실제로 도는 걸 본 다음에** 역방향 불변식을 설계하는 것이 순서다.

## 7.10 fixture — 🔴 **본문 전송 3회 유실**

`product-detail-comp.json` (8.3KB) 전문이 **세 번 모두 도착하지 않았다**
(첨부 2회 · 본문 1회). repo·scratchpad 부재 확인.

### 수령 시 사양 (회신 기재분 · 정정 반영)

```
구조  sections.{1a,1b,1c} → labels[] · label_count · colors{} · radius[]
                            · font_sizes[] · annotation_excluded[]
레이블 총 112 — 1a 51 · 1b 24 · 1c 37
annotation_excluded 11 — 1a 5 · 1b 3 · 1c 3
```

⚠️ 회신 ① 은 **본문 내에서 자기 정정**됐다("11이 아니라 12" → "앞 메시지의 11이 맞다").
  **11 로 기록한다.** 1a 의 `annotation_excluded` 에 `"1b"` 가 2회 있으나
  주석 안 **앵커 링크 텍스트**이고 대조 대상이 아니다(개수 계산 시 참고).

🟡 **확인 후 확정 (실측 아님 · 분류 판단) 2건:**
1. 각 섹션 `labels[0]` = 시안 자체 라벨 → 대조 대상 **111**
2. `#86efac` = 주석 박스 **점선 보더**, UI 토큰 아님 → 토큰 대조에서 제외
   (`colors` 는 섹션별 주석 블록 **이전까지만** 집계됨)

🛑 **자기검증 앵커는 `total_label_count = 112` 로 고정.**
  대조 대상 111 과 **분리 기록**한다 — 앵커를 111 로 낮추면
  로딩 실패가 "불일치 0" 으로 위장하는 방어(§7.6 "출력 감소도 RED")가 무너진다.

### 전송 방식 제안 (3회 유실 후)

8.3KB 전량이 세 번 유실됐다. **섹션 단위 분할 전송**을 권한다 —
`1a` 만 먼저 보내 도착을 확인하고, 그 다음 `1b` · `1c`.
도착 확인은 `label_count` 로 한다(1a=51 · 1b=24 · 1c=37).

## 7.11 계획 문서 정본 — **이 파일** (2026-08-15)

```
정본  PLAN_product-detail-sourcing-refinement.md   ← 이 파일. 784줄+ · Phase 2 완료 · 게이트 배선
폐기  PLAN_sourcing-quote-cart-flow.md              ← 호영님 초안. 흡수분 외 무효
```

초안은 이 파일을 못 본 채 작성됐다. **레포에는 존재하지 않는다**(호영님 환경 전용) —
정리는 파일 삭제가 아니라 **정본 명시**로 한다.

> 토큰 정본을 §0-B 로 내린 것과 **같은 조치**다(§7.8).
> 두 문서가 남으면 다음 세션이 어느 쪽을 읽을지가 **우연에 맡겨진다**.

⚠️ **Phase 번호는 초안과 대응하지 않는다.** 초안 Phase 2(트랜잭션) ≠ 정본 Phase 2.
  **정본 번호만 쓴다.**

흡수 완료분: COMP 게이트(§7.6) · 불일치 5건(§7.7) · 토큰 정본(§7.8) ·
합류 불변식 카드(§7.9) · fixture(§7.10). 그 외 초안 내용은 무효.

## 7.12 Phase 3 착수 조건 — **실측 회신**

> 질문: **Phase 3 이 신설하는 쓰기 경로가 있는가.**

### 답: **없다. 순수 UI 재구성이다.**

실측 근거:

| 확인 | 결과 |
|---|---|
| Phase 3 블록 내 쓰기 동사(`POST`·`PATCH`·`mutation`·`create`·`update`) | **0** |
| 액션 대상 라우트 실재 | `/support` ✅ · `SdsDocumentsSection` ✅ (2파일에서 소비) |

GREEN 1~8 은 전부 **표시 재배치 + 기존 핸들러 연결**이다:
접힘 행 통합 · 배너 삭제 · 배지 추가 · 컴포넌트 이동 · 자동펼침.
`정보 요청` → 기존 `/support`, `SDS 업로드` → 기존 섹션.

→ **트랜잭션 편입 대상 0.** §audit-integrity 커밋 2 대기와 **간섭 없음**.
  병렬 제약은 이 한 줄로 닫힌다.

⚠️ 단 Phase 4 배너 표시부도 **파생 읽기(쓰기 0)** 로 확정돼 있다(§7.7).
  쓰기가 처음 등장하는 지점은 **§reorder-join-invariant**(Phase 5 완료 후)다.

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (적용)
**Resolver Input:** route `/products/:id` · selection(단일 product) · stage(sourcing) · blockers(미등록 필드 N · 담김 여부)
**Expected Output:** nextAction = 담김 시 `견적 요청서 만들기`, 미담김 시 `견적함에 담기`, 미등록 다수 시 `정보 요청` 병기

**Surface Rules:**
- workflow route 이므로 **strong contextual action 허용** (주 CTA 1개)
- same-canvas 인라인 확장만. chatbot/terminal 0
- 대체품 승격 = "정보 미등록 품목일수록 대체 탐색이 먼저" 라는 ontology 우선순위 반영

**Validation:**
- [ ] 상단 체크리스트가 최상위 blocker 를 정확히 표기
- [ ] 주 CTA 가 담김 상태에 따라 정확히 분기
- [ ] 접힘 행 CTA 가 해당 blocker 해소 동선으로 이동
- [ ] 대체품 카드 배지가 실 데이터 파생(가짜 배지 0)

---

## 9. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 체크리스트 6항목 액션 중 buyer 권한 밖 3항목이 dead button 화 | Low | **High** | **D6 해소** — buyer 는 `정보 요청` 으로 수렴. Phase 1 계약②(역할 매트릭스)가 buyer 에 편집 라벨 노출 시 FAIL 로 봉합 |
| `removeFromQuoteCart` 부재로 해제 CTA 가 front-only 로 구현될 위험 | **High** | **High** | Phase 2(로직)를 Phase 4(UI)보다 **먼저** 완료. 계약① 실패 시 Phase 4 진입 금지 |
| PD-B/C/L sentinel 3종 교체가 승인 없이 진행 | Low | High | **D2 승인 완료(2026-07-25)**. 각 대체 = 별도 커밋 + 결정 기록표 인용. Phase 3 gate 항목 |
| ~~프로토타입 미확보~~ | — | — | **D4 해소 — 토큰 전수 확보(§0-B).** 잔여 추정치는 미담김 상태·푸터 링크 2건뿐 |
| **D5** amber hex 채택이 후속 트랙에 "Tailwind amber 클래스도 허용"으로 오독 | Med | Med | 계약⑦ 이 **클래스 0개**를 명시 검사. 커밋 주석에 "hex 예외 = CEO 2026-06-21 승계, 클래스 금지 불변" 명기 |
| 진행 바 fill 이 track 대비 2.86 으로 경계 흐림(저시력) | Med | Low | §0-C 잔여 1건 — Phase 3 에서 색 변경 없이 미세 경계(inset ring) 추가 검토 |
| **D6** buyer 3항목이 모두 `/support` 로 수렴 → 같은 목적지 3중복 | Low | Low | 문구로 구분(`정보 요청`). 필요 시 쿼리 파라미터로 요청 항목 프리필 |
| `PLAN_product-detail-sian-flat` 와 동시 편집 → merge 충돌 | Low | Med | **D1 해소 — 직렬 확정(본 트랙 선행).** sian-flat 은 본 트랙 종료·push 후 P1 재작성부터 진입 |
| sian-flat 이 본 트랙 종료 후 **낡은 대상 목록**으로 재개 → 삭제된 요소 restyle 시도 | **High** | Med | 본 트랙 Phase 5 에서 sian-flat P3/P4 의 무효 항목 3건을 문서에 명시 기록(Notes) |
| 추천 "분석 중" 자동 펼침이 응답 없을 때 영구 접힘 | Med | Med | timeout·error 분기를 Phase 3 gate 에 명시 |
| 규제 포털 상시 2 고정이 카테고리별 조건부 링크를 가림 | Low | Med | id 화이트리스트 고정 + `더보기`에 전량 포함 |

---

## 10. Rollback Strategy

- **Phase 1 실패:** 테스트 파일 revert. 프로덕션 무접촉
- **Phase 2 실패:** `quote-cart-storage.ts` · `completeness.ts` revert. UI 무접촉이라 사용자 영향 0
- **Phase 3 실패:** `page.tsx` 본문 hunk + `product-completeness.tsx` revert → PD-B/C/L sentinel 복원
- **Phase 4 실패:** 우측 레일 hunk revert. `removeFromQuoteCart` 는 미호출 잔존(무해)
- **Phase 5 실패:** 3파일 전면 revert → `9fe0eb2b` 동등

**Special Cases:**
- DB migration **없음** · billing **무접촉** · webhook **무접촉**
- localStorage 스키마 **불변** → 구버전 클라이언트와 상호 호환

---

## 11. Progress Tracking

- Overall completion: **90%** (3b 완료 `ab0e4e2d` · **48/48 GREEN** · F10 EXIT 0)
- Current phase: **Phase 4 — 런타임 스모크 · 계약 위생 · 문서**
- Current blocker: **없음**
- Next validation step: 런타임 스모크 6종(정적 게이트가 못 보는 영역)

⚠️ **증거 등급 주의:** 48/48 은 **전부 소스 문자열 매칭**이다. "문구가 파일에 있다" 를 증명할 뿐
**렌더·클릭·상태 전이는 하나도 증명하지 않는다.** Phase 4 스모크 전까지 "동작한다" 고 말하지 말 것.

**🔴 계약 파일 구조 결함 — 4회 반복 후 근본 수정(2026-07-25):**

`not.toMatch(/문구/)` 를 **소스 전체**에 걸면 그 문구를 언급한 **주석까지 매칭**된다.
구현자는 코드가 아니라 **설명 주석을 지워서** 통과시키게 된다 = 계약이 문서를 갉아먹는다.

| # | 사례 | 결과 |
| :-- | :--- | :--- |
| 1 | `더보기` (Phase 1) | false-GREEN — 무관 블록 매칭 |
| 2 | `#fbf0db` (3a) | 주석의 hex 리터럴 삭제 |
| 3 | `위험도` (3a) | **설명 주석 4곳 리워딩** |
| 4 | `비교에 포함됨`·`견적함에 포함됨` (3b) | 주석 리워딩 |

→ `stripComments()` 도입, **부정 단언 16곳 전부 `*_CODE`(주석 제거본)로 전환.**
이제 주석에 "무엇을 왜 지웠는지" 를 계약 문구 그대로 적어도 안전하다.
**리워딩했던 주석 4곳(`completeness.ts`)·hex 주석은 원복 권장** — 설명이 정확한 쪽이 낫다.

**🔴 3a 에서 드러난 내 계약 결함 2건 (수정 완료):**

1. **D7 3번째 단언이 코드를 왜곡시켰다.** `not.toMatch(/COMPLETENESS_FIELDS[\s\S]{0,400}?위험도/)` 는
   "위험도가 완성도 *필드*가 아님" 을 검사하려던 것인데, 실제로는 **주석 산문의 `위험도` 단어**에 매칭됐다.
   구현자는 설명 주석 4곳을 리워딩해 회피했다 — **계약이 문서 품질을 떨어뜨린 것.**
   → 배열 리터럴 내부만 스코프하는 구조 검사로 교체(`key:` 8개 + hazard 계열 부재). **주석은 원복해도 된다.**
2. **`<ProductCompleteness product={product}` 가 서식에 결합돼 있었다.** prop 이 늘어 여러 줄이 되자 회귀로
   오탐. → `[\s\S]{0,300}?` 로 완화.

**교훈:** 문자열 근접도(`{0,400}?`) 단언은 **코드와 주석을 구분하지 못한다.** 구조를 검사할 수 있으면
(배열 리터럴 스코프, 엔트리 개수) 근접도 대신 구조를 쓸 것. 근접도는 "이 두 식별자가 같은 블록에 있다"
수준에만 쓴다.

**🔴 COMP 재작성 검증 중 발견 — 무성 실패 경로 2건 (계약⑧ 으로 봉합):**

1. **`classified` 가 optional prop.** `undefined` 면 위험도 행이 안 뜬다. PAGE 가 전달을
   빠뜨리면 **D7 이 조용히 무효화**되고 COMP 단위 테스트는 전건 통과한다. 계약⑤가 위험도 칩을
   지우므로 결과는 미분류 상태 완전 소멸 — D7 이 막으려던 바로 그 시나리오가 prop 누락으로 재현된다.
2. **ADMIN 한정 dead button.** privileged 의 `spec_edit`/`safety_edit` 는 `href` 가 없다.
   `useLink = !!href && !(canEdit && handler)` 이므로 PAGE 가 `onSpecEdit` 를 안 넘기면
   `handler === undefined` → `useLink = false` → **`<button onClick={undefined}>`**.
   buyer 경로 테스트로는 절대 안 잡힌다(buyer 는 항상 href 있는 링크로 감).

→ **계약⑧ 8단언 추가**(계획 측 저작 — 구현자 self-grading 회피). PAGE 의 `classified`·`role`·
편집 핸들러 3종 전달을 잠그고, COMP 에 **핸들러 부재 시 링크 폴백**을 요구한다.

**Phase 3 선결 2건(코드 손대기 전):**
1. `ACTION_BY_FIELD` 에 `catalogNumber`·`grade`·`manufacturer` 추가(privileged = `spec_edit`).
   폴백은 **privileged 에 대해 `info_request` 반환 금지** — 매핑 누락을 조용히 삼키지 않도록 교정.
2. 위험도 행 파생 추가 — `classified === false` 일 때만. **`COMPLETENESS_FIELDS` 무접촉**(분모 8 보존).

**Phase 3 착수 순서:**
1. [x] `CollapsedRow` 공용 컴포넌트 신설(계약③) — `596e7ebf`
2. [x] `product-completeness.tsx` 재작성(계약②-UI 5/5 + ⑦-COMP) — `3a7f6e01`
3. [ ] `page.tsx` — **3a / 3b 로 분할**(아래)

**Phase 3 본작업 3 분할 (2026-07-25 결정):** `page.tsx` 4개 대형 리전을 한 커밋에 넣으면
④(8단언)가 실패했을 때 ③⑤⑥까지 revert 해야 한다. 게이트를 2회로 쪼개 revert 단위를 좁힌다.

| 단계 | 범위 | 계약 | 성격 |
| :--- | :--- | :--- | :--- |
| **3a** | COMP 배선 + 접힘 행 + 중복 제거 + 규제 포털 | **⑧ · ③ · ⑤ · ⑥ · ⑦-PAGE** | 치환·삭제 중심(기계적) |
| **3b** | 우측 패널 CTA 위계 + 대체품 승격 | **④**(8) | 설계 판단 필요(구조 재배치) |

⚠️ **3a 를 먼저.** 계약⑧(D7 배선)이 여기 있고, 이게 안 되면 ⑤(위험도 칩 삭제)가 곧바로 정보 소멸이 된다.
**⑤와 ⑧은 반드시 같은 커밋**에 — 칩을 지우는 변경과 대체 표시를 켜는 변경이 갈라지면 그 사이 커밋이
미분류 은폐 상태가 된다. → **[x] 3a 완료 `9e1a07a0`** (⑤·⑧ 동일 커밋 준수 확인).

**🔴 3b 선결 — 계약④에 없는 위험 2건(계약이 못 잡는다):**

1. **`해제` 가 견적함만 지우면 칩이 거짓말을 한다.** 칩 문구는 `견적함·비교함에 담김` 인데
   `removeFromQuoteCart` 는 견적함만 건드린다. 비교함이 남으면 **칩은 사라지는데 비교함엔 그대로**
   = 상태 표시와 실제 불일치. → `해제` 는 **견적함·비교함 양쪽**을 정리하거나, 칩·해제를 **소스별로 분리**해야 한다.
   전자 권장(프로토타입이 한 줄 한 개 해제).
2. **해제 후 패널이 되돌아가야 한다.** `inQuoteCart` 가 재평가되지 않으면 해제해도 주 CTA 가
   `견적 요청서 만들기` 로 남는다 = front-only 의 거울상(실제로는 지웠는데 UI 가 담김 상태 유지).
   `quote-cart-changed` 리스너로 재읽기 확인할 것.

**해소된 blocker 전량:** D1 트랙 순서 · D2 PD-B/C/L 교체 승인 · D3→D6 buyer 액션 분기 · D4 프로토타입 · D5 색 토큰

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete (2026-07-25 · 26 RED / 회귀 0 6 PASS · false-GREEN 1건 봉합)
- [x] Phase 2 complete (2026-07-25 · `8d1e443f` · 계약① 4/4 + ②-lib · D7·D8 신설)
- [x] Phase 3 complete (2026-07-25 · `596e7ebf`→`ab0e4e2d` · **계약 ①~⑨ 48/48 GREEN** · F10 EXIT 0)
  - 3-1 `CollapsedRow` 신설 · 3-2 `product-completeness.tsx` 재작성 · 3a `page.tsx` 배선·치환 · 3b CTA 위계
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Phase 5 complete

---

## 12. Notes & Learnings

**트랙 종료 시 잔여 리스크 (2026-07-25 · 코드 결함 아님 — 후속 트랙 입력):**

1. **[High · 제품] 314/314 전 제품이 미분류.** S1 스모크 중 실측. `hazardCodes`·`pictograms`·`casNo`
   전무 → `level: "unknown"`. **D7 위험도 행이 모든 제품에 뜬다.** 의도는 "미분류를 숨기지 않는다" 였는데,
   100% 가 미분류면 그 행은 **변별력 0** 이고 체크리스트 항목 수를 전 제품에서 +1 한다.
   → 본 트랙 코드는 정상. **CAS 위험도 분류 파이프라인이 산출물을 하나도 못 내고 있다**는 뜻이므로
   `§cas-hazard-classification` 쪽 별도 트랙에서 다룰 것. 분류가 채워지면 이 행은 자동으로 희소해진다.

2. **[Med] S2(ADMIN 편집 Dialog) 미검증.** admin 계정·데이터 부재로 정적 승계. **계약⑧이 구조적으로
   못 보는 영역** — 핸들러 prop 전달만 검사하므로 `onSpecEdit={() => {}}` 여도 GREEN 이다.
   → ADMIN 계정 확보 시 1분 스모크로 종결할 것. 그 전까지 "ADMIN 편집 경로 검증됨" 이라고 말하지 말 것.

3. **[Low] S5(100% 제품 카드 숨김) 미검증.** 완성도 100% 제품이 시드에 없음. 조건문은 PD-B 시절부터
   무변경이므로 회귀 가능성은 낮다.

**Blockers Encountered:**
- [2026-07-25] **Phase 2 지시 자기모순.** 내가 쓴 계약②가 COMP 소스를 grep 하는데 Phase 2 지시는 "lib 2파일만".
  **계약을 쓴 사람이 그 파일 의존성을 Phase 분할에 반영하지 않았다.** → 계약을 작성할 때마다 **각 단언이 어느
  파일을 읽는지 표를 만들고 Phase 에 매핑**할 것. 파일 단위로 Phase 를 자르면 한 파일에 걸친 계약(②-UI + ⑦)은
  반드시 같은 Phase 여야 한다.
- [2026-07-25] **§0-B 매트릭스가 데이터 모델과 불일치(D7).** 프로토타입 6항목을 그대로 옮겨 적었을 뿐,
  `COMPLETENESS_FIELDS` 8필드와 대조하지 않았다. 결과: 위험도 분류(필드 없음) 포함 + 카탈로그/등급/제조사
  누락. **교훈: 디자인 산출물의 항목 목록은 반드시 canonical 필드 정의와 1:1 대조 후 계획서에 옮길 것.**
- [2026-07-25] **Phase 1 gate — false-GREEN 1건.** 계약⑥ 이 구현 없이 통과. 원인은 단언이 너무 느슨해
  **다른 블록의 동일 문자열**(`더보기` = 컴플라이언스 링크 섹션 L862 / `국내 규제기관 포털` = 기존 제목 L874)에
  매칭된 것. **교훈: 문자열 단언은 그 문자열이 파일 내 유일한지 먼저 확인할 것.** 특히 `더보기`·`접기`·`더 보기`
  같은 범용 UI 문구는 반드시 전용 식별자(state 변수명·상수명)로 앵커링.
- [2026-07-25] 핸드오프 §3(헤더 카운터 중복) → `§sourcing-counter-timing` 이 당일 이미 종결(`ccae0a44`). **스코프에서 제거.**
- [2026-07-25] `lib/quote/quote-cart-storage.ts` 에 단일 품목 제거 함수 부재 확인 → 핸드오프 §2 `[해제]` 는 **신규 mutation 필요**. 최대 리스크로 승격, Phase 2 로 선행 배치.
- [2026-07-25] `canEditSpec = ADMIN || SUPPLIER` 확인 → 핸드오프 체크리스트 액션 4종 중 2종이 buyer 에게 **구조적으로 불가**. → **D3 해소**(버튼 미생성).
- [2026-07-25] `PLAN_product-detail-sian-flat` 5주 정지 + 정면 충돌 3건 확인 → **D1 해소**(본 트랙 선행 직렬).

- [2026-07-25] 프로토타입 수령·해제(§0-B). **자체 오판 2건 정정:** ① 핸드오프 색 = yellow 라 판정했으나 실제 **amber hex** (→D5 신설) ② buyer 권한 밖 액션 2종이라 판정했으나 실제 **3항목**.
- [2026-07-25] 규제 포털이 별도 섹션이 아니라 **접힘 행 3번째**로 통합됨 확인 → `<CollapsedRow>` 3회 사용 확정(추출이 선택 아닌 요구).
- [2026-07-25] 시안 `미등록 6개` + `25%` = 8필드 중 2개 등록 → **현행 분모 8 과 정합**. canonical 계산 무접촉 재확인.
- [2026-07-25] 시안 `제품 사양` green `4개 확인` 배지 = sian-flat P3 요구와 동일 → **본 트랙에서 처리**(sian-flat P3 부담 경감).
- [2026-07-25] **D5 최종 — amber hex 채택**(§0-C). 이 항목에서 **내가 두 번 오판**했다: (i) 핸드오프 색을 yellow 로 읽음 → 실제 amber, (ii) amber hex 를 §9 위반으로 판정 → 실제는 **CEO 2026-06-21 §11.302 예외 승인**이 이미 존재하며 §9 금지 대상은 Tailwind 클래스 한정. sentinel 3개(`pd-b`·`pd-c`·`scan-hub-color`)가 같은 문구로 이 예외를 잠그고 있었다. **교훈: 정책 위반을 주장하기 전에 sentinel 주석의 예외 승인 이력을 먼저 읽을 것.**
  - 부산물: 대비 전수 검증 완료(텍스트 4.75~8.75 전부 AA 통과). **진행 바 fill 이 track 대비 2.86** 인 잔여 1건만 Phase 3 로 이월(색 변경 아닌 경계 보강).
  - yellow 환산안(구 §0-C)은 폐기. `#ca8a04`(yellow-600)가 yellow-50 대비 2.84 라 AA 미달이었다는 계산은 기록으로만 남김.
- [2026-07-25] **D6 확정 — D3 부분 철회.** buyer 권한 밖 3항목을 `정보 요청` 으로 수렴하여 6항목 전부 액션 보유. "버튼 미생성"은 이 3항목에 한해 미적용(나머지 원칙은 유지 — `disabled` 여전히 금지).

**sian-flat 재개 시 무효화되는 항목 (본 트랙 종료 후 반드시 대상 목록 재작성):**
- P3 `MSDS 없음 앰버 배너 유지` → **배너 자체가 삭제됨**
- P3 `reg-link 3열 카드 + reg-label/reg-note` → **텍스트 링크 2 + 더보기로 대체됨**
- P3 `미등록 dashed 1줄` → **6항목 체크리스트로 대체됨**
- P4 `stock-mini(→/dashboard/inventory)` → **보조 CTA 2분할로 흡수됨**
- P4 `영업 다크 카드 gradient 제거 restyle` → **카드 자체가 푸터 텍스트 링크로 강등됨**

**Implementation Notes:**
- 핸드오프 §1 의 "0건 섹션 접힌 한 줄"은 PD-L 의 "buyer 숨김"과 정반대지만 **원 취지(빈 카드 화면 지배 방지)는 동일** — 상위 해법으로 교체.
- 완성도 색 yellow 전환은 CLAUDE.md §9 신호등 정본과 정합. **`#b45821` muted amber 이전(2026-07-10 §P6 보류)과는 별건.**
- `PLAN_product-detail-sian-flat`(🔄 In Progress) 이 같은 파일을 대상으로 열려 있음 — **직렬 실행 권고.**
