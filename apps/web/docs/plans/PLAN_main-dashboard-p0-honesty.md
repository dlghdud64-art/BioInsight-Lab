# Implementation Plan: 메인 대시보드 P0 — 정직성 코어 (UI-only)

- **Status:** 🔄 In Progress
- **Started:** 2026-09-17
- **Last Updated:** 2026-09-20 (Smoke A·B·D·5 통과 · 사각지대 4건 기록 · P1 백로그 분리)
- **Estimated Completion:** 2026-09-18
- **Scope tag:** `§main-dashboard-p0-honesty`

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success

---

## 0. Truth Reconciliation

**Latest Truth Source**
- `메인 대시보드 핸드오프.md` (호영님, 2026-09-17) + 시각 truth `메인 대시보드 리디자인 (단독).html` (1a 초기 / 1b 운영)

**Secondary References**
- `§dashboard-shifan-adopt` P1/P2/P3a/P3b — ActionInbox · NextStepBanner · Pipeline · BudgetSpendCard 채택
- `§dashboard-shifan-polish` A1/A2/A5/B1/B4 — 아이콘 틴트 · 카테고리 도넛 카드 내부 통합 · 예산 CTA 단일화
- `§dashboard-home-redesign` P1/P3 — 빠른작업 제거 · Pipeline 퍼널 진행바(.pbar) 도입
- `§11.181` — 운영 브리핑 floating entry (FAB)
- 2026-09-10 배포본 스크린샷 (핸드오프 §0 현행 문제 6건의 출처)

**Conflicts Found (실측, 2026-09-17 · repo 워킹카피 `C:\Users\young\ai-biocompare`)**

| # | 충돌 | 선행 계약 | 핀한 sentinel (실측) |
| :--- | :--- | :--- | :--- |
| C1 | FAB 삭제 vs 존재 | §11.181 | `src/__tests__/api/admin/operational-brief-floating-entry.test.ts:135` · `src/__tests__/dashboard/operational-brief-fab-sweep-258sweep.test.ts:63` |
| C2 | 파이프라인 게이지 삭제 vs .pbar 유지 | §dashboard-home-redesign P3 | `src/__tests__/dashboard/dashboard-home-redesign-visual-p3.test.ts:22-25` (maxTotal 선언 · active 분기 · width 식 3줄) |
| C3 | 도넛 조건부 노출 vs 무조건 카드 내부 통합 | §dashboard-shifan-polish A5/B1 | `dashboard-budget-spend-shifan-p3b.test.ts` · `dashboard-shifan-final-p4.test.ts` · `regression/dashboard-card-height-align-313.test.ts` |

**Chosen Source of Truth**
- 핸드오프(2026-09-17)가 C1·C2·C3 전부를 **덮는다.** 근거: 같은 결정권자(호영님)의 최신 지시이며, §0에 현행 배포본 실측 문제를 명시하고 있다.
- CLAUDE.md 「시안은 조항 위에 있지 않다」 점검 결과 **조항 충돌 없음**: 신호등 팔레트(red/yellow/emerald) 유지, amber/orange 0, em dash 0(구분자는 가운뎃점). 충돌한 것은 조항이 아니라 **선행 시안 결정**이므로 최신 지시가 이긴다.
- 은퇴시키는 sentinel의 **살아있는 명제는 새 파일로 이관**한다(CLAUDE.md 「sentinel 은퇴 시 명제를 이력에서 복원」).

**미확인 종결 (2026-09-17 실측 · 측정 위치: Cowork Linux VM 셸에서 `node` 앵커 대조. ⚠️ 프로젝트 러너 아님)**
- [x] U1 **정정 확정: 5개 파일 · 테스트 16건이 선행 RED.** (Sandbox 최초 판정 "3건" 은 **틀렸다** — 아래 정정 사유 참조)
- [x] U2 **정정 확정: 파일 단위 판정 무효.** "내가 깬다" 로 분류한 4건 중 `popup-self-contained` · `fab-sweep-258sweep` 은 **기준선에서 이미 RED**다. 파일 단위로 보면 변화가 드러나지 않으므로 **판정 단위는 테스트 이름(it)** 으로 고정한다.
- [x] U3 **확정: 모바일은 이미 정직 처리됨.** `mobile-dashboard-view.tsx`는 미설정 시 `예산 미설정 · 지출만 기록 중` + 예산 설정 CTA(카드 소유, 데스크탑 B4와 상이 — 모바일 고유 결정이므로 무접촉). 잔존 `₩0` 1곳 = L92 `won(thisMonthSpend)`. `Pipeline`은 공유 컴포넌트라 T4가 자동 전파. **T6 범위 = L92 1곳으로 축소.**

### 🛑 Sandbox 판정 정정 (2026-09-17 → 09-18, operator-shell 실측이 뒤집음)

| 항목 | Sandbox 최초 판정 | operator-shell 실측 | 판정 |
| :--- | :--- | :--- | :--- |
| 선행 RED 규모 | 3건 | **5개 파일 · 테스트 16건** | 최초 판정 **오류** |
| 271 · 273e | "무영향" 으로 목록에서 제외 | **둘 다 기준선 RED** (271: 2건 · 273e: 2건) | 최초 판정 **누락** |
| popup-self · 258sweep | "내가 깬다"(HIT) | **이미 RED** | 분류 **오류** |

**원인:** sandbox의 `node` 정규식 대조는 **파일 단위 앵커 존재 여부**만 본다. vitest는 `it` 단위로 판정하므로, 한 파일 안에서 일부 `it`만 실패하는 경우를 세지 못한다. HIT 판정이 난 파일도 그 파일의 **다른** `it`은 실패하고 있었다.

**교훈 (CLAUDE.md 「grep 으로 답하지 않는다」· 「축 없는 수치는 수치가 아니다」의 같은 형태):**
- 앵커 존재 대조는 `"이 앵커가 소스에 있는가"` 에만 답한다. `"이 테스트가 통과하는가"` 에는 답하지 못한다.
- sandbox 대조값을 게이트 기준선으로 쓰지 않는다. **기준선은 operator-shell의 프로젝트 러너 실측만**이다.

**앵커 대조 결과 (참고용 · 기준선 아님) (HIT 4 / MISS 4, target `src/app/dashboard/page.tsx`)**

| 앵커 | 결과 | 의미 |
| :--- | :--- | :--- |
| `floating-entry:135` FAB 심볼 | HIT | 내가 깬다 |
| `multi-surface:71` import 경로 | HIT | 내가 깬다 |
| `popup-self:198` FAB 블록 | HIT | 내가 깬다 |
| `fab-sweep:56` `controls=` 인접 | HIT | 내가 깬다 |
| `fab-sweep:63` `hidden lg:block` 래퍼 | MISS | **선행 RED** |
| `257:33` §11.257 marker | MISS | **선행 RED** |
| `257:37` `Sparkles` import | MISS | **선행 RED** |
| `257:41` `운영 브리핑 보기`+`lg:hidden` | MISS | **선행 RED** |

**기준선 실측 (operator-shell · Windows 로컬 · 프로젝트 러너 `vitest.config.ts` 적용 · 2026-09-17 · HEAD `f8c0d632` · 워킹트리에 타 세션 미커밋 변경 존재: `migration-manifest.json` · `package-lock.json`)**

1. **red-ledger** (exit 0)
   - 래칫 **5개 중 GREEN 5 · 꺼진 래칫 0**
   - sentinel RED **164건** · 원장 등재 **170건** · **신규 0**
   - 원장에 있으나 현재 통과하는 **6건**: `push-preference-filter` 2건(커밋 `2e9c3e16` · `6ce0be09` §notify-sentinel-retire-2 영향 추정) · `preferences-inventory-receiving` 4건. **대시보드 트랙과 무관 → `--update` 미실행.** 원장 정리는 그 결과를 만든 트랙의 몫.

2. **대상 sentinel 13종** — 파일 5 RED / 8 GREEN · 테스트 **16 실패 / 141 통과 (157건)**

   | 파일 | 실패 |
   | :--- | :--- |
   | `operational-brief-popup-self-contained` | 1 |
   | `dashboard-fab-collision-fix-271` | 2 |
   | `mobile-brief-inline-257` | 6 |
   | `operational-brief-fab-bottom-273e` | 2 |
   | `operational-brief-fab-sweep-258sweep` | 5 |

   GREEN 8: `floating-entry` · `multi-surface` · `3-surface` · `272e` · `visual-p3` · `shifan-p3b` · `final-p4` · `313`
   실패 16건 전량 원장 등재 확인(테스트 이름 1:1 대조). **신규 RED 0.**

3. **빌드 기준선** — `NEXT_DIST_DIR=.next-dash` · `NEXT_TSCONFIG=tsconfig.next-dash.json`
   - **exit code 0** · Route 표 출력됨 · 실패 마커 4종(`Export encountered` · `Failed to compile` · `npm error` · `Type error`) 전부 0
   - 공용 `tsconfig.json` 무변경 확인

**🛑 판정 단위 고정 — 개수가 아니라 이름 집합**
Phase 1·2의 "신규 RED 0" 은 **위 16건의 테스트 이름 집합**과 대조해 판정한다. 총계 16만 보면 하나 고쳐지고 하나 깨져도 GREEN으로 읽힌다(CLAUDE.md 「개수는 명제가 아니다」). Phase 1 착수 시 operator-shell이 16개 이름을 파일로 고정한다.

**Environment Reality Check**
- [x] repo / branch context 확인 (`main` 직접 커밋 · 병렬 3세션 공유 워킹카피)
- [x] 세션 격리 env 확정: `NEXT_DIST_DIR=.next-dash` · `NEXT_TSCONFIG=tsconfig.next-dash.json`
- [x] 실행 가능 명령 확인 → **🛑 차단 B1 (이 셸 한정). operator-shell 실행으로 기준선 확보 완료**

**🛑 B1 — Cowork 셸에서 vitest·build·red-ledger 전부 실행 불가**
- 증상: `Error: Cannot find module @rollup/rollup-linux-x64-gnu` (`node_modules/rollup/dist/native.js:115`)
- 원인: 공유 `node_modules`가 호영님 **Windows 설치본**이라 optional dep이 win32 바이너리. 이 셸은 Linux VM이다.
- 영향: `npm test` · `npm run red-ledger`(vitest 경유) · `npm run build` 전부 **실행 불가**
- 🛑 처방 아님: `npm i` / `npm install` — CLAUDE.md 「sandbox는 공유 node_modules에 패키지 설치 금지」(2026-06-14 2차 사고). 절대 실행하지 않는다.
- 처방: **게이트 실행은 operator-shell(Windows · 클로드코드) 단독.** 이 셸은 소스 편집 + 앵커 대조(node 정규식)까지만 담당한다.
- 러너 기준 표기: 이 계획서의 모든 앵커 수치는 `node` 단독 대조값이며 **프로젝트 러너(`npm test`) 정본이 아니다.** Phase 1·2 GREEN 판정은 operator-shell 실측으로만 확정한다.

---

## 1. Priority Fit

**Current Priority Category**
- [ ] P1 immediate
- [x] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority**
- 핸드오프 §0-2가 release blocker 후보로 지목한 항목이 **실데이터 모순**으로 확인됐다: 같은 카드 안에서 상단은 이번 달(`summary.spend.thisMonth`), 하단 도넛은 최근 6개월(`PurchaseRecord`, `src/app/api/dashboard/stats/route.ts:283`)을 쓴다.
- 이는 canonical truth 정직성 축 위반이며, LabAxis 제품 제약(가짜/모순 수치 금지)에 직접 걸린다.
- §2·§3(4단계 트랙 · 기한 그룹)은 summary API 계약 확장과 마감일 스키마 확인이 선행돼야 하므로 P1로 분리한다.

---

## 2. Work Type

- [ ] Feature
- [x] Bugfix (정직성 결함)
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [x] Web
- [x] Design Consistency

---

## 3. Overview

**Feature Description**
예산 미설정 상태에서 같은 사실을 4곳이 반복하고, 이번 달 0원과 6개월 4,463만원이 한 카드에 공존하는 결함을 닫는다. API 계약·스키마 무변경, 컴포넌트 4개 + page 1개의 표시 규율만 교체한다.

**Success Criteria**
- [ ] SC1 예산 미설정 시 대시보드에서 `₩0` 렌더 0회
- [ ] SC2 예산 미설정 시 카테고리 도넛·총 지출 미노출
- [ ] SC3 파이프라인 진행바(게이지) 0, 상태 칩이 대체하며 칩 클릭 = 모듈 필터 딥링크
- [ ] SC4 `OperationalBriefFloatingEntry` 대시보드 렌더 0
- [ ] SC5 2열 그리드 우측 2카드 높이 = 좌측 예산 카드 높이(stretch)
- [ ] SC6 운영 상태 게이지 색 규칙 유지: <80 blue · ≥80 yellow · ≥100 red (§11.302, amber/orange 0)

**Out of Scope (⚠️ 절대 구현하지 말 것)**
- [ ] 핸드오프 §2 다음 단계 추천 **4단계 트랙**(첫 견적 → 재고 등록 → 예산 등록 → 멤버 초대) — 멤버 수 파생이 summary에 없다
- [ ] 핸드오프 §3 **기한 그룹 3개**(지연/오늘/이번 주) · 품목명·수치 병기 · 담당자 아바타 · 모달 직행
- [ ] `/api/dashboard/summary` · `/api/dashboard/stats` 응답 계약 변경
- [ ] Prisma 스키마 · migration
- [ ] `다음에 하기` 7일 숨김(현행 dismiss 승계, 변경 없음)

**User-Facing Outcome**
- 예산 미설정 계정: 같은 사실을 한 번만 본다. 0원 반복·모순 도넛 소멸.
- 운영 계정: 도넛이 기간을 명시한 채 노출되고, 파이프라인은 의미 없는 게이지 대신 조치 가능한 상태 칩을 보여준다.

---

## 4. Product Constraints

**Must Preserve**
- [ ] workbench / queue / rail / dock
- [ ] same-canvas (새 라우트 0)
- [ ] canonical truth (`summary.budget` · `summary.spend` 단일 진실 유지)
- [ ] invalidation discipline (쿼리 키 무변경)

**Must Not Introduce**
- [ ] page-per-feature
- [ ] chatbot / assistant 재해석
- [ ] dead button / no-op / placeholder success (상태 칩은 전부 실 딥링크)
- [ ] fake billing / auth shortcut
- [ ] preview가 actual truth를 덮는 구조

**Canonical Truth Boundary**
- Source of Truth: `/api/dashboard/summary` → `summary.budget{isSet,limit,spent,remaining,usageRate}` · `summary.spend.thisMonth` · `summary.modules.{quote,receive,stock}`
- Derived Projection: `stats.categorySpending` (PurchaseRecord 최근 6개월 파생) · `stats.monthlySpending`
- Snapshot / Preview: 없음
- Persistence Path: 없음 (읽기 전용 표면)

**UI Surface Plan**
- [x] Existing route section (`/dashboard`)
- [ ] New page (해당 없음)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 예산 미설정 시 StatLine 2 KPI를 금액 대신 안내 문구로 교체 | `₩0`이 "지출이 0원" 과 "집계 전" 을 구분하지 못한다 | 숫자 자리에 문장이 들어가 tabular 정렬이 깨진다 → 미설정 분기 한정 |
| 도넛을 `budget.isSet` 게이팅 + 기간 라벨 병기 | 핸드오프 §5 초기 상태 "도넛·총 지출 금지" 를 따르되, 운영 상태의 기간 불일치도 함께 닫는다 | 운영 상태 제목이 길어진다 |
| Pipeline 진행바 삭제 후 상태 칩 배열로 교체 | 게이지 분모(maxTotal)가 도메인 의미 없음 | 칩 카운트 소스가 모듈별로 달라 파생 코드가 늘어난다 |
| FAB 제거는 대시보드 렌더만 (컴포넌트 파일 dormant 보존) | 다른 surface가 같은 컴포넌트를 쓴다 (U2 확인 대상) | dormant 파일 잔존 |

**Dependencies**
- Required Before Starting: Phase 0 U1·U2·U3 종결
- External Packages: 없음
- Existing Routes / Models / Services Touched: 없음 (읽기 전용 UI)

**Integration Points**
- `src/app/dashboard/page.tsx` (렌더 순서 · FAB · 2열 그리드)
- `src/components/dashboard/stat-line.tsx`
- `src/components/dashboard/budget-spend-card.tsx`
- `src/components/dashboard/pipeline.tsx`
- `src/components/dashboard/category-distribution-card.tsx` (기간 라벨)
- `src/components/dashboard/mobile-dashboard-view.tsx` (U3 결과에 따라 편입)

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

- 표시 규율 변경 → **sentinel(readFileSync + regex)** 이 정본. 신규 파일 `src/__tests__/dashboard/main-dashboard-p0-honesty.test.ts`
- 정규식 4원칙 강제: ① 접두사 경계 ② 창은 여는 태그부터 ③ 주입 프로브로 검출력 실증 ④ 분기 단위 묶기 ⑤ 창은 블록 경계로
- **주입 프로브 절차 고정: 「적용 확인 → 주입 → RED」.** `git diff --stat` 또는 치환 건수로 적용을 먼저 확인한다. 치환 실패는 조용하다.
- 주입 범위 = 단언 창의 union (표면 5파일 전부, `/g` 또는 split-join)
- 프로브 스크립트는 **파일로 쓴다** (heredoc · `node -e` 금지 — 백슬래시 소실)
- 러너 기준 명시: **프로젝트 러너**(`npm test`)가 정본. 격리 러너 수치는 무효
- 은퇴 sentinel의 살아있는 명제는 새 파일로 이관하고 상호 참조를 남긴다

**Execution Notes**
- 실행 불가한 검사는 "실행 불가" 로 명시한다. 추정 통과 금지.

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock ✅
**Goal:** 역계약 sentinel 전수와 기준선 RED를 확정해, "내가 깨는 것" 과 "이미 깨져 있던 것" 을 분리한다.
- Status: [ ] Pending | [ ] In Progress | [x] Complete

**🔴 RED**
- [x] `npm run red-ledger` — operator-shell 실행 완료 (래칫 5/5 GREEN · RED 164 · 신규 0)
- [x] U1 종결 (앵커 대조로 실측 — §0 표 참조)
- [x] U2 종결 (살아있는 FAB 축 4건 확정)
- [x] U3 종결 (T6 범위 L92 1곳으로 축소)

**🟢 GREEN**
- [ ] 은퇴/완화 대상 sentinel 목록 확정 (파일 · **테스트 이름** · 명제 · 이관처 4열 표)
- [x] 세션 격리 env로 `npm run build` — operator-shell exit 0 · Route 표 출력

**🔵 REFACTOR**
- [ ] Out of Scope 경계 재확인 (§2·§3 누출 0)

**✋ Quality Gate**
- [x] 미확인 0건 · 기준선 RED 목록 확정 · 래칫 전수 5와 GREEN 5 기록
- [x] 우선순위 적합성 문서화 완료

**Rollback:** planning-only. 코드 변경 0.

---

### Phase 1: 역계약 Sentinel (RED) 🔄
**Goal:** 새 표시 규율을 단언으로 먼저 고정하고, 검출력을 프로브로 실증한다.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED**
- [x] `src/__tests__/dashboard/main-dashboard-p0-honesty.test.ts` 신설 — 축 A 행동 4그룹 + 축 B 구조 8그룹. 단언 설계:
  - [ ] A1 `stat-line.tsx` — `!isSet` 분기에서 `won(` 호출 도달 불가 (미설정 시 금액 렌더 0)
  - [ ] A2 `budget-spend-card.tsx` — `CategoryDistributionCard` 렌더가 `isSet` 게이트 안에 있다
  - [ ] A3 `budget-spend-card.tsx` — 미설정 분기에 CTA(`<a` · `<button`) 0 (배너 단독 소유 유지)
  - [ ] A4 `pipeline.tsx` — `maxTotal` 0회 · 진행바 `<i` 0회
  - [ ] A5 `pipeline.tsx` — 상태 칩 배열 존재 + 각 칩 `href` 가 쿼리 파라미터 포함(딥링크)
  - [ ] A6 `dashboard/page.tsx` — `OperationalBriefFloatingEntry` 0회
  - [ ] A7 `dashboard/page.tsx` — 2열 그리드에 `items-stretch` 유지 + 우측 컬럼 `flex-1`
  - [ ] A8 신호등 회귀: 대상 5파일 `-amber-` · `-orange-` 0
  - [ ] A9 em dash 회귀: `__tests__/_helpers/em-dash-scan.ts` 를 대상 5파일 **파일 단위**로 실행해 UI 축 0
- [x] 주입 프로브 `scripts/probe-p0-honesty.mjs` 작성(14종) · 왕복 자체 검증 완료. **적용 확인은 파일 지위별로 분기**(추적=diff · 신규=grep)
- [ ] 프로브 결과에 러너 기준(`npm test`, `vitest.config.ts` 적용) 명시 — operator-shell 회신 시

**🟢 GREEN**
- [ ] C1·C2·C3 sentinel 은퇴 처리. 살아있는 명제는 새 파일로 이관:
  - [ ] C1 이관 명제: "운영 브리핑 popup은 self-contained" · "견적 surface 억제" (FAB 위치 명제만 은퇴)
  - [ ] C2 이관 명제: "§11.302 amber/orange 0" · "0건 value 가독성 slate-500" (pbar 명제만 은퇴)
  - [ ] C3 완화: 도넛 존재 단언 → `isSet` 조건부 존재 단언으로 교체
- [ ] 은퇴 파일에 이관처 상호 참조 주석 삽입

**🔵 REFACTOR**
- [x] 창 경계를 블록(중괄호 짝)으로 열었는지 재점검 — `blockFrom()` 헬퍼 사용, 고정 폭 슬라이스 0

**✋ Quality Gate**
- [x] **그룹 A 프로브 5종** 실증 대상 확정 · 왕복 동작 검증 완료 (operator-shell RED 확인 대기)
- [ ] **그룹 B 프로브 9종** — Phase 2 GREEN 직후로 이월 (없는 배선은 끊을 수 없다)
- [ ] 은퇴 sentinel의 명제가 새 파일에 남아 있음을 grep으로 확인
- [ ] 기존 테스트 Phase 0 기준선 대비 신규 RED 0 — **테스트 이름 집합(16건) 대조로 판정. 총계 비교 금지**
- [ ] `npm run typecheck` · `npm run lint` 결과 기록 (실행 불가 시 명시)

**Rollback:** 신규 테스트 파일 삭제 + 은퇴 커밋 revert.

---

### 🛑 Phase 1 산출물 · 상신 2건 (2026-09-18)

**작성된 파일 3종**

| 파일 | 역할 |
| :--- | :--- |
| `src/lib/dashboard/p0-display.ts` | 표시 규율 **순수 파생** 계약. `budgetStatDisplay` · `shouldRenderCategoryDonut` · `buildPipelineChips` |
| `src/__tests__/dashboard/main-dashboard-p0-honesty.test.ts` | 축 A 행동 단언 + 축 B 구조 sentinel |
| `scripts/probe-p0-honesty.mjs` | 주입 프로브 14종. 치환 0건이면 `ANCHOR MISS` 로 즉사(조용한 실패 차단) |

**설계 결정 — 정규식 sentinel 을 최소화하고 행동 단언을 정본으로 둔다**
CLAUDE.md 「sentinel 은 명제를 단언한다 · 이름·문자열·바이트는 명제가 아니다」를 따라, 표시 규율을 React 컴포넌트에서 **순수 함수로 분리**했다. `p0-display.ts` 는 DOM·fetch 의존이 0이라 정규식이 아니라 값으로 잴 수 있다. 정규식은 "파일에서 사라져야 할 것"(FAB · 게이지)처럼 값으로 잴 수 없는 구조 사실에만 남겼다.
`budTone` 은 **재정의하지 않았다** — canonical 권위는 `summary-derive.ts` 이며, A4가 그 재정의 시도를 단언으로 막는다.

**🛑 프로브 순서 정정 — 축 B 검출력 실증은 Phase 2 이후다**
계획서 Phase 1 게이트에 "신규 단언 전량 프로브 RED" 라고 적었으나, **없는 배선은 끊을 수 없다.** 축 B(B1~B8)는 구현 전이라 이미 RED이고, 그 RED는 "검출력이 있다" 가 아니라 "아직 구현이 없다" 를 뜻한다.
- Phase 1에서 실증 가능: **그룹 A 프로브 5종**(`p0-display.ts` 가 이미 존재)
- Phase 2 GREEN 직후 실증: **그룹 B 프로브 9종**
프로브 스크립트가 `[P1]` / `[P2]` 로 구분해 출력한다.

**프로브 왕복 자체 검증 (Cowork 셸 실측 2026-09-18)**
- `A1-guard-off` 주입 1건 → 흔적 grep 1 → 복원 → 흔적 0 · 원문 복구 확인
- `B7-amber-sweep` **5파일 전량 175건** 주입 확인 — 주입 범위 = 단언 창의 union (4원칙 ③ 보강)
- 🛑 발견: **`git diff --stat` 은 신규(untracked) 파일을 잡지 못한다.** `p0-display.ts` 주입이 diff 에 안 떴다. 적용 확인 수단을 파일 지위별로 갈랐다 — 추적 파일은 `git diff --stat`, 신규 파일은 `grep -c <주입 토큰>`. 스크립트가 복원 시 이 경고를 출력한다.
- 🛑 발견: Cowork 셸은 연결 폴더에서 `unlink` 가 EPERM 이라 백업 디렉터리를 못 지운다. 지우는 대신 **0바이트로 비워 "소비됨"** 표시하도록 고쳤고 `.probe-backup/` 을 `.gitignore` 에 등재했다.

**상신 S1 — 예산 게이지 정상 구간 색 (조항 vs 시안 충돌)**
핸드오프 §5는 게이지를 `블루, ≥80% 앰버, ≥100% 레드` 로 적었다.
- `앰버` → **조항이 이긴다.** §11.302 amber/orange 금지(16 sentinel 잠금) → yellow. 현행 구현이 이미 yellow라 무변경. 조용한 채택이 아니라 기록으로 남긴다.
- `블루`(정상 구간) → **판정 필요.** 현행 canonical `budTone` 의 `ok` 는 emerald이고, §11.302는 "정상 = emerald" 다. 시안의 블루를 채택하면 신호등 정상색이 화면마다 갈린다.
  - 권장: **emerald 유지**(조항 승). 채택 시 `budTone` 무변경 · diff 0.
  - 블루로 가려면 `budTone` 의 `ok` 소비처 전수와 §11.302 재정의가 따라온다 → 별도 트랙.
  - **미판정 상태로 Phase 2 착수 가능** — 현행 emerald 유지가 곧 무변경이라 되돌릴 것이 없다.

**상신 S2 — 견적 `마감 오늘` 칩은 P0에서 만들지 않는다**
핸드오프 §4 견적 칩 3종 중 `마감 오늘 n`(레드)은 **회신 마감일이 summary 계약에 없어 파생 불가**다. 없는 데이터로 칩을 만들지 않는다(가드②). §3 기한 그룹과 같은 의존이므로 **P1에서 함께 처리**한다.
P0 견적 칩 = `회신 대기`(yellow, `quote.pending`) · `비교 중`(gray, `quote.responded`) 2종.

**입고 칩 딥링크 한계**
`/dashboard/receiving` 는 URL 필터 파라미터를 소비하지 않는다(실측). 입고 칩은 **필터 없는 라우트**로 착지한다 — dead link 는 아니나 핸드오프 §4의 "필터 적용 딥링크" 를 완전히 만족하지 않는다. 필터 파라미터 신설은 P0 범위(UI-only) 밖이므로 P1 후보로 기록한다.

---

### Phase 2: 정직성 구현 (GREEN) ✅
**Goal:** 핸드오프 §1·§4·§5·§6을 최소 diff로 구현한다.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED** — Phase 1 단언이 RED 상태임을 재확인 후 착수

**🟢 GREEN**
- [x] **T1 `stat-line.tsx`** — `budget.isSet === false` 분기 추가
  - `이번달 지출` → `집계 전` · 보조 `첫 발주 완료 후 표시`
  - `잔여 예산` → `설정 전` · 보조 `예산 등록 후 표시`
  - 기존 상태 칩(`예산 미설정` · `설정 필요`)과 중복되지 않게 칩 문구 정리
- [x] **T2 `budget-spend-card.tsx`** — 초기/운영 2상태 분기
  - 초기: 제목 + `설정 전` pill · 미니 지표 2개 · 캡션 `예산 설정은 상단 다음 단계 추천에서 진행합니다` · CTA 0 · **도넛 0 · 총 지출 0**
  - 운영: 소진액 + `/ 예산 · n% 소진` · 게이지 8px(<80 blue · ≥80 yellow · ≥100 red) · 3지표(잔여 · 남은 일수 · 일평균 가능) · 구분선 · 도넛 96px + 우측 범례
- [ ] **T3 `category-distribution-card.tsx`** — 기간 라벨 병기 (`카테고리 비중 · 최근 6개월`). ⚠️ **호영님 승인 대기 항목** — 미승인 시 대안은 도넛 소스를 이번 달로 교체(6개월 분포 소실)
- [x] **T4 `pipeline.tsx`** — 진행바 삭제 → 상태 칩
  - 견적: `마감 오늘 n`(red) · `회신 대기 n`(yellow) · `비교 중 n`(gray)
  - 입고: `조치 필요 n`(yellow) 또는 `이상 없음`(emerald)
  - 재고: `안전재고 미달 n`(red) · `만료 임박 n`(yellow)
  - 각 칩 `href` = 해당 모듈 필터 딥링크. 0건 칩 미렌더(dead button 0)
- [x] **T5 `dashboard/page.tsx`** — `OperationalBriefFloatingEntry` 렌더 제거(import 포함, dead import 0) + 2열 그리드 우측 컬럼을 세로 2카드 `flex-1` 로 재구성
- [x] **T6 모바일** — U3 결과에 따라 `mobile-dashboard-view.tsx` 동일 규율 반영 (<768px: 파이프라인 1열)

**🔵 REFACTOR**
- [x] 미설정/운영 분기 중복 제거, 하드코딩 0 재확인
- [x] 칩 파생 로직을 순수 모듈(`p0-display.ts`)로 추출

**✋ Quality Gate**
- [x] Phase 1 신규 단언 전량 GREEN (46/46)
- [ ] 기존 테스트 기준선 대비 신규 RED 0 — **테스트 이름 집합(16건) 대조로 판정. 총계 비교 금지**
- [ ] `npm run build` (세션 격리 env) **exit code 0** 으로 판정. grep 판정 금지. 보조로 마커 4종(`Export encountered` · `Failed to compile` · `npm error` · `Type error`) 카운트 + Route 표 출력 확인
- [x] dead button 0 · no-op 0 · 하드코딩 0
- [x] loading / error / empty / disabled 4상태 유지 확인

**Rollback:** 컴포넌트 단위 revert (T1~T6 독립). API·DB 변경 0이라 데이터 rollback 없음.

---

### 🛑 Phase 2 실행 기록 (2026-09-18)

**Phase 1 실증 결과 (operator-shell · Windows 로컬 · 프로젝트 러너 · HEAD `fe47deea`)**
- 신규 테스트 40건: 통과 29 · 실패 11. **축 A 16/16 GREEN** — 계약 무결함.
- **그룹 A 프로브 5/5 RED** · 복원 후 sha1 원본 일치 · ANCHOR MISS 0 · 프로브가 다른 단언에 번지지 않음(B 실패 11 고정).
- `docs/plans/baseline-p0-red-16.txt` 생성. HEAD 변경 후 재실행해도 이름 집합 무차분.
- red-ledger: 래칫 5/5 GREEN. **신규 RED 11건은 전부 본 트랙 테스트 파일의 B그룹** — 그 외 신규 0.
  🛑 **테스트 파일만 먼저 커밋하면 게이트가 RED 다. Phase 2 구현과 같은 커밋으로 올린다.** 원장 등재로 닫는 것은 금지(스크립트도 막는다).

**🛑 B7 em dash RED 는 미구현이 아니라 실제 위반이었다 (범위 추가)**
`src/app/dashboard/page.tsx` L571 · L573 의 `recommendedActions` desc 2건이 화면 문구 축 위반이었다.
- 소급 치환 전 sentinel 핀 grep 실행(CLAUDE.md 규칙): `검토 후 확정` 0건 · `비교 대기 항목 없음` 0건 · `검색에서 후보를 추가` 0건 → **치환 안전**.
- `dashboard-page-amber-removed-302d6a4g.test.ts:64` 는 `id: "r-compare"` 만 핀한다. `desc` 변경과 무관 → 무손상.
- 조치: `—` → `·` 2건 치환.

**발견 — 죽은 코드가 sentinel 때문에 살아 있다 (다른 트랙 몫, 조치 안 함)**
`recommendedActions` 배열은 `page.tsx` 에서 6회 push 되지만 **JSX 소비가 0** 이다(실측). `dashboard-sidebar-action-touch-target-266b.test.ts` 가 "인라인 렌더 재도입 금지" 를 적어 둔 그 배열이다. 지우는 것이 옳으나 `302d6a4g:64` 가 `id: "r-compare"` 를 핀하고 있어 삭제하면 그 sentinel 이 RED 가 된다. **검사가 죽은 코드를 붙잡고 있는 형태** — 은퇴 판정은 그 sentinel 을 만든 트랙의 몫이라 본 트랙은 문구만 고쳤다.

**작업 내역 (T3 제외 전량 완료)**

| | 파일 | 변경 |
| :--- | :--- | :--- |
| T1 | `stat-line.tsx` | `budgetStatDisplay` 배선. 미설정 시 `집계 전`/`설정 전` + 보조 1줄, **칩 미노출**(같은 사실 2회 말하기 제거) |
| T2 | `budget-spend-card.tsx` | 초기/운영 2상태 분기. 초기 = CTA 0 · 금액 0 · 도넛 0. 운영 = 소진액 28px · `예산 관리 ›` · 게이지 8px · 3지표 · 도넛 게이트 |
| T3 | `category-distribution-card.tsx` | **미착수 — 호영님 T3 판정 대기** |
| T4 | `pipeline.tsx` | 진행바 폐지 → 상태 칩. 카드 래퍼 `<a>` → `<div>` + 헤더 `열기 ›`(중첩 interactive 0) |
| T5 | `page.tsx` | FAB import·렌더 제거 · em dash 2건 · 우측 컬럼 세로 2장 `flex-1` · 하단 풀폭 최근활동 제거 |
| T6 | `mobile-dashboard-view.tsx` | 이번 달 지출 `₩0` → `budgetStatDisplay` 경유 |
| 신규 | `p0-display.ts` | `budgetPace` 추가(§5 3지표). `now` 주입형 — 시스템 시계 비의존 |
| 신규 | 테스트 | A5 4단언 추가 · 프로브 `A5-pace-floor` · `A5-negative-leak` 2종 추가 |

**덮은 선행 결정 1건**
`§dashboard-rightcol-rebalance`(호영님) 의 "최근활동 풀폭" 을 핸드오프 §1-5 "우측 세로 2장" 이 덮는다. 기존 sentinel 2건(`shifan-p3b:34` · `final-p4:45`)은 `<SpendTrendCard>` 700자 내 `<RecentActivityCard>` 인접을 요구하는데 두 카드가 이웃이 되어 **무손상**. `bottom-modules-p5:37` 의 `<RecentActivityCard />` 자기닫힘 형태도 보존.

**🛑 자기 sentinel 함정 2회 — 주석도 파일 전체 축에 걸린다**
구현 중 내가 쓴 **주석**이 내 단언을 깰 뻔했다.
1. `pipeline.tsx` 주석에 `maxTotal` 을 언급 → B4 `not.toMatch(/\bmaxTotal\b/)` 위반
2. `page.tsx` 주석에 `operational-brief/floating-entry` 경로 언급 → B6 import 단언에 근접(경계가 `from "` 라 통과)
em dash 조항은 주석을 제외하지만, **금지 식별자 단언은 파일 전체를 본다.** 은퇴시키는 식별자는 주석에도 남기지 않는다. 1번은 주석을 고쳤고 그 이유를 주석에 박아 뒀다.

**정적 자체 점검 (Cowork 셸 · 축 B 정규식 18종 · vitest 정본 아님)**
18/18 PASS. em dash 판별기와 축 A 는 포함되지 않았다 — operator-shell 실측으로만 확정한다.

---

### ✅ Phase 2 게이트 종료 (2026-09-19 · operator-shell · HEAD `ffb7649a`)

| 단계 | 결과 |
| :--- | :--- |
| 신규 테스트 | **46/46 GREEN** |
| 3개 디렉터리 이름 대조 (751파일) | 실패 109 / 통과 6,858 · **신규 RED 0** · 해소 7 |
| 프로브 17종 (P1 8 + P2 9) | **전부 해당 단언 RED** · ANCHOR MISS 0 · 복원 sha1 일치 |
| 빌드 | **exit 0** · Route 표 출력 · 마커 4종 0 |
| red-ledger | **exit 0** · 래칫 5/5 GREEN · 신규 0 |

해소 7건(원장 stale) = §11.257 6건 + §11.258-sweep dashboard wrap 1건. `--update` 미실행 — 원장 갱신은 별도 커밋.

**재게이트에서 드러난 결함 2건 (둘 다 내 누락)**
1. **형제 슬롯 미점검** — `p3b:113` 을 고치면서 쌍둥이 `p4:69`(같은 명제, 같은 파일 전체 금지)를 훑지 않았다. 1차 재게이트가 그 1건으로 막혔다. 전수 grep 결과 이 명제의 부정 단언은 정확히 2건이며 둘 다 처리했다.
2. **주석이 대신 매칭하고 있었다 (4원칙 ④)** — `p4:67` 의 `toMatch(/예산 미설정/)` 은 구현이 UI 문구를 `설정 전` 으로 바꾼 뒤에도 통과했다. 통과시킨 것은 `budget-spend-card.tsx` L12·L99 의 **주석**이었다. 바이트가 우연히 맞은 것이지 명제가 지켜져서가 아니다. `p4:69` 만 고치고 넘어갔다면 검출력 0 단언이 GREEN 인 채 남았다.
   → 블록 창 기준으로 재조준: 미설정 분기에 `설정 전` 존재 + `집행`·`usageRate`·budget CTA 부재.

**남은 기술 부채 (이 트랙 범위 밖)**
- `blockFrom` 류 블록 창 헬퍼가 4벌 중복(신규 파일 · p3b · p4 · won-glyph). `_helpers/` 로 추출이 맞으나 게이트 마감 중 리팩터 확대는 위험해 보류. 다음 sentinel 작업 때 통합 대상.
- `recommendedActions` 배열은 JSX 소비 0 인데 `302d6a4g:64` 가 `id: "r-compare"` 를 핀해 살아 있다. 검사가 죽은 코드를 붙잡고 있는 형태 — 그 sentinel 트랙의 몫.

---

### 🛑 배포 확인 기준값 정정 (2026-09-20)

**내 Phase 3 지시문 0번이 틀렸다.** "`deployedCommit` 이 이번 커밋 SHA 와 일치" 로 적었는데, Vercel 은 **브랜치 끝 커밋 하나만** 배포한다. 이 트랙 커밋이 조상으로 들어간 채 다른 커밋이 끝에 있으면 `deployedCommit` 은 그 끝 커밋이 되고, 그대로 적용하면 **정상 배포를 실패로 오판**한다.

```
push 결과   77694f58..93e25ef5  main -> main   (exit 0)
  e52846a3  §main-dashboard-p0-honesty (22파일)  ← 내가 게이트 전량을 돌려 쟀다
  93e25ef5  fix(test): §test-real-db-optin      ← 다른 세션. 내가 잰 적 없다(동승, CLAUDE.md §3-②)
Vercel 배포 대상 = 93e25ef5 (끝 커밋)
```

**올바른 기준**: `deployedCommit` 이 **`e52846a3` 을 조상으로 포함하는가**.
```
git merge-base --is-ancestor e52846a3 <deployedCommit> && echo REACHED
```
SHA 일치가 아니라 **도달 가능성(reachability)** 으로 판정한다. 병렬 세션 저장소에서는 내 커밋이 배포 끝 커밋인 경우가 오히려 드물다.

### 🛑 병렬 세션 — 네 번째 실패 형태 (CLAUDE.md 조항에 없음, 2026-09-20 실측)

push 3회 기록. **앞의 둘은 코드 결함이 아니었고, 진단이 각각 달랐다.**

| 시도 | exit | 실제 원인 | 판별 |
| :--- | :--- | :--- | :--- |
| 1 | 4 | **push 실패가 아니다.** pre-push 훅의 빌드가 도는 중에 실행 명령이 10분 제한에 걸려 죽었다. 로그는 `Compiled successfully` 뒤 타입 검사 중 끊겼고 실패 마커 0 | exit code 를 git 의 판정으로 읽은 것이 오독. **로그 끝을 먼저 본다** |
| 2 | 1 | 진짜 실패. pre-push prebuild 가 `migration-manifest.json` 을 열다 `errno -4094 UNKNOWN` | **빌드 산출물 파일의 동시 쓰기 잠금.** 다른 세션 빌드와 같은 파일을 동시에 건드렸다 |
| 3 | 0 | 성공 | 재시도만으로 풀림 |

**2번이 조항에 없던 형태다.** CLAUDE.md 병렬 세션 §3 의 "남의 **미커밋 파일**이 빌드를 깬다" 와 다르다 — 이쪽은 미커밋 소스가 아니라 **생성되는 산출물 파일의 락 경합**이다. `NEXT_DIST_DIR` 분리는 `.next` 만 가르고 `src/generated/migration-manifest.json` 은 공유한다.
- 처방: **재시도.** 코드를 고치거나 `--no-verify` 로 넘기지 않는다.
- 판별: 에러가 `migration-manifest.json` · `EBUSY` · `errno -4094` 면 경합. 내 트랙 파일 경로가 나오면 그때만 결함을 의심한다.

**1번의 교훈은 측정 축이다.** `exit 4` 를 "push 거부" 로 읽었는데 실제로는 명령 중단값이었다. 긴 훅을 도는 명령은 백그라운드로 돌려 제한을 없애고, **exit code 를 읽기 전에 로그 끝을 본다**(CLAUDE.md 「판정은 재현 가능해야 한다」의 같은 뿌리 — grep 마커가 아니라 exit code 를 정본으로 하되, 그 exit code 가 **누구의 것인지** 먼저 가른다).

### 기타 기록 (2026-09-20)

- **prod 도메인은 `www.labaxis.co.kr`** 이다. `www.labaxis.app` 은 404. 배포 확인 URL 을 이 값으로 고정한다.
- **pre-commit 게이트가 내 파일을 잡았다.** 신규 테스트 파일의 describe/it 제목에 em dash 13건. `·` 로 교체 후 통과. `--no-verify` 미사용. 게이트가 제 역할을 했다.
- **stale `index.lock`** — 49분 된 0바이트 파일에 활성 git 프로세스 0. 근거 확인 후 제거했다. 병렬 3세션 환경의 잠재 위험.

---

### ✅ 배포 반영 확인 (2026-09-20)

```
Vercel  dpl_8ifHnhv…  state=READY  sha=93e25ef5
/api/health  deployedCommit = 93e25ef51b1da228…
git merge-base --is-ancestor e52846a3 93e25ef5  → REACHED
```
두 번 잰 값이 `77694f58` → `93e25ef5` 로 **움직였다** — 앞서 3분 30초 고정이던 것은 실패가 아니라 큐였다. 「배포 판정은 두 번 잰다」가 그대로 작동했다.

**Phase 0~2 가 prod 에 반영됐다.** 남은 것은 Smoke 실측뿐이다.

---

### Phase 3: Smoke / Rollback 🔄
**Goal:** 두 계정 상태 · 두 뷰포트에서 회귀 0을 실증하고 복구 경로를 고정한다.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED**
- [ ] 실패 모드 열거: 예산 설정 직후 stale 캐시로 초기 상태 잔존 · 칩 딥링크가 빈 필터 결과로 착지 · 우측 컬럼 stretch가 짧은 좌측 카드에서 역전

**🟢 GREEN**
- [ ] Smoke A — 예산 미설정 계정 / 데스크탑: `₩0` 0회 · 도넛 0 · FAB 0
- [ ] Smoke B — 예산 설정 계정 / 데스크탑: 게이지 색 3구간 · 도넛 + 범례 + 기간 라벨 · 우측 2카드 높이 일치
- [ ] Smoke C — 모바일 375px: 파이프라인 1열 · 2열 그리드 1열 · 잘림 0
- [ ] Smoke D — 칩 3종 클릭 → 필터 적용 상태로 착지 (dead link 0)
- [ ] 배포 판정: `/api/health` `deployedCommit` 을 **간격 두고 2회** 읽어 큐/실패 구분

**🔵 REFACTOR**
- [ ] 임시 계측 제거 · Notes 확정

**✋ Quality Gate**
- [ ] Smoke A~D 전량 통과
- [ ] rollback 경로 문서화 완료
- [ ] 남은 blocker를 P1(§2·§3)로 격리 기록

**Rollback:** 컴포넌트 5개 revert 한 커밋. feature flag 불필요(표시 규율 한정).

---

## 7-B. Phase 3 Smoke 결과 (2026-09-20 · prod 실측)

| | 판정 |
| :--- | :--- |
| A 미설정 / 데스크탑 | ✅ `₩0` **0회** · 도넛 0 · 총 지출 0 · FAB 0 · 예산 카드 `설정 전` + 미니 지표 2 + 캡션 + CTA 0 |
| B 설정(₩10,000,000) | ✅ `예산 & 지출 · 9월` + `예산 관리` · `₩0 / ₩10,000,000 · 0% 소진` · 3지표(잔여 · 남은 일수 11일 · 일평균 ₩909,090 = 내림 정확) · 도넛 `카테고리별 비중 · 최근 6개월` |
| C 모바일 375px | ⛔ **실행 불가** — `resize_window` 가 뷰포트에 반영되지 않았다(사이드바 유지). 추정 통과 처리하지 않는다. 호영님 폰 확인 대기 |
| D 칩 딥링크 | ✅ 견적 4 → `?status=PENDING` **4건** / 재고 1 → `?filter=low` **1건**(BCP, 1개 / 안전재고 10). 입고 칩 부재 = 판정대로 |
| 5 회귀 | ✅ inventory 에 운영 브리핑 FAB 생존 |

### 🛑 정적 단언의 사각지대 — 화면·원문 대조로만 잡힌 결함 4건

전량 GREEN 인 게이트를 통과한 뒤, **화면을 보고서야** 드러났다. Smoke 단계가 없었으면 그대로 나갔다.

| # | 결함 | 정적 단언이 못 본 이유 |
| :--- | :--- | :--- |
| 1 | NextStepBanner em dash 2건이 화면에 노출 | B7 SURFACES 가 **값을 고친 5파일**만 봤다. 조항의 축은 **한 화면에 함께 렌더되는 파일 전부** → 11파일로 확대 |
| 2 | 칩 라벨 `회신 대기` vs 착지 화면 `발송 대기` | 어휘 일치를 재는 단언이 없었다. href 집합만 봤지 **라벨이 착지 화면과 같은 말인지**는 안 봤다 |
| 3 | 도넛 `총 지출 ₩850,000`(6개월)이 예산 `₩0`(이번 달) 아래 기간 표기 없이 | T3 를 **제목에만** 적용했다. 값 옆은 여전히 무기한이었다 → `6개월 지출` |
| 4 | 파이프라인이 모바일에서도 3열 | 핸드오프 §6 "모바일 3카드 → 1열" 을 구현하지 않았고, 그 조항을 단언으로도 옮기지 않았다. **핸드오프 원문 대조**에서 잡혔다 |

교훈 3가지.
- **단언의 축은 "내가 고친 파일" 이 아니라 "사용자가 한 번에 보는 것" 이다.** 1번이 그 형태다.
- **핸드오프 조항을 구현할 때 같은 조항을 단언으로도 옮긴다.** 4번은 구현 누락인데 단언 누락이 그것을 덮었다.
- **화면 검증은 정적 단언의 보완재가 아니라 다른 축이다.** 2·3번은 코드만 봐서는 영원히 안 보인다 — 착지 화면의 어휘, 두 수가 나란히 놓였을 때의 인상은 렌더된 화면에만 있다.

### 자체 정정 1건
재고 딥링크를 처음 읽고 `0건` 을 보고 "칩 1 vs 화면 0 = 결함" 이라 결론 낼 뻔했다. 페이지에 `불러오는 중` 이 남아 있었고 6초 뒤 **1건** 이었다. 「없어서 0 인지 아직 안 온 건지 가른다」를 건너뛴 형태(CLAUDE.md 절차 B).

### 격리 러너 확보 (B1 우회)
레포 밖 `~/iso-vitest` 에 vitest 단독 설치 — 공유 `node_modules` 무오염. rollup 리눅스 바이너리 부재로 막혔던 B1 을 우회해, sentinel 수정마다 operator 를 부르지 않고 사전 확인이 가능해졌다.
🛑 **정본이 아니다.** 프로젝트 러너는 `environment: "jsdom"` + `setupFiles` 이고 격리 러너는 `node` · setup 없음. DB/jsdom 의존 테스트는 멈춘다. **사전 확인 전용**이며 게이트 판정은 operator-shell 만.

### 공용 판별기 수정의 검출력 실증
`em-dash-scan.ts` 는 **65파일**이 쓴다(실측). isPlaceholder 를 *넓히는* 수정이라 검사 약화 위험이 있어 주입 프로브 7종을 돌렸다 — 단독일 때만 placeholder, 한쪽이라도 텍스트가 붙으면 구분자로 잡는다. 7/7 PASS. 판별기 자기 테스트 9/9 GREEN. 2차 게이트에서 실패 이름 집합 **무차분** 확인(늘어남 0 · 줄어듦 0).

### 커밋 2건
| 커밋 | 내용 | 동승 |
| :--- | :--- | :--- |
| `e52846a3` | P0 본체 22파일 | `93e25ef5`(다른 세션, 내가 잰 적 없음) |
| `35332812` | Smoke 수정 8파일 (+122 −18) | **없음** — push 전 `@{u}..HEAD` 확인 절차 반영 |

---

## 7-C. P1 백로그 (본 트랙에서 분리)

| # | 항목 | 선행 조건 |
| :--- | :--- | :--- |
| P1-1 | §2 다음 단계 추천 **4단계 트랙** | summary 에 멤버 수 파생 추가 |
| P1-2 | §3 **기한 그룹 3개**(지연/오늘/이번 주) + 품목명·수치 병기 + 담당자 아바타 + 모달 직행 | 견적 회신 마감일 스키마 확인. ⚠️ 담당자 아바타는 핸드오프 상단 "담당자 단일 운영 기준" 과 충돌 — 재확인 필요 |
| P1-3 | 견적 `마감 오늘` 칩 | P1-2 와 같은 의존(마감일) |
| P1-4 | **입고 판정 소스 통일** — summary `receive` 와 착지 화면 `/dashboard/receiving` 이 서로 다른 테이블을 셌다 | 호영님 판정(2026-09-20) · **구현 완료, 게이트 대기** → 7-E |
| P1-5 | `남은 일수` 축 재검토 — 이번 달 말일 고정이 분기·반기 예산과 어긋난다 | **구현 완료, 게이트 대기** → 7-F |
| P1-6 | `blockFrom` 류 블록 창 헬퍼 **4벌 중복**(신규 파일 · p3b · p4 · won-glyph) → `_helpers/` 통합 | 없음 · **완료** → 7-D |
| P1-7 | `recommendedActions` 배열이 JSX 소비 0 인데 `302d6a4g:64` 가 핀해 살아 있다 | 그 sentinel 트랙 |
| P1-8 | 원장 stale 해소 7건(§11.257 6 + 258sweep 1) `--update` | 별도 커밋 |
| P1-9 | **활성 예산 다중 시 선택 미정** — `userBudget.findFirst` 에 정렬·기간 필터 0 | 호영님 권고 승인(2026-09-21) · **구현 완료, 게이트 대기** → 7-H |
| P1-10 | **예산 기간 정본 불일치** — 화면은 `description` 의 `period:` 를 파싱해 쓰고 대시보드는 `yearMonth` 만 본다. 지출 산식도 다르다 | 권고: 파서 공용화 → 7-I |


---

## 7-D. P1-6 완료 — 블록 창 헬퍼 통합 (2026-09-20)

`src/__tests__/_helpers/block-window.ts` 신설 — `blockFrom` / `blockAfter` / `blockEnclosing`.

- 이 트랙이 쓰던 **4벌**을 이관했다(신규 파일 · p3b · p4 · won-glyph).
- 🛑 저장소 전체에는 같은 루프가 **20곳 넘게** 복사돼 있다(2026-09-20 실측). 나머지는 이관하지 않았다 —
  복사본마다 경계 조건이 미세하게 달라 검출력이 다르고, **남의 sentinel 을 임의로 바꾸지 않는다**.
  각 트랙이 자기 몫을 옮긴다. 헬퍼 헤더에 이 사실을 적어 뒀다.
- 프로브 교훈 1건: 최초 프로브가 `!isSet` → `!isSetZZ` 였는데 `indexOf("!isSet")` 가 **접두 포함**으로
  여전히 잡혀 88건이 전부 통과했다. 4원칙 ①(접두 경계)이 **프로브 안에서** 재발한 형태다.
  `!budgetReady` 로 바꾸자 4 RED. → 프로브도 sentinel 과 같은 경계 검사를 받아야 한다.

---

## 7-E. P1-4 완료(구현) — §receive-canonical (2026-09-20)

**판정 근거**: CLAUDE.md:678 호영님 판정 — 입고 정본은 `ReceivingDraft`.
매핑 권고: `total` = 화면이 거는 3개 상태 합, `attention` = `AWAITING_REPLY + PENDING_REVIEW`
(`APPROVED` 는 입고 확정이므로 할 일이 아니다).

### 고친 것

| 파일 | 내용 |
| :--- | :--- |
| `api/dashboard/summary/route.ts` | 입고 질의 2개를 `receivingDraft` 로 교체 · 상태 3종만 집계 · 변수명 `restock*` → `receivingDraft*` · 은퇴한 테이블명은 주석에서도 제거 |
| 〃 | **범위도 화면과 맞췄다** — `receivingOwnerWhere`(본인 + 소속 조직). 처음엔 `userId` 단독이었는데, 화면은 `OR: [{userId},{organizationId in orgIds}]` 를 본다. 그대로 뒀으면 조직 건이 남아 있어도 칩이 `이상 없음`(emerald) 을 띄우는 **거짓 안심**이 됐다 |
| `lib/dashboard/summary-derive.ts` | `ReceivingStatusKey` 를 실제 5상태로 · `receive` 계약 필드명을 상태 그대로 |
| `lib/dashboard/p0-display.ts` | 입고 칩 복원 — `조치 필요`(yellow) / 없으면 `이상 없음`(emerald) / 0건이면 칩 0 |
| `components/dashboard/pipeline.tsx` | `attention` = `awaitingReply + pendingReview` |

### Sentinel

`summary-contract-p1.test.ts` 에 `(F) §receive-canonical` 4건 추가.
핵심은 ②다 — **상태 집합을 양쪽에 적어 두지 않고 화면 파일에서 읽어와 비교**한다.
같은 상수를 두 곳에 적으면 한쪽만 바뀌어도 통과한다.

### 검출력 실증 (격리 러너)

| 프로브 | 주입 | RED |
| :--- | :--- | :--- |
| `F1-restock-revive` | 소스를 옛 테이블로 되돌림 | ①②③④ (창 자체를 잃는다) |
| `F2-status-drift` | groupBy 에서 `APPROVED` 탈락 | ②④ |
| `F3-scope-narrow` | 범위를 본인 단독으로 | ③ |
| `F4-pipeline-approved-leak` | attention 에 `APPROVED` 합산 | ④ |
| `A3-receive-approved-leak` | p0-display 쪽 같은 누수 | A3 2건 |

복원 후 2파일 **79/79 GREEN**(격리 러너 · 비권위).

### 부수 영향 0 — 차등 측정

격리 러너로 `HEAD` 아카이브 사본과 작업본을 **같은 조건으로** 돌려 실패 집합을 차집합했다
(`git archive HEAD apps/web/src` → 별도 러너. 워킹트리를 건드리지 않는다).

- `__tests__/dashboard/` : 기준 98 실패 → 작업본 101 실패.
  늘어난 3건은 전부 `quote-centerworkwindow-demote-363b.test.ts` — **다른 세션의 untracked 파일**이라
  기준 사본에 없었을 뿐이다. 내 변경으로 깨진 것 0.
- 🛑 이 차등이 없으면 "원래 빨갰다" 와 "내가 깨뜨렸다" 를 구분할 수 없다.
  격리 러너의 절대 숫자는 권위가 없지만, **같은 러너의 전후 차이**는 읽을 수 있다.
- 영향권 직접 측정: 바뀐 4개 소스를 **읽는** 테스트를 전수로 뽑아(`grep -rln` · dashboard 밖 5파일)
  양쪽에서 돌렸다 — `guest-scope-leak` / `cancelled-order-spend` / `dashboard-empty-state-unify` /
  `purchasing-hide-feature-flag` / `reorder-need-inline-duplication`. **31/31 GREEN, 양쪽 동일**.
  (2026-09-18 의 교훈 — `stat-line.tsx` 를 건드려 계획 범위 밖 sentinel 4건을 깨뜨린 그 형태를 되풀이하지 않으려는 절차다.)
- 실행 환경 실측 2건: ① 이 세션의 `device_bash` 는 한 번에 **약 120초**에서 끊긴다(인자로 더 줘도 상한이 이긴다).
  백그라운드(`nohup ... &`)도 호출이 끝나면 같이 죽는다 — 긴 스윕은 **디렉터리를 쪼개 여러 번** 돌려야 한다.
  ② 마운트된 폴더는 로컬 사본보다 느리다: 트리 전체를 걷는 `guest-scope-leak` 가 사본 0.6초 / 마운트 **35초**였다.
  타임아웃으로 죽은 것을 RED 로 읽지 말 것.

### 남은 것

게이트는 operator-shell 몫이다 — **빌드까지** 돌려야 한다(P1-6 과 달리 소스·API 출력이 바뀌었고 화면에 칩이 뜨고 사라진다).
이 세션(sandbox)에서는 프로젝트 러너를 돌릴 수 없다 — 원인이 확정됐다.

`node_modules` 가 **Windows 에서 설치된 것**이다: `@rollup/rollup-win32-x64-{gnu,msvc}` 만 있고
`rollup-linux-x64-gnu` 가 없다. esbuild 도 같다(`.exe`). 이 리눅스 VM 에서는 `require` 단계에서 즉사한다.

우회를 두 번 시도했고 둘 다 실패했다(같은 시도를 반복하지 말 것):
1. `NODE_PATH=<격리러너>/node_modules` — rollup 은 넘어갔지만 esbuild 에서 `write EPIPE`.
2. `+ ESBUILD_BINARY_PATH=<격리러너 리눅스 바이너리>` — 동일. 버전도 어긋난다(repo 0.27.1 / 격리 0.28.2).

남은 길은 **공용 `node_modules` 에 리눅스 바이너리를 설치**하는 것뿐인데, 금지 조항이다
(샌드박스는 공용 node_modules 에 설치하지 않는다). → 게이트는 operator-shell 전용이다. 구조적 사실이지 일시적 장애가 아니다.

### 🛑 operator-shell 게이트 지시 (P1-4)

레포 루트에서, 순서대로:

```
npm run -w apps/web test -- src/__tests__/dashboard/ src/__tests__/regression/ src/__tests__/inventory/ src/__tests__/meta/
npm run -w apps/web build          # ← P1-6 과 다르다. 소스·API 출력이 바뀌었다
npm run red-ledger
```

- **빌드 필수.** `summary/route.ts` 의 Prisma 질의(모델·필드·enum)가 바뀌었다. vitest 는 정적 문자열만 읽으므로 타입 오류를 못 잡는다.
- 커밋은 **경로를 명시**한다. 작업 트리에 다른 세션의 변경이 섞여 있다(`sentinel-identifier-boundary.test.ts` 는 **staged** 상태, `budget-lifecycle-wiring.test.ts`, `migration-manifest.json`). `git commit -a` / 인자 없는 commit 금지.

```
git add apps/web/src/app/api/dashboard/summary/route.ts \
        apps/web/src/lib/dashboard/summary-derive.ts \
        apps/web/src/lib/dashboard/p0-display.ts \
        apps/web/src/components/dashboard/pipeline.tsx \
        apps/web/src/__tests__/dashboard/summary-contract-p1.test.ts \
        apps/web/src/__tests__/dashboard/main-dashboard-p0-honesty.test.ts \
        apps/web/scripts/probe-p0-honesty.mjs \
        apps/web/docs/plans/PLAN_main-dashboard-p0-honesty.md
```

- 훅 건너뛰기 금지. pre-commit 이 테스트 제목의 `—` 를 `·` 로 바꾸면 그대로 받는다(자동 수정이지 실패가 아니다).
- `.git/index.lock` 이 남아 있다(2026-09-20 관측). 다른 세션이 안 돌고 있으면 **stale** 이다 — §병렬 세션 절차대로 처리.
- 배포 확인은 SHA 일치가 아니라 `git merge-base --is-ancestor <이 커밋> <deployedCommit>` 이다.

---

### ✅ P1-4 게이트 · 배포 완료 (2026-09-20 · operator-shell)

| 단계 | 결과 |
| :--- | :--- |
| 테스트 4축 731파일 | 실패 111 · 통과 6,633 · **신규 RED 0 · 해소 7** |
| 빌드 | exit 0 |
| red-ledger | exit 0 · 신규 0 · 래칫 **6/6** GREEN |
| 커밋 | `72d36178` (8파일 · +328 −49) |
| 배포 | `/api/health` `deployedCommit = 72d36178` — 내 커밋이 브랜치 끝이라 SHA 직접 일치 |

- 빌드가 잡아 준 축: `summary/route.ts` 의 Prisma 모델·필드·enum 이 전부 바뀌었는데 타입 오류 0으로 통과했다.
  정적 sentinel 은 문자열만 읽으므로 이 축을 못 본다 — **소스가 바뀌면 빌드까지** 라는 규칙이 값을 했다.
- 래칫이 5 → **6** 으로 늘었다(다른 세션이 `§sentinel-identifier-boundary` 추가, `e8bca51a`).
- ⚠️ 동승 커밋 `3930c8c6`(결제 게이트 문서 정정)은 다른 세션 것이고 **아무도 재지 않았다**.
  같은 로컬 main 이라 분리할 수 없었다. 문서 커밋이라 화면 영향은 없어 보이지만, 측정된 바 없다는 사실은 남긴다.

### 🛑 배포 후 화면 확인 — 판정 기준 정정 (2026-09-20)

게이트 보고에 `"prod ReceivingDraft 0건이므로 칩이 안 보여야 정상 · 이상 없음(emerald)이 뜨면 회귀"` 가
적혔는데, **두 군데가 틀렸다.** 그대로 두면 정상을 회귀로 읽는다.

1. `이상 없음` 은 **정상 상태다.** 칩 규칙은 `open(AWAITING_REPLY+PENDING_REVIEW) > 0 → 조치 필요 N` ·
   `open 0 인데 total > 0 → 이상 없음` · `total 0 → 칩 없음` 이다.
   전건이 `APPROVED`(입고 확정)면 `이상 없음` 이 뜨는 게 설계대로다.
2. `0건` 이라는 근거가 이번 변경 **이전** 측정이다. 2026-09-16 실측은 `userId` 단독 범위였고,
   이번에 범위를 화면과 맞춰 **소속 조직까지** 포함시켰다. 조직 건이 있으면 0이 아닌 게 정상이다.

**올바른 판정 기준은 절대값이 아니라 불변식이다:**

> 칩이 말하는 수 == 칩을 눌러 도착한 `/dashboard/receiving` 의 건수.

- 칩 없음 → 착지 화면도 0건이어야 한다.
- `조치 필요 N` → 착지 화면에 **회신 대기 + 검토 대기** 합이 N 이어야 한다.
- `이상 없음` → 착지 화면에 목록은 있는데 회신·검토 대기가 0이어야 한다.

셋 중 어느 것이 떠도 그 자체로는 회귀가 아니다. **수가 어긋나면** 회귀다 — 이 트랙이 닫은 결함이 정확히 그것이다.


---

## 7-F. P1-5 구현 — §budget-period-axis (2026-09-21)

**결함**: `남은 일수` 를 무조건 **이번 달 말일**로 셌다. 실측 — 12.31 까지인 예산에 `남은 일수 11일`.
`일평균 가능 = 잔여 / 남은 일수` 라서 **한 번 틀린 축이 두 지표를 오염**시켰다.
카드 머리의 `· 9월` 도 같은 거짓말이다(12.31 예산에 9월을 붙인다).

**판정**: 축은 **예산이 스스로 선언한 기간**이다. 선언이 없으면 종전대로 이번 달 말일.
별도 판단을 부르지 않았다 — 12.31 예산에 11일을 띄우는 것은 선택지가 아니라 오답이고,
`UserBudget.endDate` 가 이미 스키마에 있다. 월 단위 폴백 예산(`Budget.yearMonth`)은 애초에
**이번 달로 질의**되므로 두 규칙의 답이 같다 → `periodEnd: null` 로 두고 폴백에 맡긴다.

🛑 **위 문단의 마지막 문장은 2026-09-21 실측으로 반증됐다 → 7-I.**
   폴백 예산도 `description` 에 기간을 들고 있고, 그 기간은 이번 달을 넘어간다.

### 고친 것

| 파일 | 내용 |
| :--- | :--- |
| `summary-derive.ts` | `budget` 계약(입력·출력)에 `periodEnd: string \| null` 추가 |
| `api/dashboard/summary/route.ts` | `UserBudget.endDate` → **KST 달력 날짜**(`YYYY-MM-DD`)로 굳혀 내려보낸다. 폴백 예산은 `null` |
| `p0-display.ts` | `budgetPace(remaining, now, periodEnd?)` — 기간 끝까지 센다. 지났거나 마지막 날이면 1. 신설 `budgetPeriodLabel()` |
| `budget-spend-card.tsx` | `now` 를 **하나만** 만들어 세 지표에 같이 넘긴다(자정을 넘기며 어긋나지 않게). 라벨은 `9월` / `12.31까지` |

**시간대**: 변환은 route 에서 **한 번만** 한다(`en-CA` + `Asia/Seoul` — `resolvePeriodYearMonth` ·
`silence-window.ts` 와 같은 전제: 운영자 전원 한국 기반). 그 아래로는 달력 문자열이라 시각이 없다.
`now` 와 `periodEnd` 는 같은 달력(보는 사람의 달력)에서만 비교한다.

### Sentinel

- `main-dashboard-p0-honesty.test.ts` → `A6` 6건(행동): 기간 반영 · 두 지표 동시 오염 · 폴백 · 지난 기간 바닥 · 마지막 날 · 라벨.
- `summary-contract-p1.test.ts` → `(G)` 4건(구조): KST 변환 위치 · 폴백은 기간을 만들지 않는다 ·
  카드가 `now` 하나를 본다 · **말일 계산이 route·카드로 복제되지 않는다**(축이 두 곳이면 또 어긋난다).
- `(E) 회귀 0` 의 `budget` 키 목록에 `periodEnd` 를 더했다 — 계약이 실제로 넓어졌으므로 같이 움직이는 게 맞다.

### 검출력 실증 (격리 러너)

| 프로브 | 주입 | RED |
| :--- | :--- | :--- |
| `G1-period-ignored` | 기간 파싱 무력화(2곳) | A6 **5건 전부** |
| `G2-past-floor-off` | 지난 기간 바닥(1) 제거 | A6 지난-기간 1건 |
| `G3-label-revert` | 라벨을 달력 이번 달로 | (G)③ |
| `G4-tz-drift` | KST 고정 해제 | (G)① |
| `G5-fallback-period` | 폴백에 기간 임의 주입 | (G)② |

- `G1` 이 2곳을 치는 이유: `budgetPeriodLabel` 도 같은 파서를 쓴다. 축이 하나라는 증거다.
- `G3` 은 **(G)③만** 깬다 — A6 라벨 단언은 함수를 직접 부르므로 배선을 끊어도 안 깨진다.
  행동 축과 배선 축을 따로 두는 이유가 이것이다(둘 다 필요하다). 프로브 설명에 실측대로 적어 뒀다.

### 자체 측정

- 두 핵심 파일 **89/89 GREEN**.
- 영향권 전수(`grep -rln` 으로 바뀐 4개 소스를 읽는 테스트) 9파일 **87/87 GREEN**.
- 타 소비자 0 — `DashboardSummaryInput["budget"]` 리터럴을 만드는 곳은 summary route 하나뿐이고,
  `budgetPace` 호출부도 카드 하나뿐이다(전수 grep).
- 전부 격리 러너이므로 **비권위**다. 권위는 operator-shell 의 프로젝트 러너 + 빌드다.

### 🛑 operator-shell 게이트 지시 (P1-5)

```
npm run -w apps/web test -- src/__tests__/dashboard/ src/__tests__/regression/ src/__tests__/inventory/ src/__tests__/meta/
npm run -w apps/web build          # 계약(타입)이 넓어졌다 — 빌드 필수
npm run red-ledger
```

```
git add apps/web/src/app/api/dashboard/summary/route.ts \
        apps/web/src/lib/dashboard/summary-derive.ts \
        apps/web/src/lib/dashboard/p0-display.ts \
        apps/web/src/components/dashboard/budget-spend-card.tsx \
        apps/web/src/__tests__/dashboard/summary-contract-p1.test.ts \
        apps/web/src/__tests__/dashboard/main-dashboard-p0-honesty.test.ts \
        apps/web/scripts/probe-p0-honesty.mjs \
        apps/web/docs/plans/PLAN_main-dashboard-p0-honesty.md
```

경로 명시 필수 — 작업 트리에 다른 세션 변경이 섞여 있다(`budget-lifecycle-wiring.test.ts`, `migration-manifest.json`, `package-lock.json`).

**배포 후 화면 확인**: 예산 카드 머리와 `남은 일수`.
현재 prod 의 활성 예산에 `endDate` 가 없으면 **아무것도 안 바뀐 것이 정상**이다(폴백 경로).
`endDate` 가 있으면 머리가 `· 12.31까지` 류로 바뀌고 `남은 일수` 가 그 날짜까지로 늘어난다.


---

## 7-G. prod 화면 실측 (2026-09-21 · Chrome · www.labaxis.co.kr)

로그인 세션으로 직접 봤다. **화면이 곧 판정**이다 — 정적 단언이 못 보는 축이다.

### ① P1-4 입고 정본 — 통과

| 본 것 | 값 |
| :--- | :--- |
| 대시보드 입고 카드 | `0건` · `데이터 없음` (칩 없음) |
| 착지 화면 `/dashboard/receiving` | "처리 중인 입고가 없습니다" = 0건 |

불변식 **칩이 말하는 수 == 착지 화면의 건수** 성립. `데이터 없음` 은 칩이 아니라
0건 스테이지의 비활성 문구(`pipeline.tsx:205`)이고 누를 수 없다 — dead button 0.

함께 확인된 것: FAB 0 · 파이프라인 3카드에 게이지 0 · `열기 ›` + 상태 칩 ·
2열 그리드가 높이 맞춰 서고 우측이 지출 트렌드 + 최근 활동 세로 2장 ·
상단 ₩0 반복 해소(2장) · 도넛에 `· 최근 6개월` 병기.

### 🛑 ② P1-5 가 고치는 결함이 **지금 prod 에 살아 있다** — 실측

`/dashboard/budget` 에서 활성 예산의 실제 기간을 읽었다.

| 예산 | 기간 | 금액 |
| :--- | :--- | :--- |
| `Smoke 검증용 예산 2026-09` (대시보드가 고른 것) | **9월 20일 ~ 12월 31일** | ₩0 / ₩10,000,000 |
| `2026 하반기 실측 예산` | 8월 18일 ~ 12월 31일 | ₩850,000 / ₩5,000,000 |

대시보드 예산 카드는 이렇게 떠 있다:

| 항목 | 화면 | 참값 | |
| :--- | :--- | :--- | :--- |
| 기간 라벨 | `· 9월` | `· 12.31까지` | ✗ |
| 남은 일수 | `10일` | **102일** (9/21→12/31) | ✗ |
| 일평균 가능 | `₩1,000,000` | **₩98,039** | ✗ |

**쓸 수 있는 돈을 10배로 부풀려 보여주고 있다.** 표시 오류가 아니라 운영 판단을 오도하는 수치다.
이름이 `2026-09` 라서 월 예산처럼 보이지만 endDate 는 12.31 이다 — 이름을 믿고 축을 고정한 것이 결함의 본체다.
P1-5 배포 후 이 세 칸이 위 참값으로 바뀐다. **P1-5 우선순위를 올린다.**

### 🛑 ③ 신규 결함 — 활성 예산이 여럿일 때 무엇이 뜰지 미정

`summary/route.ts` 의 `db.userBudget.findFirst({ where: { userId, isActive: true } })` 에 **정렬이 없다.**
실측: 활성 예산 2건 중 대시보드가 고른 것은 `검증용`(0% 소진)이고,
실제 운영 예산(`2026 하반기 실측 예산` · 17% 소진 · ₩850,000 집행)은 화면에 없다.

- 도넛의 `6개월 지출 ₩850,000` 은 그 **다른 예산**의 집행액이다.
  카드 상단 `₩0 / ₩10,000,000` 과 나란히 서 있는 것이 기간 차이만이 아니라 **예산 선택 차이**이기도 하다.
- 검증용 예산을 지우면 증상은 가려지지만 원인은 남는다. 예산을 두 개 쓰는 순간 다시 나온다.
- ⚠️ **호영님 판정 필요** — 활성 예산이 여럿일 때 대시보드의 정본은 무엇인가.
  권고: **오늘이 기간 안에 드는 것 중 가장 최근 시작분**. 기간 밖인 예산은 애초에 대시보드 정본이 될 수 없고,
  `isActive` 만으로는 그것을 거르지 못한다. 구현은 정렬 + 기간 필터 한 줄이라 작다.
  → **P1-9** 로 백로그에 올린다.


---

## 7-H. P1-9 구현 — §budget-canonical-pick (2026-09-21)

**호영님 권고 승인**: 대시보드 정본 예산 = **오늘이 기간 안에 드는 것 중 가장 최근 시작분.**

### 고친 것

| 파일 | 내용 |
| :--- | :--- |
| `summary-derive.ts` | `canonicalBudgetQuery(userId, now)` 신설 — 기간 필터 + 결정적 정렬을 **질의 인자 값**으로 돌려준다 |
| `api/dashboard/summary/route.ts` | `db.userBudget.findFirst(canonicalBudgetQuery(userId, now))` — 규칙을 직접 짓지 않는다 |

규칙 상세:
- 기간: `startDate <= now` **또는 미선언**, `endDate >= now` **또는 미선언**.
  날짜 없이 만든 기존 예산이 사라지면 안 되므로 null 은 "제한 없음" 으로 읽는다.
- 정렬: `startDate desc nulls last` → `createdAt desc`.
  **2차 정렬이 본체다** — 동점에서 미정이 남으면 이번 결함이 그대로 되풀이된다.

### 왜 함수로 뺐는가

route 안에 인라인으로 두면 sentinel 이 정규식으로 문자열을 더듬는 수밖에 없다.
그건 리팩토링 한 번에 깨지면서 정작 **규칙이 바뀐 것은 못 잡는다**(4원칙이 말하는 그 형태다).
빼두면 `toEqual` 로 질의 인자 자체를 잰다.

🛑 규칙을 JS 로 한 번 더 구현하지 않았다. 고르는 주체는 DB 이고, 같은 규칙을 두 곳에 적으면
한쪽만 바뀌어도 통과한다 — §receive-canonical 에서 이미 본 형태다. 대신 **질의 인자를 값으로 잰다**.

### Sentinel · 검출력 (격리 러너)

`summary-contract-p1.test.ts` → `(H)` 4건.

| 프로브 | 주입 | RED |
| :--- | :--- | :--- |
| `H1-order-drop` | 1차 정렬 제거 | (H)①② |
| `H2-tiebreak-drop` | 2차 정렬 제거 | (H)①② |
| `H3-null-date-excluded` | 날짜 미선언 통과 제거 | (H)①③ |
| `H4-period-filter-off` | 기간 필터 제거 | (H)①③ |
| `H5-route-inline` | route 가 규칙을 직접 짜도록 되돌림 | (H)④ |

### 🛑 이 변경만으로 prod 화면은 **바뀌지 않는다**

실측 두 예산 모두 오늘을 포함하고, 시작일은 검증용(9/20)이 하반기 실측(8/18)보다 나중이다.
→ 규칙을 적용해도 여전히 **검증용 예산**이 뽑힌다.

**그게 맞다.** 이번 커밋이 닫는 것은 "어느 것이 뜰지 모른다" 는 **미정**이지 증상이 아니다.
증상(운영 예산이 안 보임)은 검증용 예산을 지우면 사라지고, 그것은 비가역이라 호영님 몫이다.
같은 규칙이 없으면 예산을 둘 이상 쓰는 순간 다시 나온다.

### 자체 측정

- 핵심 2파일 **93/93**, 영향권 15파일 **134/134**, `guest-scope-leak` **7/7** GREEN(격리 러너 · 비권위).
- 사각지대 1건: **DB 가 실제로 그 한 건을 고르는지**는 정적으로 못 잰다.
  `orderBy` 의 `nulls: "last"` 는 PostgreSQL 에서만 유효하다 — **빌드와 prod 화면이 마지막 판정**이다.

### operator-shell 게이트 지시 (P1-5 + P1-9 합본)

7-F 의 명령과 같다. 커밋 경로에 변동 없음(두 트랙 모두 같은 4개 소스 + 2개 테스트 + 프로브 + 계획서).
빌드 필수 — Prisma 질의 인자가 바뀌었고 `nulls` 옵션은 타입 검사를 받아야 한다.

**배포 후 확인**: 예산 카드 머리가 `· 12.31까지`, `남은 일수 102일`(9/21 기준), `일평균 가능 ₩98,039`.
현재 `· 9월` / `10일` / `₩1,000,000` 이 그 세 칸의 결함 값이다.


---

## 7-I. 🛑 실측이 내 전제를 반증했다 — P1-5 · P1-9 정정 (2026-09-21 · prod API 직독)

배포된 P1-5 를 화면으로 확인하러 갔다가 **안 바뀐 것**을 보고 API 를 직접 읽었다.

```
GET /api/dashboard/summary
  "budget":{"isSet":true,"limit":10000000,"spent":0,"usageRate":0,"periodEnd":null}

GET /api/budgets            ← 예산 관리 화면이 쓰는 것
  {"yearMonth":"2026-09","amount":10000000,"scopeKey":"cmqp6...",
   "description":"[Smoke 검증용 예산 2026-09] | period:2026-09-20~2026-12-30",
   "periodStart":"2026-09-20...","periodEnd":"2026-12-30T23:59:59.000Z",
   "usage":{"totalSpent":0,"usageRate":0}}
```

### 밝혀진 사실 3가지

1. **prod 의 예산 정본은 `UserBudget` 이 아니라 legacy `Budget` 이다.**
   응답 필드가 `yearMonth` · `scopeKey` · `amount` — 전부 `Budget` 모델이다.
   `activeBudget` 이 null 이라 summary 는 **폴백 경로**를 탄다.
2. **기간은 DB 열이 아니라 `description` 문자열에 인코딩돼 있다.**
   `| period:2026-09-20~2026-12-30`. `/api/budgets` 가 정규식으로 파싱해
   `periodStart`/`periodEnd` 를 만들고(route.ts:80–84), 화면은 그 값을 보여준다.
   `Budget` 스키마에 그런 열은 없다 — 스키마만 읽으면 보이지 않는다.
3. **summary 는 그 문자열을 안 읽는다.** `yearMonth` 만 보고 월 예산으로 취급한다.

### 그래서 틀린 것

| 내가 쓴 것 (7-F) | 실측 |
| :--- | :--- |
| "월 단위 폴백 예산은 애초에 이번 달로 질의되므로 두 규칙의 답이 같다 → `periodEnd: null`" | **거짓.** 이 예산의 실제 기간은 **12.30 까지**다. 두 규칙의 답이 다르다 |
| P1-5 가 `남은 일수` 결함을 고친다 | **안 고친다.** `UserBudget.endDate` 를 읽는데 prod 는 그 테이블을 안 쓴다 |
| (7-G ③) 정렬이 없어서 검증용이 뽑혔다 | **부정확.** 폴백 질의의 `yearMonth: 2026-09` 필터 때문이다. `2026 하반기 실측 예산` 은 `yearMonth: 2026-08` 이라 **애초에 후보가 아니었다** |

P1-5 · P1-9 의 코드가 **틀린 것은 아니다** — `UserBudget` 을 쓰게 되면 그대로 맞다.
다만 **지금 쓰이는 경로가 아니다.** 커밋 메시지·문서에서 "실측 결함을 고친다" 는 문장을 뺀다.

### 내가 놓친 절차

P1-4 에서는 "화면이 거는 집합" 을 실측해 맞췄다. P1-5 에서는 **같은 확인을 하지 않았다** —
스키마에 `UserBudget.endDate` 가 있는 것을 보고 그것이 쓰이는 줄 알았다.
🛑 **스키마에 열이 있다는 것은 그 열이 쓰인다는 뜻이 아니다.** 축을 바꾸기 전에
그 축의 값을 **prod 응답에서 직접** 확인한다. 한 번의 API 직독이 두 트랙의 전제를 갈랐다.

### 진짜 결함 (신규 · P1-10)

**같은 예산인데 두 화면이 다른 기간 위에 선다.**

| | 기간 | 지출 산식 |
| :--- | :--- | :--- |
| `/dashboard/budget` | description 파싱 → 9.20~12.30 | 그 기간의 `PurchaseRecord` 합 (`2026 하반기 실측 예산` → 17%) |
| `/dashboard` 예산 카드 | `yearMonth` → 9월 | `thisMonthSpend` (이번 달) |

지금 뽑힌 예산은 양쪽 다 0 이라 드러나지 않을 뿐이다.
`2026 하반기 실측 예산` 이 뽑혔다면 **화면 17% vs 대시보드 0%** 가 나란히 섰을 것이다.
§0-2(₩0 vs 도넛)와 같은 계열이고, 이 트랙이 닫으려던 바로 그 형태다.

**권고**: `description` 의 `period:` 파서를 **공용 모듈로 빼서 양쪽이 같은 함수를 쓰게 한다.**
`/api/budgets/route.ts:80` 의 정규식이 유일한 정본이 되고, summary 폴백이 그것을 불러
`periodEnd` 를 채운다. §receive-canonical 과 같은 처방 — 정본을 하나로.
지출 산식 통일은 그 다음이다(기간이 맞아야 산식을 맞출 수 있다).

🛑 `description` 에 구조화 데이터를 문자열로 넣는 것 자체는 별건이다 —
열 신설은 마이그레이션이라 호영님 판정 사안이고, 그 전에도 **파서 공유만으로 거짓말은 닫힌다.**

### 폴백 경로에도 같은 미정이 있다

`db.budget.findFirst({ where: { scopeKey: { in: [...] }, yearMonth: currentYearMonth } })` — **정렬 없음.**
같은 달 `Budget` 이 둘이면 어느 것이 뜰지 미정이다. 지금은 1건이라 안 드러난다.
P1-9 를 폴백 경로에도 같은 규칙으로 적용해야 완결된다.


---

## 7-J. P1-10 구현 — 예산 기간·지출 정본화 (2026-09-21)

7-I 의 실측을 받아 고쳤다. **호영님 승인 권고**: `description` 의 `period:` 파서를 공용화한다.

### 이미 있던 것

공용 모듈은 **이미 있었다** — `lib/budget/budget-period.ts` 의 `resolveBudgetPeriod`
(§order-budget-reservation P2 가 같은 결함을 고치며 만든 것이다. 헤더에 그렇게 적혀 있다:
"표시(기간)와 합산(창)이 서로 다른 truth 를 본다").
`/api/budgets/[id]` · `/api/orders` · `/api/user-budgets` 는 이미 쓰고 있었고,
**예산 목록(`/api/budgets`)과 대시보드 summary 두 곳만 빠져 있었다.**

🛑 교훈: 결함을 만나면 **그 결함을 이미 고친 모듈이 있는지부터** 본다. 새로 만들 뻔했다.

### 고친 것

| 파일 | 내용 |
| :--- | :--- |
| `lib/budget/budget-period.ts` | `endCalendarDate` 추가 — `periodEnd` 의 달력 날짜 `YYYY-MM-DD` |
| `api/budgets/route.ts` | 인라인 정규식 은퇴 → `resolveBudgetPeriod`. **마지막 복사본**이었다 |
| `api/dashboard/summary/route.ts` | 폴백 예산의 **기간·소진액·scopeKey 를 전부 화면과 같은 것으로** |
| 〃 | 폴백 질의에 `orderBy: createdAt desc` — P1-9 를 실제로 쓰이는 경로에도 |

**왜 `endCalendarDate` 인가**: `periodEnd` 는 `new Date("2026-12-30T23:59:59")` = **로컬** 시각이다.
서버가 UTC 면 그 값을 KST 달력으로 다시 읽을 때 **12-31** 이 된다. 하루가 어긋난다.
그래서 Date 를 거치지 않고 매치된 **원문 문자열**(월 창이면 숫자 조립)을 쓴다.

**지출 산식도 같이 옮긴 이유**: 기간만 고치면 카드 안에서 축이 갈린다 —
기간은 9.20~12.30 인데 소진액은 이번 달치만 세는 카드가 된다. **고치기 전보다 나쁘다.**
그래서 창(`resolveBudgetPeriod`)과 키(`resolveBudgetPurchaseScopeKeys` · §budget-scope-key-mismatch)를
화면과 같은 것으로 맞췄다. `spend.thisMonth` 는 그대로 둔다 — 예산과 무관한 다른 물음이다.

### 이관하지 않은 것 (의도)

`/api/budgets/[id]` 의 period 정규식 **2곳은 남겼다.**
GET:152 는 "저장된 값이 있는가"(없으면 null), PATCH:280 은 수정 시 **원문 문자열 보존**을 묻는다.
`resolveBudgetPeriod` 는 항상 월 창으로 낙하하므로 그 물음에 답할 수 없다 — **다른 명제다.**
sentinel ⑤ 는 "**창**을 만드는 곳" 으로 범위를 좁혔고, ⑤-b 가 그 파일의 창은 모듈에서 온다는 것을 잰다.

### Sentinel · 검출력

`summary-contract-p1.test.ts` (G)②⑤⑤-b⑥⑦⑧⑨ · `budget-period.test.ts` 4건 추가.

| 프로브 | RED |
| :--- | :--- |
| `I1-fallback-null` | (G)② |
| `I2-yearmonth-guess` | budget-period 2건 |
| `I3-lastday-fixed` | budget-period 2건 |
| `I3b-date-roundtrip` | (G)⑦ |
| `I4-list-inline-revive` | (G)⑤ |
| `I5-fallback-order-drop` | (G)⑥ |
| `I6-spend-axis-split` | (G)⑧ |
| `I7-scopekey-drift` | (G)⑧ |

🛑 **검출력 0 을 하나 잡았다.** 첫 `I3` 는 "Date 왕복으로 바꾼다" 였는데 **통과**했다 —
왕복이 값을 바꾸는지가 **러너 시간대에 달려 있다**(UTC·KST 에서는 같은 값이 나온다).
그래서 둘로 쪼갰다: 값으로 잴 수 있는 것(`I3-lastday-fixed`)과,
값으로는 못 재니 **형태**로 막는 것((G)⑦ + `I3b`). 사각지대를 단언 옆에 적어 뒀다.

🛑 **프로브 앵커가 또 끊겼다**(3번째). `I1` 이 구현 변경(`fbPeriod` 지역 변수 도입)으로 ANCHOR MISS.
스크립트가 즉사해서 조용한 통과는 막혔다. **구현을 바꾸면 프로브를 다시 앵커한다** — 이제 기록 3회다.

### 자체 측정

11파일 **164/164 GREEN** (격리 러너 · 비권위). `guest-scope-leak` 별도 7/7.

### 배포 후 기대값 (prod 실측 기준)

폴백 예산 = `Smoke 검증용 예산 2026-09`, 실제 기간 `2026-09-20~2026-12-30`.

| 칸 | 지금(결함) | 배포 후 |
| :--- | :--- | :--- |
| 기간 라벨 | `· 9월` | `· 12.30까지` |
| 남은 일수 | `10일` | `101일` (9/21 기준) |
| 일평균 가능 | `₩1,000,000` | `₩99,009` |
| 소진액 | 이번 달치 | 기간 전체 · 화면과 같은 키 |

검증용 예산은 지출이 0 이라 소진액 변화는 안 보인다.
**소진액 축이 맞는지는 `2026 하반기 실측 예산`(17%)이 뽑혀야 보인다** — 검증용을 지우면 그것이 올라온다.
→ 호영님이 검증용 예산을 지우신 뒤 예산 카드의 소진율이 **예산 관리 화면의 17% 와 같은지** 보는 것이
이 트랙 전체의 마지막 확인이다.

### operator-shell 게이트 지시 (P1-9 + P1-10 합본)

```
npm run -w apps/web test -- src/__tests__/dashboard/ src/__tests__/budget/ src/__tests__/regression/ src/__tests__/inventory/ src/__tests__/meta/
npm run -w apps/web build
npm run red-ledger
```

```
git add apps/web/src/lib/budget/budget-period.ts \
        apps/web/src/lib/dashboard/summary-derive.ts \
        apps/web/src/app/api/budgets/route.ts \
        apps/web/src/app/api/dashboard/summary/route.ts \
        apps/web/src/__tests__/budget/budget-period.test.ts \
        apps/web/src/__tests__/dashboard/summary-contract-p1.test.ts \
        apps/web/scripts/probe-p0-honesty.mjs \
        apps/web/docs/plans/PLAN_main-dashboard-p0-honesty.md
```

⚠️ 경로 명시 필수 — 다른 세션이 지금 `csrf-*` · `inventory` · `dashboard/budget/page.tsx` 를 동시에 고치고 있다.
⚠️ 커밋 메시지에서 **P1-9 를 "실측 결함 수정" 으로 쓰지 말 것** — 7-I 참조.
   P1-9 가 실제로 닫은 것은 `UserBudget` 경로(현재 미사용)와 **폴백 경로**의 미정이다.


---

## 7-K. P1-11 구현 — 예산 상세: 삭제 UI + 날짜 축 정렬 (2026-09-22)

prod 화면을 직접 보다 두 건이 나왔다. 하나는 **내 지시가 실행 불가능했다는 것**이다.

### 🛑 ① 지울 수 없는 화면 — 내 잘못

`DELETE /api/budgets/[id]` 는 RBAC(`isOrgAdminOrOwner`)·감사로그(`enforceAction`)까지 갖춰 있는데
**화면 어디에도 진입점이 없었다.** 상세 화면 버튼은 `내보내기`·`목록`·`견적 보기`·`발주 보기` 뿐이고
목록 화면에도 없다(`page.tsx` 에 "삭제"/"DELETE" 0건).

나는 세션 내내 "비가역이라 호영님이 직접 하세요" 라고 넘겼다. **경로가 있는지 확인하지 않았다.**
실행할 수 없는 지시를 반복해서 드린 것이다.

🛑 교훈: **"사용자가 직접 하세요" 라고 넘기기 전에 그 경로가 화면에 있는지 먼저 확인한다.**
비가역 작업을 사람에게 넘기는 것은 옳지만, 넘길 곳이 없으면 그건 넘김이 아니라 방치다.

### ② 같은 예산이 두 화면에서 하루 어긋남

| 출처 | 종료일 | 잔여 |
| :--- | :--- | :--- |
| description 원문 | `2026-12-30` | — |
| 대시보드(P1-10) | `12.30까지` | `101일` |
| **예산 상세** | **`2026. 12. 31.`** | **`100일`** |

원인 둘 다 내가 `endCalendarDate` 주석에 예고한 형태였다.
- 날짜: `new Date(budget.periodEnd).toLocaleDateString("ko-KR")` — API 가 ISO(UTC)로 내려준 것을
  KST 로 읽어 하루가 밀린다. `periodEnd` 는 로컬 23:59:59 로 만들어져 UTC 로 굳는다.
- 잔여: `totalDays - elapsedDays` — 오늘을 빼서, 오늘을 포함하는 대시보드와 하루 어긋난다.

### 고친 것

| 파일 | 내용 |
| :--- | :--- |
| `api/budgets/[id]/route.ts` | 응답에 `periodEndDate`(달력 날짜) 추가 — `resolveBudgetPeriod` 의 `endCalendarDate` |
| `dashboard/budget/[id]/page.tsx` | 종료일은 그 문자열 그대로 · 잔여일은 **대시보드와 같은 `budgetPace`** · 삭제 버튼 + `ConfirmDialog` |

삭제 UI 설계:
- 확인은 **React 모달**(`ConfirmDialog`). `window.confirm` 은 쓰지 않는다 —
  브라우저 전역 대화상자는 자동 검증을 멈춰 세우고 same-canvas 원칙에도 어긋난다.
- 모달 문구에 **예산 이름과 금액**을 박는다. 무엇을 지우는지 눈으로 확인시킨다.
- 권한은 **서버가 판정**한다. 화면이 역할로 버튼을 숨기지 않는다 — 숨기면 왜 안 되는지 알 수 없다.
- 실패하면 모달을 연 채 사유를 destructive 로 띄운다. `router.push` 는 **성공 경로에만** 있다.

### Sentinel · 검출력

신규 `budget-detail-delete-axis.test.ts` 7건.

| 프로브 | RED |
| :--- | :--- |
| `J1-delete-button-gone` | ① |
| `J2-window-confirm` | ② |
| `J3-fail-looks-ok` | ③ |
| `J4-date-roundtrip-revive` | ⑤ |
| `J5-local-daycount` | ⑥ |
| `J6-api-drops-calendar` | ⑦ |

🛑 **검출력 0 을 또 하나 잡았다.** ⑤의 첫 단언이
`toMatch(/budget\.periodEndDate[\s\S]{0,200}?toLocaleDateString/)` 였는데,
**두 토큰이 그 순서로 있다**는 것만 봐서 삼항의 조건을 뒤집어도 통과했다(J4 통과).
삼항의 **어느 분기가 무엇을 쓰는지**로 바꾸자 RED. 순서는 명제가 아니다 — 4원칙에 한 줄 더 붙는다.

또 하나: ③의 창을 `indexOf("catch")` 로 열었더니 `res.json().catch(...)` 가 먼저 걸렸다.
구문상의 catch 절(`} catch (`)을 경계로 바꿨다(4원칙 ②).

### 자체 측정

12파일 **179/180**. 유일한 실패는 `tenant-scope-coverage` 의 `GET /api/invites/[token]` —
**내가 건드린 파일이 아니다.** 같은 파일의 `budgets/[id] isOrgAdminOrOwner` 오분류 회귀 핀은 통과한다.
전부 격리 러너(비권위).

### operator-shell 게이트 지시 (P1-11)

```
npm run -w apps/web test -- src/__tests__/dashboard/ src/__tests__/budget/ src/__tests__/regression/ src/__tests__/security/ src/__tests__/meta/
npm run -w apps/web build
npm run red-ledger
```

```
git add apps/web/src/app/api/budgets/\[id\]/route.ts \
        apps/web/src/app/dashboard/budget/\[id\]/page.tsx \
        apps/web/src/__tests__/dashboard/budget-detail-delete-axis.test.ts \
        apps/web/scripts/probe-p0-honesty.mjs \
        apps/web/docs/plans/PLAN_main-dashboard-p0-honesty.md
```

⚠️ `page.tsx` 는 **CRLF 파일**이다. 삽입분도 CRLF 로 맞췄다(CR 556 = LF 556).
   `.gitattributes` 가 `*.tsx text eol=lf` 라 커밋은 LF 로 정규화된다 — diff 는 손댄 줄만 나온다.

### 배포 전 실측 (2026-09-22 · prod · 로그인 세션)

결함 상태를 눈으로 확정해 뒀다 — 배포 후 전후 비교의 기준값이다.

| | 값 |
| :--- | :--- |
| `설명`(원문) | `period:2026-09-20~2026-12-30` |
| 화면 기간 | **`2026. 9. 20. ~ 2026. 12. 31.`** ← 하루 밀림 |
| 화면 잔여 | **`잔여 99일`** · `경과 3일 / 102일` |
| summary API | `"periodEnd":"2026-12-30"` (P1-10 반영분) |
| 상단 버튼 | `내보내기` · `목록` — **삭제 없음** |

**배포 후 확인**: ① 상단에 `삭제` 버튼 ② 기간 끝이 `2026. 12. 30.`
③ `잔여` 가 대시보드 `남은 일수` 와 **같은 수**(절대값은 날짜에 따라 움직인다 — 같은지만 본다).
그리고 삭제 버튼으로 검증용 예산을 지울 수 있다.


---

## 7-L. ✅ P1-11 배포·실측 완료 (2026-09-22 · 커밋 `74b55b8b`)

게이트: 테스트 5축 721파일 — 실패 103 · 신규 RED **0** · 해소 8 / 빌드 exit 0 / red-ledger 신규 0 · 래칫 **7/7**.
`/api/health` `deployedCommit = 74b55b8b`, 동승 커밋 0.

### 화면 실측 — 세 축이 같아졌다

| | 배포 전 | 배포 후 |
| :--- | :--- | :--- |
| 상세 상단 버튼 | `내보내기` · `목록` | `내보내기` · `목록` · **`삭제`** |
| 상세 기간 끝 | `2026. 12. 31.` | **`2026. 12. 30.`** |
| 상세 잔여 | `99일` | **`100일`** |
| 대시보드 남은 일수 | `100일`(같은 날 기준) | **`100일`** — 같다 |
| description 원문 | `period:…~2026-12-30` | (불변) |

원문 · 대시보드 · 상세가 **같은 날짜**를 말한다. 이 트랙이 닫으려던 형태가 이것이다.

### 🛑 operator-shell 이 잡아준 내 오류 2건

**① 7-K 의 CRLF 지시가 틀렸다.**
나는 "`page.tsx` 는 CRLF 파일이니 삽입분도 CRLF 로 맞췄다" 고 적었다.
그런데 **HEAD 는 LF** 이고 `.gitattributes` 가 커밋 시 LF 로 정규화한다.
CRLF 상태로 게이트를 돌리면 **커밋될 판본과 다른 바이트를 재게 된다.**
operator 가 먼저 LF 로 맞추고 diff 불변(+72 −2)을 확인한 뒤 쟀다.
→ 교훈: 워킹카피의 EOL 을 보존하는 것과, **게이트가 커밋될 바이트를 재는 것**은 다른 문제다.
   `.gitattributes` 로 정규화되는 저장소에서는 **재기 전에 정규화**한다.

**② em dash 가 신규 테스트 파일 제목에서 또 막혔다(2번째).**
pre-commit 이 7건을 잡았고 전부 `describe`/`it` 제목이었다. `·` 로 바꿔 통과.
→ 교훈: **신규 테스트 파일의 describe/it 제목에는 처음부터 `·` 를 쓴다.**
   주석·본문은 예외지만 제목은 UI 문자열과 같은 취급을 받는다. 같은 자리에서 두 번 걸렸다.

**③ operator 의 추가 판정 하나 — 원장 대조의 사각지대.**
`tenant-scope-coverage` A4 는 원장에 이미 오른 RED 다. 그런데 **원장 대조는 테스트 이름으로만 한다** —
새로 붙은 `DELETE /api/budgets/[id]` 가 소유권 검사 없이 그 목록에 끼어도 이름이 같아 조용히 통과한다.
operator 가 실패 **본문**을 열어 목록이 `GET /api/invites/[token]` 1건뿐임을 확인했다.
→ 교훈: **원장에 이름이 있다고 넘기지 않는다.** 내 변경이 그 목록에 새로 들어갔는지는 본문으로만 안다.

### 남은 것

- 검증용 예산 삭제 — 이제 화면에서 가능하다(호영님).
- 삭제 후 대시보드 소진율이 예산 관리 화면의 17% 와 같은지 — **이 트랙의 마지막 확인**.
- 폰에서 파이프라인 3카드 세로 1열(Smoke C) · 진단용 견적 삭제 여부.


---

## 7-M. 🛑 크롬으로 눌러 보고서야 나온 결함 — 모달 문구 em dash (2026-09-22)

호영님 지시로 배포된 삭제 버튼을 **실제로 눌러** 검증했다(모달까지만, 확인은 누르지 않고 취소).

모달은 정상이었다 — 이름·금액 정확, React 모달(전역 대화상자 아님), 취소로 닫히고 예산 보존.
**그런데 문구에 em dash 가 있었다.**

```
Smoke 검증용 예산 2026-09 · ₩10,000,000 — 삭제하면 되돌릴 수 없습니다.
                                        ↑ 구분자로 쓰인 em dash
```

내가 쓴 문구다. 게이트·빌드·red-ledger 를 **전부 통과**하고 prod 까지 갔다.

### 왜 안 잡혔나 — 구조적 구멍

`.husky/pre-commit:39` 은 **신규 추가 파일만** em dash 를 검사한다.

```
# ── 1. 신규 추가 파일: eslint + em dash 구분자 (스테이징 기준) ──
echo "$added" | xargs npx tsx scripts/check-em-dash-new-files.ts
```

- 내 **신규** 테스트 파일은 잡혔다(제목 7건, `·` 로 교체 후 커밋).
- `budget/[id]/page.tsx` 는 **수정(M)** 이라 검사를 아예 안 받았다.

→ **기존 파일에 새로 들어가는 em dash 는 아무도 보지 않는다.**
   신규 파일만 거는 설계는 출발이 합리적이다(기존 파일에는 주석 em dash 가 많아 전수 검사하면 전부 RED).
   그 대가로 이 구멍이 남았다.

### 권고 — 파일이 아니라 **추가된 줄**을 본다

`git diff --cached -U0` 의 `+` 줄에서만 em dash 를 찾는다.
기존 em dash 는 건드리지 않고 **새로 들어오는 것만** 막는다. 주석 줄은 제외(현행 규칙 유지).

⚠️ 이 훅은 **모든 세션이 공유**한다. 내가 임의로 바꾸지 않았다 — 다른 세션의 커밋이 갑자기 막힐 수 있다.
   호영님 판정 사안으로 올린다.

### 이번에 한 것

- 문구 `—` → `·` 로 교체. 이 파일의 비주석 em dash 0 확인(주석 1건은 조항상 허용).
- sentinel `(J)⑧` 추가 — 모달 문구 창에서 em dash 부재 + 이름·금액 존재를 함께 잰다.
- 프로브 `J7-modal-emdash` 로 검출력 실증(재주입 → RED).

### 🛑 "정적 단언의 사각지대" 에 한 건 추가

지금까지 이 트랙에서 화면·원문 대조로만 잡힌 결함이 5건이 됐다.
이번 것은 성격이 다르다 — **게이트가 그 파일을 아예 보지 않았다.**
sentinel 이 약한 게 아니라 **검사 대상 집합에 없었다.**

→ 교훈: 단언의 강도만 보지 말고 **그 단언이 이 파일에 걸리기는 하는지**를 확인한다.
   "게이트를 통과했다" 는 "검사받았다" 와 다르다.


---

## 7-N. §em-dash-added-lines 구현 — 검사 대상 집합을 넓힌다 (2026-09-22 · 호영님 권고 승인)

7-M 의 구멍을 닫았다. **파일이 아니라 이번 커밋이 추가한 줄**을 본다.

### 고친 것

| 파일 | 내용 |
| :--- | :--- |
| `_helpers/em-dash-scan.ts` | `parseAddedLines(diffText)` 추가 — `git diff -U0` → 파일별 추가 줄 번호 |
| `scripts/check-em-dash-added-lines.ts` | 신규. 얇은 실행부(diff 호출 + 필터 + 출력) |
| `.husky/pre-commit` | `1-B` 블록 추가 — `--diff-filter=M` 인 `.ts/.tsx` 가 있을 때만 실행 |

**왜 판별기를 새로 안 만들었나**: `violations()` 가 정본이다(주석 제외 · placeholder 허용).
판별(무엇이 위반인가)과 범위(어느 줄을 보는가)를 한 파일에 둔다 — 두 벌이 되면 갈라진다.

**왜 줄 단위인가**: 레거시 6,926건(1,599파일). 파일 전체를 걸면 그 파일을 건드리는 순간 전부 RED 가 된다.

### 검증

- `parseAddedLines` 단위 계약 **7건** — hunk 시작 번호 · 다중 hunk · 확장자 필터 ·
  파일 경계(앞 파일 상태 누출 0) · **삭제만 있는 hunk 는 아무 줄도 만들지 않는다**(지우기만 해도 RED 면 안 된다) ·
  `+++` 헤더 오인 0 · 빈 diff. 전부 값 단언.
- 🛑 **실물 실증 — 이 게이트가 내 코드를 먼저 잡았다.**
  현재 작업 트리의 실제 diff 에 돌려 보니 `budget-detail-delete-axis.test.ts:68` 이 걸렸다.
  내가 방금 쓴 sentinel 의 **에러 메시지 문자열**에 `—` 가 구분자로 들어 있었다. 고쳤고 지금은 0건.
  같은 검사로 다른 세션이 건드린 파일 4개는 0건 — **폭탄이 아니다.**
- 공용 `.git/index` 는 건드리지 않았다. `GIT_INDEX_FILE` 로 임시 index 를 써서 시뮬레이션했고,
  검사 후 staged 0 을 확인했다(병렬 세션 안전).

### 🛑 자체 검증의 한계 — operator 가 확인할 것

이 샌드박스에서는 **스크립트를 실행할 수 없다.** `tsx` 가 Windows 용 esbuild 를 집어 즉사한다
(7-F 에 적은 그 구조적 제약과 같은 원인). 그래서 잰 것은 **파싱 로직(단위 7건) + 실제 diff 적용 결과**이고,
실행부(`execSync` 경로 · 종료코드 · 훅 배선)는 **operator 의 첫 커밋이 곧 검증**이다.

⚠️ **이 훅은 모든 세션의 커밋 경로에 있다.** 실패하면 전 세션이 막힌다.
   - 커밋 시 `── 수정 파일 N개 · 추가된 줄 em dash 검사 (pre-commit)` 줄이 **찍히는지** 먼저 본다.
     안 찍히면 조건(`$modified`)이 안 잡힌 것이다.
   - 스크립트가 위반이 아니라 **예외로** 죽으면 stderr 에 esbuild/모듈 오류가 나온다. 위반 출력과 모양이 다르다.
   - 롤백: `.husky/pre-commit` 의 `1-B` 블록만 지우면 즉시 원복된다(다른 조항과 독립).

### operator-shell 게이트 지시 (7-M + 7-N)

```
npm run -w apps/web test -- src/__tests__/dashboard/ src/__tests__/budget/ src/__tests__/meta/ src/__tests__/regression/ src/__tests__/security/
npm run -w apps/web build
npm run red-ledger
```

```
git add .husky/pre-commit \
        scripts/check-em-dash-added-lines.ts \
        apps/web/src/__tests__/_helpers/em-dash-scan.ts \
        apps/web/src/__tests__/meta/em-dash-added-lines.test.ts \
        apps/web/src/__tests__/dashboard/budget-detail-delete-axis.test.ts \
        apps/web/src/app/dashboard/budget/\[id\]/page.tsx \
        apps/web/scripts/probe-p0-honesty.mjs \
        apps/web/docs/plans/PLAN_main-dashboard-p0-honesty.md
```

이번 커밋에는 M 파일이 포함되므로 **새 훅이 스스로에게 먼저 걸린다** — 그게 첫 실증이다.


---

## 7-O. ✅ 훅 배포·실측 · em dash 3회차 실효 조치 (2026-09-23)

`/api/health` `deployedCommit = ba826de4`. 커밋 1개, 동승 0.

### 화면 실측

| 확인 | 결과 |
| :--- | :--- |
| 삭제 모달 문구 구분자 | `Smoke 검증용 예산 2026-09 · ₩10,000,000 · 삭제하면…` — **`·` 반영** |
| 모달 동작 | 이름·금액 표시 · 취소로 닫힘 · 예산 보존 (확인 버튼 누르지 않음) |
| 상세 `잔여` | `99일` |
| 대시보드 `남은 일수` | `99일` — **같다** |
| 일평균 가능 | `₩101,010` = 10,000,000 / 99 |

날짜가 하루 지나 100 → 99 로 함께 줄었다. **두 화면이 같은 축 위에서 함께 움직인다** — 절대값이 아니라 이것이 판정이다.

### 🛑 operator 가 실행부를 메웠다

샌드박스는 `tsx` 를 못 돌려 실행부를 잴 수 없었다(7-N 에 한계로 적었다).
operator 가 **임시 git 저장소**에서 6가지 경우를 돌려 그 자리를 메웠다 —
변경 없음 · 깨끗한 추가 · 구분자 추가(RED) · placeholder/주석만 · 삭제만 · `sh -e` 블록.
그리고 커밋 시 `── 수정 파일 3개 · 추가된 줄 em dash 검사` 안내 줄이 찍히고
다음 블록까지 도달하는 것을 확인했다. **훅은 첫 실행부터 정상 동작했다.**

operator 가 덧붙인 한계 하나: **기존 em dash 가 있는 줄을 다른 이유로 고치면 그 줄도 "추가된 줄"이 된다.**
줄을 건드리면 그 줄의 구분자도 함께 고치라는 뜻이라 의도된 동작으로 뒀다.

### 🛑 em dash 제목 — 3회차. 기록만으로는 안 고쳐진다

신규 테스트 파일의 `describe`/`it` 제목이 pre-commit 에 막힌 것이 **세 번째**다.
세 번 모두 같은 자리였고, 나는 매번 막힌 뒤에 그 줄만 `·` 로 바꿨다.
계획서에 두 번 적었는데 세 번째가 났다 — **기록은 조치가 아니다.**

원인은 의지가 아니라 문체다. 한국어 삽입구에서 `—` 가 자연스럽게 나온다.
그래서 "안 쓰겠다" 가 아니라 **쓰고 나서 반드시 검사**하는 것으로 절차를 바꾼다.

**절차 (신규·수정 테스트 파일을 쓴 직후, 커밋 전):**

```
for f in $(git diff HEAD --name-only | grep -E '__tests__.*\.ts$'); do
  grep -n 'describe(\|  it(' "$f" | grep '—' && echo "  ↑ $f"
done
```

정본은 여전히 훅(`violations()`)이다. 이건 **왕복을 없애기 위한 1차 스크리닝**이지 판별기가 아니다
(두 벌을 만들지 않는다는 원칙과 충돌하지 않는다 — 판정하지 않고 눈에 띄게만 한다).
2026-09-23 현재 작업분에 돌려 **0건** 확인.

### Smoke C — ✅ 통과 (2026-09-23 · 정정)

🛑 처음에 "`resize_window` 가 뷰포트를 안 바꾸니 실행 불가 확정" 이라고 적었다. **틀렸다.**
도구 하나가 안 먹은 것을 방법 전체가 없는 것으로 일반화했다(호영님 지적).

**방법**: 로그인된 탭에서 같은 origin 의 `/dashboard` 를 **390×844 iframe** 으로 띄운다.
iframe 안은 자기 폭으로 미디어쿼리를 판정한다 → `innerWidth 388` · `(min-width:768px)` **false**.
⚠️ 로그인은 iframe **밖** 최상위 탭에서 한다 — Google OAuth 는 프레임 안 로딩을 403 으로 막는다.

**측정(DOM 좌표 · 눈대중 아님)**

| 카드 | x | y | w |
| :--- | :--- | :--- | :--- |
| 견적 | 12 | 326 | 334 |
| 입고 | 12 | 434 | 334 |
| 재고 | 12 | 538 | 334 |

- 세 카드 **x 동일 · y 증가 · 폭 동일** → 세로 1열.
- 칩 `발송 대기 4` · `안전재고 미달 1`: `scrollWidth > clientWidth` **0** · 카드 경계 밖 **0** → 잘림 없음.
- 문서 가로 넘침(`scrollWidth > innerWidth`) **0**.

---

## 7-P. §sandbox-git-lock — 원인 규명과 CLAUDE.md 이관 (2026-09-23 · 호영님 승인)

operator 가 물었다: 샌드박스가 git 을 직접 실행하는지, 실행 중 끊긴 적이 있는지.
답은 **원인이 샌드박스가 맞다. 다만 끊겨서가 아니다.**

### 결정적 관측

```
touch .git/__probe_unlink   → 성공
rm    .git/__probe_unlink   → Operation not permitted
```

샌드박스는 `.git/` 에 **쓸 수는 있고 지울 수는 없다.** 그래서 git 이 만든 lock 이
정상 종료 후에도 남는다. 이 세션이 실제로 받은 경고가 그 증거였다:

```
warning: unable to unlink '.../.git/index.lock': Operation not permitted
warning: unable to unlink '.git/objects/db/tmp_obj_dnXr1a': Operation not permitted
```

### 4조건 판정이 왜 틀렸나

0바이트 · git 프로세스 0 · 시간 경과 — 세 조건이 **항상 맞아떨어지는 게 당연하다.**
git 은 정상 종료했고 락만 못 지웠으니까. operator 가 세 번 "다른 세션 것" 으로 판정했는데,
프로세스가 없다는 것은 **소유자를 확인할 수 없다**는 뜻이지 아니라는 증거가 아니었다.
셋 다 샌드박스 것이었을 것이다.

🛑 이 형태의 오판은 sentinel 에서 본 것과 같다 — **부재를 증거로 쓴 것.**
"프로세스가 없다 → 남의 것" 은 "게이트를 통과했다 → 검사받았다" 와 같은 비약이다.

### 조치

CLAUDE.md `§병렬 세션 1-b` 로 이관했다(호영님 승인 2026-09-23). 세션마다 다시 진단하지 않는다.
샌드박스는 read-only git 에 `--no-optional-locks` 를 쓰고, `.git/` 에 쓰는 명령은 쓰지 않는다.
🛑 `GIT_INDEX_FILE` 만으로는 부족하다 — index 는 갈라지지만 object store 는 공용이다.
2026-09-22 훅 검증 때 그렇게 임시 파일을 남겼고 operator 가 청소했다(`git fsck` 오류 0).

### 내가 진단하다 하나 더 만들었다

`touch .git/__probe_unlink` 로 권한을 확인한 뒤 지우지 못했다.
원인을 밝히려다 같은 종류의 쓰레기를 하나 더 남긴 것이다.
**권한을 모르는 디렉터리에서 프로브 파일을 만들지 않는다** — 읽기만으로 확인할 방법을 먼저 찾는다.


---

## 7-Q. 🛑 삭제 버튼이 prod 에서 CSRF 에 막혔다 (2026-09-24 · 호영님 실사용)

호영님이 승인 후 삭제 버튼을 눌렀고 토스트가 떴다:
`삭제 실패 · 보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.` (`csrf-contract.ts` `missing_token`)

**원인**: 내가 `fetch(\`/api/budgets/${id}\`, { method: "DELETE" })` 를 raw fetch 로 썼다.
CSRF 토큰이 실리지 않아 미들웨어가 403 으로 막았다. 저장소 규칙은 변이 요청 = `csrfFetch` 다
(`organizations/page.tsx:244` 주석에 같은 사고가 이미 기록돼 있었다).

**내가 모달까지 눌러 보고 "정상" 이라고 판정한 것이 틀렸다.** 확인 버튼을 누르지 않았으니
요청이 서버에 닿는 경로는 한 번도 재지 않았다. 모달이 뜨는 것과 삭제가 되는 것은 다른 명제다.
그리고 sentinel ① 은 "DELETE 를 부른다" 만 물었지 **어떻게 보내는지**는 묻지 않았다.

**다행인 것**: 실패를 성공처럼 보이지 않았다 — ③ 단언대로 모달이 닫히지 않고 destructive 토스트가 떴고
목록으로 보내지 않았다. 호영님은 삭제됐다고 오인하지 않았다.

**고친 것**: `csrfFetch` 로 교체 + sentinel `①-b` (csrfFetch 사용 + 이 화면 raw fetch 변이 0) +
프로브 `J8-raw-fetch-delete`(되돌리면 RED). 9/9 GREEN.

⚠️ **구조적 구멍**: 저장소 전체에 "raw fetch 로 변이 요청을 보내지 않는다" 래칫이 없다.
em dash 게이트와 같은 모양이다 — 규칙은 있는데 **새로 들어오는 위반을 보는 장치가 없다.**
별도 트랙으로 권고한다(추가된 줄의 raw fetch 변이를 pre-commit 에서 막는 방식이 가장 싸다).

## 7-R. §raw-fetch-mutation 래칫 · 저장소를 훑자 알림 읽음도 prod 403 이었다 (2026-09-24 · 호영님 승인)

**판별기** `__tests__/_helpers/raw-fetch-scan.ts`: `fetch(` 중 첫 인자가 `/api/` 리터럴이고 method 가 변이인 것.
csrfFetch · GET · 주석 · 외부 URL 은 제외. **exempt 판정은 CSRF registry(`resolveCsrfConfig`) 를 그대로 쓴다**
(공개 토큰 페이지 3곳은 exempt 라 raw fetch 가 맞다. 두 벌로 두면 갈라진다).
한계: URL 이나 init 을 변수로 넘기면 판별하지 못한다.

**저장소 전량 실측** (서버 라우트 · 테스트 제외 1,719파일): 리터럴 변이 5건 → exempt 3 · **비exempt 2**.
비exempt 2건 = `components/dashboard/Header.tsx:83 · :216` 알림 읽음(개별 · 모두 읽음).
prod 확인: `POST /api/notifications/<없는 id>/read` (raw) → **403 「보안 검증이 완료되지 않아…」**.
알림을 눌러도 읽음이 안 됐고, 「모두 읽음」 은 fetch 가 403 에 reject 하지 않아 **조용히 끝났다**.

**고친 것**
- Header.tsx 2곳 → `csrfFetch`. 개별은 `onError` 토스트, 모두 읽음은 실패 건수를 세서 토스트.
- `meta/raw-fetch-mutation.test.ts` ①~⑧ 판별기 계약 · ⑨ 저장소 전량 0건 · ⑩ Header 명제. 10/10 GREEN.
  Header 를 HEAD 로 되돌리면 ⑨⑩ RED (`Header.tsx:83 · :216 POST /api/notifications/x/read`), 복원 후 GREEN.
- pre-commit **1-C** + `scripts/check-raw-fetch-added-lines.ts`: 신규·수정 파일의 **추가된 줄**에 걸친 raw fetch 변이 차단.
  실측: 수정본 diff → exit 0 · raw POST 한 줄 주입 → `655 fetch POST /api/budgets` exit 1.

레거시가 0이 됐으므로 ⑨ 가 전량을 잠그고, 훅은 커밋 시점에 먼저 막는다.

## 7-S. 🛑 검증용 예산을 지우자 대시보드가 「예산 미설정」 이 됐다 (2026-09-24 · prod 실측)

호영님이 삭제 확인을 눌렀다. 삭제는 성공했다 (상세 GET 404 · 목록 1건 = 「2026 하반기 실측 예산」).
기대값은 대시보드 예산이 하반기 예산으로 바뀌는 것이었는데, `/api/dashboard/summary` 는 `budget.isSet=false` 였다.

**원인**: 폴백 질의가 `yearMonth: currentYearMonth` 로 예산을 걸렀다. 하반기 예산은 yearMonth `2026-08`
(만든 달), 기간 8.18~12.30. 9월에는 기간 안인데 질의에서 빠졌다. 예산 관리 화면은 기간으로 보니 보여 준다.
**P1-10 에서 기간 해석을 resolveBudgetPeriod 로 옮기면서 "고르는 창" 은 yearMonth 로 남겨 뒀다.**
검증용 예산이 yearMonth `2026-09` 라서 이 결함을 가리고 있었다. 지우자 드러났다.

**고친 것**
- `lib/budget/budget-period.ts` `pickBudgetCoveringNow(rows, now)`: 기간이 now 를 포함하는 것 중 최근 생성분.
- summary route 폴백: `findMany`(yearMonth 필터 없음, scopeKey 범위 그대로) → `pickBudgetCoveringNow`.
- `summary-contract-p1` ⑥ 명제 교체 + (I) 값 단언 ①~⑤. 37/37 GREEN. route 를 되돌리면 ⑥ RED, 복원 후 GREEN.

**배포 후 확인할 것**: 대시보드 예산 = 「2026 하반기 실측 예산」 · 소진율이 예산 관리 화면의 소진율과 같은지.

---

## 8. Optional Addenda

### D. Mobile Addendum (U3 결과에 따라 활성)
- Surface: `src/components/dashboard/mobile-dashboard-view.tsx` (웹 반응형, Expo 아님)
- **Validation**
  - [ ] 375px 잘림 0
  - [ ] 파이프라인 1열 전환
  - [ ] 하단 고정 빠른 실행 바와 충돌 0 (FAB 제거로 z-index 경합 해소 확인)

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 은퇴 sentinel이 살아있는 명제를 함께 폐기 | Med | High | 은퇴 전 명제 4열 표 작성 · 새 파일 이관 후 grep 확인 |
| `mobile-dashboard-view` 동시 회귀 | Med | Med | Phase 0 U3에서 소비 지점 실측 후 T6로 편입 |
| 병렬 3세션 공유 워킹카피 — pre-push가 남의 미커밋 파일에 인질 | Med | Med | 세션별 `NEXT_DIST_DIR` · `NEXT_TSCONFIG` 사용. 막히면 처방을 상대 세션에 전달하고 다른 축 작업 |
| push가 남의 미검증 커밋을 동승 | Med | Med | `git log --oneline @{u}..HEAD` 로 실린 전량 확인 후 보고에 동승분 구분 명시 |
| 도넛 기간 라벨 미승인 시 T3 대안(소스 교체)이 분포 손실 | Low | Med | 승인 전까지 T3 보류. T1·T2·T4·T5 선행 가능 |
| 주입 프로브 조용한 실패로 무효 단언 land | Med | High | 「적용 확인 → 주입 → RED」 절차 고정 · 프로브는 파일로 작성 |

---

## 10. Rollback Strategy

- Phase 1 실패: 신규 sentinel 파일 삭제 + 은퇴 커밋 revert → 기준선 복귀
- Phase 2 실패: T1~T6 개별 컴포넌트 revert (상호 의존 0)
- Phase 3 실패: Phase 2 커밋 전량 revert 1회

**Special Cases**
- DB migration: 없음
- Billing: 없음
- Webhook: 없음
- Feature flag: 불필요 (표시 규율 한정)

---

## 11. Progress Tracking

- Overall completion: 98% (Phase 0·1·2 완료 · Smoke A·B·D·5 통과 — C 만 실행 불가로 대기)
- Current phase: Phase 3 — Smoke A·B·D·5 통과. C(모바일 375px) 호영님 폰 확인 대기
- Current blocker: Smoke C 실행 불가(브라우저 resize 미반영) · 검증용 예산 `cmu95g02y…` 삭제 판정
- Next validation step: 폰에서 파이프라인 1열·칩 잘림 확인 → Phase 3 마감 → P1 착수

**Phase Checklist**
- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [ ] Phase 3 complete (C 대기)

---

## 12. Notes & Learnings

**Blockers Encountered**
- [2026-09-17] T3 도넛 기간 라벨 정직화 → 승인 대기
- [2026-09-17] B1 Cowork Linux 셸에서 rollup 네이티브 바이너리 부재로 vitest·build·red-ledger 실행 불가 → operator-shell 위임. 공유 node_modules 설치는 금지 조항으로 차단(우회 시도 0).
- [2026-09-19] 호영님 판정 3건 반영: B군 3건 핸드오프대로 · 입고 칩 P0 제외(P1) · T3 `· 최근 6개월` 병기.
- [2026-09-19] 계획서의 결함 규모 `6개월 ₩44,634,000` 은 guest-demo 데모 데이터 혼입값. **prod 실제 누계 ₩850,000(1행)** — 명제는 유효하나 규모는 작다(다른 세션 prod 실측).
- [2026-09-18] **Sandbox 선행 RED 판정 오류 (3건 → 실제 16건).** 원인: `node` 앵커 대조가 파일 단위라 `it` 단위 실패를 세지 못했다. operator-shell 실측이 정정. 이후 모든 게이트 수치는 operator-shell 프로젝트 러너 실측만 인용한다.

**Implementation Notes**
- 핸드오프 §0-2는 mock이 아니라 **엔드포인트 2개의 기간 불일치**였다. `stats/route.ts:283` 이 6개월, `summary` 가 이번 달.
- 핸드오프 §3의 담당자 아바타는 문서 상단 "담당자 단일 운영 기준, 역할별 분기 없음" 과 충돌 → P1에서 재확인 필요.
- §2 4단계 트랙의 `멤버 ≥2명` 파생은 현행 summary 계약에 없다. P1 진입 시 API 확장 범위.
