# Implementation Plan: §11.318 비교 검토 재설계 — 워크벤치 기준 (환각 억제 → 가드 → 추천)

- **Status:** ⏳ Pending (표면 정정 완료, 5단계 재정렬, 1d-1 RED 진입 대기 — 호영님 PLAN 검토 후)
- **Started:** 2026-05-29 · **Last Updated:** 2026-05-30
- **선행:** §11.319 push(호영님 env) — Sync Pattern상 sandbox 진입 허용
- **canonical 표면:** **`/app/search`(소싱 워크벤치)** 확정. `/compare`는 **deprecated(단계적 제거)**.

**CRITICAL**: phase 완료마다 체크박스/Last Updated/Notes 갱신, quality gate 통과 후 진행.
⛔ quality gate 실패·conflict 미해소 진행 금지 / dead button·no-op·**근거 없는 추천(환각)** 금지.
⛔ 큰 파일(`_workbench/search/page.tsx` 등 1000줄+): **분할 str-replace 편집 + 매 편집 후 줄수·EOF 무결성 확인**, 전체 재작성 금지(§11.318-CORRECTION §7).

---

## 0. Truth Reconciliation (워크벤치 기준, 2026-05-30 정정)

### canonical 표면 = `/app/search`
- `src/app/app/search/page.tsx` → `_workbench/search/page.tsx`(workbench/queue/rail/dock).
- **비교 검토 CTA** → `comparison-modal.tsx` 오픈 → **`POST /api/ai/compare-analysis`**(body `{ products }`) → 3 시나리오(cost_first/balanced/speed_first) + productAnalysis 렌더. = **"판단안 3개"**.
- **혼합 카테고리 경고** → `_workbench/search/page.tsx:360` + `CompareReviewWorkWindow`(`validateCompareCategoryIntegrity` @ `@/lib/ai/compare-review-engine`).
- comparison-modal 은 이미 human-gate(분석 결과로 activeScenario 자동선택 안 함).

### 환각 출처 확정 (§1-B)
`/api/ai/compare-analysis` — Gemini 경로 + `buildLocalAnalysis` fallback **둘 다** 가격/납기 데이터 없어도 cost/balanced/speed 전략 생성. comparison-modal 이 그대로 표시 → "데이터 없이 비용 우선 전략" 환각.

### Conflicts / 정정
- **[C-표면] /compare ≠ /app/search**: Phase 1c(이전) 추천 드로어 + core 는 `/compare`(legacy)에 붙음 → 사용자 미사용. → **워크벤치 기준 재적용**. 내 core(`sourcing-recommendation.ts`)는 surface-agnostic 순수 함수 → **폐기 아님, 워크벤치 추천 신설 시 재사용**.
- **[C-2] 카테고리 가드 warn-only**: `validateCompareCategoryIntegrity` 가 compareMode 반환하나 block 미배선. 워크벤치 소비처에 block 배선 = 의도 변경 → 기존 6 테스트 동반 점검.

### Chosen Source of Truth
- 비교/AI 분석 표면 = 워크벤치(`comparison-modal` + `CompareReviewWorkWindow`).
- 추천 근거 = `PurchaseRecord`(실거래) only. 데이터 없으면 추천/전략 0(환각 0).
- 납기 = QuoteListItem.leadTime 파싱(number|null) + source("quote"|"unknown"), 없으면 "미확인".

### Environment
- [x] repo/branch 이해 · vitest sentinel/unit (`src/**/*.test.ts`)
- [ ] sandbox rollup 불일치 → vitest 풀 실행은 호영님 env. sandbox 는 node strip-types/정규식 하네스.

---

## 1. Priority Fit / 2. Work Type
- P1 단계적, §11.319 종결 후. release-prep P1 잔여는 뒤.
- Feature 재설계 · 환각 방지 · Workflow(sourcing) · Web.

---

## 3. Overview

**문제:** `/app/search` 비교 검토가 ① 데이터 없이 3 전략을 생성(환각), ② 혼합 카테고리(시약 vs 소모품)를 경고만 하고 차단 안 함. 사용자 실제 화면에서 미해결.

**정정된 5단계 (호영님 2026-05-30):**
| # | 작업 | 표면 | 우선 |
| :-- | :-- | :-- | :-- |
| 1d-1 | **buildLocalAnalysis/route 환각 억제** — 데이터 없으면 시나리오 0 + 정직한 빈 상태 | `compare-analysis` route | **최우선** |
| 1d-2 | 카테고리 가드 warn→block 배선 | comparison-modal / CompareReviewWorkWindow | 높음 |
| 1d-3 | 기존 compare 6테스트 회귀 정리 | — | 높음 |
| 1c-rev | 대체품/벤더 추천 워크벤치 신설 (core 재사용) | 워크벤치 | 후속 |
| dep | `/compare` deprecation → 제거 (이전→진입점 확인→안내→제거) | — | 후속 |

**Success Criteria (1d-1 ~ 1d-3 우선):**
- [ ] 가격·납기 데이터 0 → compare-analysis 가 **시나리오 미생성**(scenarios: []) + 정직한 "데이터 부족" 상태. Gemini 호출도 skip(비용 0·환각 0).
- [ ] 부분 데이터: 가격만 있으면 cost_first 허용·speed_first 억제, 납기만 있으면 반대. balanced 는 둘 다 있을 때만.
- [ ] productAnalysis 는 "가격 미확인/납기 미확인" 정직 표기(추정 단가·납기 지어내기 0).
- [ ] 혼합 카테고리 → comparison-modal/CompareReviewWorkWindow 에서 **block**(AI 분석/전략 생성 차단 + "용도가 다른 제품" 안내).
- [ ] 기존 compare 6테스트: 의도 변경분 동반 업데이트 + 나머지 회귀 0.

**Out of Scope:** 외부 데이터(크롤링/벤더피드)=Phase 2 / 규격 정밀 파싱 / 추정치 생성 / `/compare` 즉시 삭제.

---

## 4. Product Constraints
- Preserve: workbench/queue/rail/dock · same-canvas · canonical truth · comparison-modal human-gate.
- Must not: page-per-feature · chatbot 재해석 · dead button/no-op · **근거 없는 추천(환각)** · 큰 파일 truncated write.
- Canonical Truth Boundary: 분석/추천 = 읽기 전용 파생. 액션은 기존 견적/요청 wiring 위임.

---

## 6. 환각 억제 규칙 (1d-1 고정 — 핵심)
순수 함수로 추출(단위테스트 가능):
```
assessAnalysisDataAvailability(products) → {
  hasAnyPrice: products.some(p => typeof p.price === "number"),
  hasAnyLead:  products.some(p => leadTime 파싱 가능),
  allowedScenarios: [cost_first(가격O), speed_first(납기O), balanced(둘다O)] 중 충족분,
  suppressed: allowedScenarios.length === 0,
  reason: 한국어 사유
}
```
route 적용:
- `suppressed` → **Gemini 호출 skip**, `{ scenarios: [], productAnalysis: 미확인 표기, dataState:"insufficient", aiSummary: "비교할 데이터가 부족합니다. 견적을 먼저 요청하세요." }` 반환.
- 부분 데이터 → Gemini/local 결과의 scenarios 를 `allowedScenarios` 로 **필터**(없는 차원 전략 제거).
- aiSummary 에 근거 없는 "최저가/최단납기" 단정 금지.

---

## 7. Implementation Phases

### Phase 1d-1: 환각 억제 (RED→GREEN) — ✅ 완료(호영님 env vitest/build 확인 잔여)
- Status: [x] Complete
- 🔴 RED: [x] `lib/ai/__tests__/compare-analysis-data-gate.test.ts` — 경계 ①(축당 ≥2) + ②(null/0/음수) 실패 테스트. RED 확정(MODULE_NOT_FOUND).
- 🟢 GREEN: [x] `lib/ai/compare-analysis-data-gate.ts`(순수) — `assessAnalysisDataAvailability`(가격 유효=양수, 납기 유효=0 이상, 축당 ≥2 → allowedScenarios/suppressed/reason) + `parseLeadDays`. node strip-types 하네스 11/11.
- [x] route `compare-analysis` 배선: 진입 시 availability 판정 → **suppressed면 Gemini skip + scenarios [] + 정직 빈 상태**(`buildSuppressedAnalysis`) / 부분 데이터면 Gemini·local 결과를 `filterScenarios(allowedScenarios)`로 필터.
- 🔵 REFACTOR: [x] 게이트 단일 판정점, 임계(양수/0) 명시.
- ✋ Gate: 단위 11/11 ✓ / 게이트 시뮬(데이터0→0시나리오, 가격만→cost만, 둘다→3개) ✓ / 중괄호 63/63·LF·EOF 무결 ✓ / vitest 풀 실행·build = 호영님 env
- ⚠️ **사고 재발+복구**: route 가 Edit 툴로 181줄 truncated 손상 → **HEAD 복원 + Python 원자적 치환**으로 재구성(247줄, 무결). 이후 이 파일은 Edit 툴 대신 Python/heredoc 권장.
- Rollback: 신규 게이트 모듈 + route 5편집 revert(HEAD 동작 복귀).

### Phase 1d-2: 카테고리 가드 warn→block (B안) — ✅ GREEN 완료
- Status: [x] Complete (호영님 env vitest/build 확인 잔여)
- 정책(호영님 2026-05-30): B안 — 혼합/blocked 시 comparison-modal AI 자동분석(/api/ai/compare-analysis) 차단(§1 환각 방지) + 경고 + "그래도 분석" 수동 우회(과차단 회피). direct 만 자동.
- GREEN: comparison-modal.tsx(567줄) — validateCompareCategoryIntegrity import + categoryGuard(compareProducts→CompareCandidateInfo 매핑) + useEffect 자동호출 direct 조건 + 경고배너 + 그래도 분석 버튼. 무결, sentinel 6/6 PASS.
- 6테스트 회귀 점검: compareMode/validate 단언은 ts-nocheck regression 1건(무관 state)뿐 → 동반 업데이트 불필요, 엔진 불변. 회귀 0.
- Python 원자 치환(Edit truncation 회피). Rollback: comparison-modal revert(HEAD).
- 🔴 RED: **기존 compare 6테스트 정독** → 혼합 카테고리 단언 식별. comparison-modal/CompareReviewWorkWindow sentinel(compareMode==="blocked"/"mixed" 시 분석/전략 차단 + 안내).
- 🟢 GREEN: `validateCompareCategoryIntegrity` 소비처에 block 배선(blocked → compare-analysis 호출 차단, mixed → 경고 유지 or 차단 정책 확정). 큰 파일 분할 편집.
- ✋ Gate: 혼합 카테고리 시 환각 미생성, dead button 0, 6테스트 의도 변경 동반.
- Rollback: block→warn 복귀.

### Phase 1d-3: 기존 6테스트 회귀 정리 (1~2h)
- Status: [ ] Pending
- 대상: compare-engine / compare-insight-generator / compare-completed-notification / compare-queue-semantics / compare-analysis-lock-removed-305 / compare-drawer-shortlist-removal-292b. 의도 변경분 기대값 갱신 + 나머지 GREEN 유지(호영님 env vitest).

### Phase 1c-rev: 대체품/벤더 추천 워크벤치 신설 (후속, core 재사용)
- Status: [ ] Deferred (1d land 후)
- 워크벤치에 추천 surface 신설 + 기존 core(`sourcing-recommendation.ts`) + `/api/sourcing/recommend` 재사용. 빈 상태/견적 유도/출처 명시. 데이터 전략(Phase 0~1) 정합.

### Phase dep: /compare deprecation (후속)
- 기능 워크벤치 이전 완료 → `/compare` 진입점(링크/라우팅) grep → deprecation 안내 → 제거. 갑작스런 삭제 금지(404 방지). 중복 route `api/sourcing/recommendations` 도 이때 정리(현재 호영님 env `rm` 1건 대기).

### Phase 1e: Smoke / Closeout
- `/app/search`에서 데이터 없는 비교→시나리오 미생성·정직 빈상태 / 혼합 카테고리→차단 smoke. COMMIT draft + closeout.

---

## 9. Risk Assessment
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| 큰 파일(_workbench/search 1000줄+) truncated write 재발 | Med | High | 분할 str-replace, 매 편집 후 줄수·EOF 확인, 전체 재작성 금지 |
| 가드 block 전환이 6테스트 깨뜨림 | High | Med | 1d-2 전 6건 정독, 의도 변경 동반 업데이트 |
| 환각 억제가 기존 표시 광범위 변경 | Med | Med | §6 규칙 경계 고정, scenarios [] 안전 렌더 확인 |
| Gemini 경로 미게이트 시 환각 잔존 | Med | High | route 경계에서 Gemini 호출 전 게이트(suppressed면 skip) |

## 10. Rollback
- 1d-1: route 게이트 revert. 1d-2: block→warn. 1d-3: 테스트 revert. 1c-rev: 신규 surface revert. dep: 진입점 복구.

## 11. Progress Tracking
- Overall: ~50% (Phase 0/1a/1b/core 완료, 표면 정정 완료, 워크벤치 1d 재정렬)
- Current: 1d-1 RED 진입 대기(호영님 PLAN 검토 후)
- Blocker: 없음. 호영님 env 정리 1건(중복 route 삭제) + 베이스라인 확인.

### 확정(2026-05-30)
canonical=/app/search · /compare deprecated(단계적) · 순서=환각억제→가드→6테스트→추천신설→deprecation · core 재사용.

**Phase Checklist:**
- [x] Phase 0 결정 / [x] 1a / [x] 1b(core) / [x] 1c(legacy, 표면 정정으로 재적용 대상)
- [ ] 1d-1 / [ ] 1d-2 / [ ] 1d-3 / [ ] 1c-rev / [ ] dep / [ ] 1e

## 12. Notes & Learnings
- [2026-05-30] **표면 정정**: 실제 비교 검토 = `/app/search`(워크벤치 comparison-modal/CompareReviewWorkWindow), `/compare`(legacy) 아님. Phase 1c core 는 surface-agnostic → 워크벤치 재사용.
- [2026-05-29] **사고**: compare/page.tsx truncated write 손상 → HEAD 복원(diff 0). 기존 committed 드로어 덮어씀 → HEAD 복원. 순수 신규 유효분 = core + test.
- 납기: Quote 직접 필드 없음, QuoteListItem.leadTime(string) 파싱 best-effort/null.
- 베이스라인(호영님 env): `rm api/sourcing/recommendations/route.ts` + core 16/16 + 6테스트 + next build.
