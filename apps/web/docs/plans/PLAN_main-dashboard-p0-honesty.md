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
| P1-5 | `남은 일수` 축 재검토 — 현재 **이번 달 말일** 기준인데 예산 기간이 분기·반기면 어긋난다(실측: 예산 12.31 까지인데 11일로 표시) | 호영님 판정 |
| P1-6 | `blockFrom` 류 블록 창 헬퍼 **4벌 중복**(신규 파일 · p3b · p4 · won-glyph) → `_helpers/` 통합 | 없음 · **완료** → 7-D |
| P1-7 | `recommendedActions` 배열이 JSX 소비 0 인데 `302d6a4g:64` 가 핀해 살아 있다 | 그 sentinel 트랙 |
| P1-8 | 원장 stale 해소 7건(§11.257 6 + 258sweep 1) `--update` | 별도 커밋 |


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

**화면 영향**: 입고 카드의 칩이 실제로 뜨고 사라진다. 배포 후 `/dashboard` 에서
입고 칩이 `조치 필요 N` 인지 `이상 없음` 인지 확인하고, 눌러서 착지 화면의 건수와 **같은지** 본다 —
이번 결함이 정확히 그 불일치였다.

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
