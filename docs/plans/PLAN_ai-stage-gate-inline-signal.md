# Implementation Plan: 소싱 AI surface — inline 신호 + 단계 게이트 (§1-3, §1-2⑦ 흡수)

- **Status:** ✅ Complete (코드 — 클로드코드 vitest/tsc/build PASS + push 대기)
- **Started:** 2026-06-08
- **Last Updated:** 2026-06-08
- **Estimated Completion:** TBD

**CRITICAL INSTRUCTIONS** (각 phase 완료 후):
1. ✅ 체크박스 갱신 2. 🧪 quality gate 검증(실행 불가는 표기, 클로드코드 실행) 3. ⚠️ 전 항목 PASS 4. 📅 Last Updated 5. 📝 Notes 6. ➡️ 다음 phase

⛔ quality gate 실패 / source-of-truth 충돌 미해소 / dead button·no-op·placeholder success 도입 시 진행 금지.
⛔ 잠긴 P0 테스트(§11.265c·268b·265b-2·305) 맹목 폐기 금지 — assertion별 보존/supersede 분류 후에만.

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `HANDOFF_sourcing-scan-product-2026-06-08.md` §1-3 + §1-4(단계 게이트 확정) + §4(관통 원칙) + §1-2⑦.
- 호영님 lock(2026-06-08): "별도 AI 버튼/패널 금지, ontology=inline 신호·단계 게이트, 조숙 분석 금지". #1 helper 패턴 재사용 합의.

**Secondary References (코드 실측):**
- `lib/ai/suggestion-engine.ts` `generateSearchSummary` = **순수 룰 기반**(가격차 %·비교후보 수·납기 누락·단일공급사 null/threshold) → `SearchSummaryLine[] {text, signal: info|compare|request|caution}`. **스코어링/모델 아님.**
- `app/_workbench/search/page.tsx` — Operating Status Bar: 정렬 select("AI 추천순")·필터·"AI 분석" 트리거(`setAiAnalysisSheetOpen`/`sourcing-ai-analysis-trigger`) + AI 분석 시트(`sourcing-ai-analysis-sheet`, §11.265b-2 latent) + inline AI 제안/TRIAGE(hidden md:block).
- `app/_workbench/compare/page.tsx` — "AI 비교 분석"(§11.305 lock), 비교 적합도.
- `app/_components/ai-section.tsx` = 랜딩 마케팅 섹션(정적, §1-3 타깃 아님 — 건드리지 말 것).

**git 계보 (§11.265c "왜 박혔나"):** §11.265b-2(AI 분석 시트 shell) → §11.265c(트리거+필터, 호영님 spec "검색바 1줄: 8건 [AI 추천순▾] [필터] [AI 분석]") → §11.268b(3버튼 outline 통일) → §11.305(AI 비교 분석 lock P0). 당시 "AI 분석" framing은 **의도적 호영님 P0**(조숙 아님).

**Conflicts Found:**
- §11.265c/268b/265b-2/305 (과거 P0 "AI 분석 버튼/시트") ↔ §1-3/§4 (현재: 별도 AI 버튼 금지, inline 신호). = 전략 전환.
- §1-2⑦ "AI 추천순"→"추천순" ↔ 265c·268b 테스트가 "AI 추천순" 리터럴 lock.

**Chosen Source of Truth:** 최신 §1-3/§4 win(전략 전환). 단 §11.265c **레이아웃/필터/정렬 select 보존**, "AI 분석 버튼·시트"만 제거. 엔진(`generateSearchSummary`)은 룰 기반이라 **보존**, surface만 시트→inline chip+배너. assertion별 분류로 회귀 통제.

**Environment Reality Check:**
- [ ] web vitest = sandbox rollup-native 불일치 **실행 불가**(정규식 잠정, 클로드코드 실행)
- [ ] sandbox 커밋·push 금지

---

## 1. Priority Fit
- [x] **P1** (호영님 #2 우선순위, #1 다음)
- **Why:** 라이브에 조숙/fake "AI 분석" 노출 = §1-2③과 같은 거짓 가족(§4). #1 helper 패턴 재사용. 라이브 honesty 위반 제거 우선.

## 2. Work Type
- [x] Workflow/Ontology Wiring (inline 신호·단계 게이트) + Design Consistency + Web

## 3. Overview

**Feature Description:** 검색결과의 "AI 분석" 버튼·시트(별도 패널)를 제거하고, 동일 룰 엔진(`generateSearchSummary`) 출력을 **행 inline blocker chip + 상단 우선 배너 1개**로 전환. compare는 **2단계 게이트** — pre-quote=스펙 비교(견적 전 후보 좁히기), post-quote="AI 비교 분석"은 가격·납기 보유 후보 ≥2건일 때만 enabled. human-in-loop caveat 유지. §1-2⑦ 라벨 정정 흡수.

**Success Criteria:**
- [ ] 검색결과 "AI 분석" 버튼/시트 제거, 동일 신호가 행 chip + 상단 배너로 노출(엔진 재사용)
- [ ] compare "AI 비교 분석"은 가격·납기 ≥2건일 때만 enabled, 미만이면 스펙 비교 표 + "견적 요청 만들기" primary(disabled+사유)
- [ ] "AI 추천순"→"추천순"(정렬 로직 유지), "비교 적합" 배지 의미·연결 확인
- [ ] human-in-loop caveat("분석은 근거, 최종 담당자 확인") 유지
- [ ] §11.265c 레이아웃/필터/정렬 보존, AI 버튼/시트 assertion만 supersede

**Out of Scope (⚠️ 금지):**
- [ ] `ai-section.tsx` 랜딩 섹션 변경
- [ ] 엔진 `generateSearchSummary` 룰 로직 재작성(surface만 전환)
- [ ] 신규 AI/chatbot UI
- [ ] compare 데이터 모델 대수술(스펙필드 부재 시 별 트랙으로 분리)

**User-Facing Outcome:** "AI 분석" 패널을 열지 않아도 검색 행에 납기 미확인·견적 필요·안전정보 없음 등 신호가 바로 보이고, 차단 시 상단 배너 1개. 비교는 견적 전엔 스펙 비교 + 견적 요청 유도, 견적 2건+ 후에만 AI 비교 분석.

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench/queue/rail/dock, same-canvas, canonical truth
- [ ] §11.265c 검색바 1줄 레이아웃·필터·정렬 select
- [ ] human-in-loop caveat

**Must Not Introduce:**
- [ ] 별도 AI 버튼/패널(§4) · dead button/no-op · 조숙 분석(데이터 없는데 분석 패널)
- [ ] page-per-feature

**Canonical Truth Boundary:**
- Source of Truth: product/vendor 가격·납기·안전정보(카탈로그)
- Derived Projection: `generateSearchSummary` 신호(룰 파생) — truth 아님, 신호
- Surface: inline 행 chip + 상단 배너 1개(시트/패널 아님)

**UI Surface Plan:** [x] 기존 route 섹션(검색결과 행/상단) inline · [ ] New page(금지)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :-- | :-- | :-- |
| 엔진 유지, surface만 시트→inline chip+배너 | 룰 기반이라 스코어링 보존 0, §4 정합 | 시트 제거 시 265b-2 assertion supersede |
| compare 2단계(pre/post-quote) 게이트 | 조숙 "AI 비교 분석" 차단(§1-4) | 스펙필드 존재 의존(P0 confirm) |
| "AI 추천순"→"추천순"(value=relevance 유지) | §1-2⑦, AI 데코 제거 honesty | 265c·268b 테스트 동반 갱신 |

**Touched:** `app/_workbench/search/page.tsx`, `app/_workbench/compare/page.tsx`, `_workbench/_components/sourcing-result-row.tsx`, 테스트(265c·268b·265b-2·305 분류 갱신). 엔진/`ai-section`은 불변.

## 6. Global Test Strategy
- chip 매핑·compare 단계 판정 = unit
- surface 전환 = sentinel(readFileSync+regex) + 잠긴 테스트 assertion별 분류
- **회귀 0 describe 필수** — 보존(레이아웃/필터/정렬/caveat) 명시 매칭, supersede(AI 버튼/시트)는 사유 주석
- 실행: sandbox 실행 불가 → 클로드코드 실제 PASS

## 7. Implementation Phases

### Phase 0: Context & Truth/code-confirm Lock
- Status: [x] Complete (2026-06-08)
- **code-confirm 결과:**
  - (a) §11.265b-2 AI 분석 시트 = `search/page.tsx` 1곳 + 테스트뿐, **타 재사용처 0 → 제거 안전**.
  - (b) compare 스펙필드 `specification`(규격/용량)·`leadTime`(배송기간) **존재**(정렬/CSV/차트 사용) → **pre-quote 스펙 비교 feasible, 2단계 진행 가능**.
  - (c) "비교 적합" = `sourcing-result-row` 행 signal(label/color). 의미·연결은 Phase 3에서 확정.
- **잠긴 테스트 분류표:**
  - SUPERSEDE(AI 분석 surface): `sourcing-mobile-ai-analysis-sheet-265b2`, `265c`의 AI 분석 트리거 assertion, `268b`의 "AI 분석" 버튼 assertion.
  - PRESERVE(레이아웃): `265c`의 필터버튼 모바일·정렬 select·결과수·햄버거, `265e` dead-prop, `268c` divider(분류 후 확인).
  - UPDATE(§1-2⑦): `268b`·`265c`의 "AI 추천순"→"추천순".
  - PRESERVE(compare): `§11.305` AI 비교 분석 lock — 게이트는 enabled 조건만 추가.
- **🔴 RED:** 잠긴 테스트(265c·268b·265b-2·305) assertion별 보존/supersede 분류표 작성
- **🟢 GREEN:** code-confirm — (a) AI 분석=룰 확정(완료), (b) **compare pre-quote 스펙필드(규격/용량/배송기간) 존재 여부**, (c) **265b-2 AI 분석 시트 다른 재사용처 유무**, (d) §1-2⑦ "비교 적합" 배지 의미·연결
- **🔵 REFACTOR:** stale 가정 제거
- **✋ Gate:** 충돌 분류 완료, 스펙필드 결론(있으면 2단계 진행 / 없으면 compare 단계는 별 트랙 분리)
- **Rollback:** planning-only

### Phase 1: Contract & Failing Tests
- Status: [x] Complete — `lib/ai/sourcing-signal-surface.ts`(스캐폴드) + `sourcing-signal-surface.test.ts`(RED, 11 케이스). 계약: deriveRowBlockers / pickTopBanner / evaluateCompareStage.
- **🔴 RED:** (1) 검색결과 inline chip 계약(SearchSummaryLine→행 chip + 상단 배너 1개, 시트/버튼 부재) (2) compare 2단계 게이트 계약(가격·납기 ≥2건일 때만 AI 비교 분석 enabled) (3) 265c/268b supersede + 보존 분리 테스트. failing 작성
- **🟢 GREEN:** 최소 스캐폴딩
- **✋ Gate:** failing real, 보존 테스트 PASS, lint/typecheck 표기
- **Rollback:** 테스트 스캐폴딩 revert

### Phase 2: Core Logic
- Status: [x] Complete — 3 helper 구현: deriveRowBlockers(납기/견적/안전정보), pickTopBanner(SIGNAL_PRIORITY caution>compare>request>info), evaluateCompareStage(≥2 → post-quote+활성). 11 케이스 논리 GREEN(클로드코드 확정 대기).
- **🔴 RED:** chip 매핑(signal→chip 라벨/색), compare 단계 판정(`hasQuoteData(candidates) >= 2`) unit
- **🟢 GREEN:** 최소 구현
- **✋ Gate:** unit PASS, truth-boundary 위반 0
- **Rollback:** 로직 모듈 revert

### Phase 3: UI Wiring
- Status: [ ] In Progress — **3a 완료(§1-2⑦ + AI-rip).**
  - **§1-2⑦:** "AI 추천순"→"추천순"(value=relevance 유지).
  - **AI-rip:** search/page에서 AI 분석 트리거 + 시트(§11.265b-2) + `aiAnalysisSheetOpen` state 제거. 기존 §11.265b-1 인라인 AI 제안을 **상단 우선 배너 1개**로 승격(`hidden md:block`→`block` 전뷰포트, `pickTopBanner`, "AI 제안" 라벨 폐기, `data-testid=sourcing-top-banner`). `Sparkles`는 타 버튼 사용으로 import 유지.
  - **테스트 supersede 8개(blast radius):** 265b1·265b2·265c·265e·266e·268b(AI 버튼 블록)·280·280-2 → 제거 토큰 positive 강제 0 확인(전부 not.toMatch/supersede). 265b2·265b1은 §11.292에서 이미 제거된 TRIAGE를 강제하던 **stale 테스트**였음(동반 정리). 정렬·필터·재고·햄버거·triage-evidence 등 미터치 invariant는 PRESERVE.
  - **3b TR 완료(범위 축소):** `_workbench/_components/comparison-modal.tsx`가 §1-4 대부분 이미 구현 — human-in-loop caveat(L343-346·489), "견적 요청 만들기" CTA(L513-515), §11.318 카테고리 가드(혼합 시 Gemini 자동분석 차단+수동우회) 모두 존재. compare 분석은 search와 달리 **Gemini API(`/api/ai/compare-analysis`) 실호출**(§11.305 lock은 이미 removed). **§1-4 신규 조각 = 가격·납기 보유 후보 ≥2 게이트(evaluateCompareStage)** — 현 게이트는 카테고리 기반이라 price·납기 기반 추가가 필요. 기존 가드와 병렬 additive.
  - **3b 완료:** comparison-modal에 `quoteReadyCount`(price>0 && leadTime) + `evaluateCompareStage` 배선. 자동분석 게이트 `categoryGuard.compareMode==="direct" && compareStage.canAiAnalyze`(조숙 Gemini 호출 차단). pre-quote 배너(`compare-pre-quote-gate`) + "견적 요청 만들기" primary(handleOpenRequestWizard). §11.318 카테고리가드·human caveat·"그래도 분석" 보존. sentinel `ai-stage-gate-wiring.test.ts`.
  - **3c 완료(호영님 권장 채택):** 행 chip 직접 배선 보류 — 이전 "견적 필요 noise 제거" 결정 존중 + aggregate caution은 상단 배너(pickTopBanner)가 담당(중복 회피). "비교 적합" 배지 유지(readiness 신호, 의미 명확). deriveRowBlockers는 계약·테스트로 보존(미사용 사유 주석, 추후 재도입 대비). **행 production 코드 변경 0.**

### Phase 3 — 완료 (3a + 3b + 3c)
- Status: [x] Complete
  - ⚠️ AI-rip은 1100줄 파일 JSX 구조 변경 + 8 테스트 supersede라 **클로드코드 vitest 실행 필수**(sandbox 미실행, §11.303 build 포함).
- **🔴 RED:** surface별 sentinel
- **🟢 GREEN:** search/page — "AI 분석" 트리거·시트 제거 → 행 chip + 상단 배너; "AI 추천순"→"추천순"; compare — 2단계 게이트 + "견적 요청 만들기" primary(disabled+사유) + caveat 유지. 265c/268b 테스트 갱신
- **🔵 REFACTOR:** same-canvas 유지, 중복 제거
- **✋ Gate:** dead button/no-op/조숙 분석 0, loading/error/empty/disabled 상태, 보존 항목 회귀 0
- **Rollback:** surface별 wiring revert

### Phase 4: Smoke / Rollback
- Status: [x] Complete (smoke/rollback 문서화. 실제 vitest는 클로드코드 — sandbox 미실행)

**Smoke Path:**
1. **search:** "AI 분석" 버튼/시트 없음 → 신호 있으면 상단 우선 배너 1개(pickTopBanner)만, 정렬 "추천순". 배너 "비교 후보 담기"/dismiss 동작.
2. **compare(comparison-modal):** 가격·납기 보유 후보 ≥2 → 자동 AI 비교 분석(Gemini). <2 → pre-quote 게이트 배너 + "견적 요청 만들기" primary(자동 Gemini 호출 0). 카테고리 mixed → 기존 "그래도 분석" 수동 우회. human caveat 상시.

**실패모드 & 완화:** 배너 신호 0 → 미노출(no-op 아님) / price만 있고 leadTime 0 → pre-quote 유지(의도) / 시트·트리거 잔존 참조 positive 강제 0 확인.

**검증 명령 (클로드코드 — sandbox 실행 불가):**
```
cd apps/web
npx vitest run src/__tests__/regression/sourcing-signal-surface.test.ts \
  src/__tests__/regression/ai-stage-gate-wiring.test.ts \
  src/__tests__/dashboard/sourcing-mobile-ai-analysis-sheet-265b2.test.ts \
  src/__tests__/dashboard/sourcing-mobile-ai-analysis-trigger-265c.test.ts \
  src/__tests__/dashboard/sourcing-mobile-ai-triage-hidden-265b1.test.ts \
  src/__tests__/dashboard/sourcing-button-outline-parity-268b.test.ts \
  src/__tests__/dashboard/sourcing-secondary-buttons-touch-target-266e.test.ts \
  src/__tests__/dashboard/sourcing-search-utility-bar-dead-prop-265e.test.ts \
  src/__tests__/workbench/sourcing-header-pointer-events-280.test.ts \
  src/__tests__/workbench/sourcing-header-menu-icon-pe-none-280-2.test.ts
npx tsc --noEmit
npm run build
```

**Rollback:** helper additive. search/page 트리거+시트 복원, comparison-modal 게이트 조건 revert로 원복. DB 변경 0.

**커밋 대상:** (new) `lib/ai/sourcing-signal-surface.ts` / (mod) `_workbench/search/page.tsx`·`_workbench/_components/comparison-modal.tsx` / (new test) `sourcing-signal-surface.test.ts`·`ai-stage-gate-wiring.test.ts` / (sentinel-restore) 265b1·265b2·265c·265e·266e·268b·280·280-2 + PLAN 문서.

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (적용)
- **Resolver Input:** route(검색/비교) + 후보 가격·납기·안전정보 유무 + 견적 보유수
- **Output:** 행 chip(blocker: 납기 미확인·견적 필요·안전정보 없음) / 상단 배너 1개(우선) / compare 단계(pre/post-quote) / allowedActions(견적 요청·AI 비교 분석)
- **Surface Rules:** dashboard 강액션 최소 / 검색·비교 route inline only / 시트·패널·챗봇 금지
- **Validation:** [ ] 상단 배너 1개 정확 [ ] 행 chip 정확 [ ] compare 단계 정확 [ ] caveat 유지

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| 잠긴 P0 테스트 맹목 폐기 → 의도 손실 | High | High | assertion별 분류표(P0), 보존/supersede 사유 기록 |
| compare 스펙필드 부재 → pre-quote 비교 공란 | Med | High | P0 confirm, 부재 시 compare 단계는 별 트랙 분리 |
| 265b-2 시트 타 재사용처 존재 | Med | Med | P0 grep, 있으면 제거 대신 게이트 전환 |
| §11.305 AI 비교 분석 lock 충돌 | Med | Med | 305 assertion 분류, 게이트는 enabled 조건만 추가 |
| sandbox vitest 실행 불가 | High | Med | 정규식 잠정, 클로드코드 PASS 전 push 금지 |

## 10. Rollback Strategy
- Phase 1: 테스트 스캐폴딩 revert
- Phase 2: 로직 모듈 revert
- Phase 3: surface wiring revert → 기존 "AI 분석" 시트/버튼 복귀
- Phase 4: 미적용 복귀
- DB 변경 0, feature flag 불필요.

## 11. Progress Tracking
- Overall completion: 100% (Phase 0–4 완료, 코드)
- Current phase: 종결 — 클로드코드 vitest/tsc/build PASS + push 대기
- Current blocker: 없음
- Next: §11.37x 스캔 intent planner(다음 트랙) — Phase 0 = ScanHubModal reconcile

**Phase Checklist:**
- [x] Phase 0 / [x] Phase 1 / [x] Phase 2 / [x] Phase 3 / [x] Phase 4

## 12. Notes & Learnings
- TR 핵심: "AI 분석" 엔진=룰 기반(스코어링 아님) → surface만 inline 전환, 저위험. §11.265c는 의도적 과거 P0(조숙 아님) → assertion별 분류로 supersede.
- compare 2단계는 pre-quote 스펙필드 존재가 전제(P0 confirm). 부재 시 분리.
- #1 helper(저신뢰 게이트)와 동일 원칙(데이터 없으면 분석 약속 대신 게이트).
