# Implementation Plan: §11.312 — 검색 sourcing bar dead button 해소 (sheet wiring)
- **Status:** ⏳ Pending (baseline 후 착수 — 우선순위 #2 의 1순위)
- **Started:** —
- **Last Updated:** 2026-06-03
- **Priority:** **P2 라이브 결함** — (B) 분류에서 **유일하게 confirm된 dead button.** baseline 정리 직후 첫 착수 후보.
- **유형:** Bugfix / dead button wiring · same-canvas · §11.356 Phase2 (a) 환류 건
- **Scope:** Small (3 phase) — wiring 여부에 따라 가변
> **Quality Gate 규칙:** 각 phase는 build/compile, 관련 test 통과(실제 `vitest run` — "정적검증만" 면죄부 금지), no-op/dead button 없음, same-canvas 보존을 만족해야 진행. 실패 시 stop.
---
## 1. Overview
검색 페이지의 **sourcing bar(비교/견적/검토 버튼)가 dead button.** (B) 코드+테스트 확인 결과:
- `SourcingCandidatesSheet` 렌더 **0회**, `setCandidatesSheetMode` 호출 **0회**.
- 즉 bar 버튼을 눌러도 후보 sheet가 안 열림 = **사용자가 누르는데 no-op.**
- §11.312 sentinel("검토 N 배지 dead button 해소")이 이 wiring 부재로 실패 → **(a) 진짜 미구현 확정** (테스트 오판 아님).
## 2. (B) 확정 사실 (코드 확인 기반, 추측 아님)
- 증상: sourcing bar onClick → sheet 안 열림.
- 갭: `bar 버튼 onClick → setCandidatesSheetMode(mode) → SourcingCandidatesSheet 렌더` 경로 미연결.
- §11.305-phase3a와 대비: 그건 (b) 테스트 오판(주석 regex)이었으나, **§11.312는 (a) 실제 미wiring.**
## 3. Surface & Canonical Truth
- **Source of Truth:** 검색/소싱 후보 데이터(서버). sheet open 상태 = UI state.
- **Surface:** 검색 페이지(`/app/search` 계열), same-canvas. sheet는 같은 화면 위 dock/overlay (새 페이지 X).
- **page-context action:** bar 버튼은 검색 화면의 same-canvas action — 후보 sheet를 여는 것이 page-context에 맞음.
**Must:** dead button 제거(클릭→실제 sheet open). **Must Not:** 새 페이지 이동, generic CTA화.
## 4. Test Strategy
- §11.312 sentinel을 **녹색으로** — `SourcingCandidatesSheet` 렌더 ≥1, `setCandidatesSheetMode` 호출 확인.
- bar 3버튼(비교/견적/검토) 각각의 mode 매핑 검증.
- **실제 `vitest run`으로 검증** (이 repo는 vitest 설치됨 — 정적검증 면죄부 무효).
---
## 5. Phases
### Phase 0 — Context & Truth Lock
- Status: [ ] Pending
- **🔴 RED (확인):**
  - `SourcingCandidatesSheet` 컴포넌트가 **이미 존재**하는지 → 존재하면 wiring만, 없으면 sheet 자체도 구현(scope 커짐)
  - bar 3버튼(비교/견적/검토)이 각각 **sheet의 어떤 mode**로 열려야 하는지 (mode enum 매핑)
  - `setCandidatesSheetMode` state hook의 현재 정의 위치·시그니처
  - bar 버튼들의 현재 onClick(비어있나 / 엉뚱한 데 연결됐나)
- **🟢 GREEN:** wiring 지점·mode 매핑·sheet 존재 여부 확정.
- **✋ Gate:** "wiring만" vs "sheet도 구현" 확정 → scope 결정. mode 매핑 확정.
- **Rollback:** planning-only.
### Phase 1 — Contract & Failing Tests
- Status: [ ] Pending
- **🔴 RED:** §11.312 sentinel을 살리는 방향으로 실패 테스트 정합 —
  - bar 버튼 클릭 → `setCandidatesSheetMode(해당 mode)` 호출
  - `SourcingCandidatesSheet` 렌더됨(open 상태)
  - 비교/견적/검토 각 버튼 → 올바른 mode
  - 클릭이 no-op 아님 assert
- **🟢 GREEN:** 최소 wiring scaffolding.
- **✋ Gate:** 실패 테스트가 real, **실제 vitest run으로 확인**(정적 아님).
- **Rollback:** scaffolding revert.
### Phase 2 — Core Wiring
- Status: [ ] Pending
- **🔴 RED:** wiring 단위 test.
- **🟢 GREEN:**
  - bar 버튼 onClick → `setCandidatesSheetMode(mode)` 연결
  - `SourcingCandidatesSheet` 렌더 + open state 바인딩 (mode별 내용)
  - same-canvas (overlay/dock, 페이지 이동 X)
  - loading/empty/close 상태 처리
  - (sheet 미존재 시) sheet 컴포넌트 구현 — Phase 0 결과에 따라
- **🔵 REFACTOR:** 중복 제거, 헤더/레이아웃 문법 보존.
- **✋ Gate:** dead button 0(클릭→실제 open), §11.312 sentinel green(실제 vitest run), same-canvas 보존.
- **Rollback:** wiring revert → 기존(단 기존이 dead라 원복은 결함 복귀 — flag 권장).
---
## 6. Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| sheet 컴포넌트 미존재 → scope 확대 | Med | Med | Phase 0에서 존재 여부 확정, 없으면 별도 산정 |
| mode 매핑 오류(버튼↔mode) | Med | Med | Phase 0 매핑 명시, 버튼별 test |
| wiring이 다른 검색 동작과 충돌 | Low | Med | same-canvas 보존, 기존 검색 회귀 test |
| "정적검증만" 면죄부 재발 | Med | High | 실제 vitest run 강제(Gate) |
## 7. Rollback Strategy
- Phase 1: scaffolding revert
- Phase 2: feature flag로 신규 wiring 토글 (기존이 dead라 단순 원복은 결함 복귀이므로 flag 권장)
## 8. Progress Tracking
- [ ] Phase 0 (sheet 존재·mode 매핑)
- [ ] Phase 1
- [ ] Phase 2
## 9. Notes & Learnings
- (B) 분류에서 유일하게 confirm된 라이브 dead button — 우선순위 #2 1순위.
- §11.305-phase3a와 대비: 그건 (b) 테스트 오판, 이건 (a) 실제 미wiring. 분류가 가른 차이.
- 검증은 실제 `vitest run` — 이 repo vitest 설치됨, "정적검증만" 무효.
- (실행 중 기록)

---
## 부록 — Phase 0 sandbox 실측 (Claude, 2026-06-03)
### Phase 0 실측 결과 (sandbox, 2026-06-03) — scope = **Small (wiring-only) 확정**
- ✅ **sheet 신규 구현 불필요**: `src/components/sourcing/SourcingCandidatesSheet.tsx` **존재**.
- ✅ **mode enum**: `CandidatesSheetMode = "compare" | "quote" | "review"` (비교후보 / 견적후보 / 검토필요). titleMap·mode별 콘텐츠·onClearCompare 등 props 완비.
- ✅ **테스트 대상 파일** = `src/app/_workbench/search/page.tsx` (랜딩 `app/search` 아님 — 워크벤치 검색 화면). 312 sentinel은 이 파일에서 `setCandidatesSheetMode("compare"/"quote")`, `data-testid="sourcing-bar-review-open"`, `<SourcingCandidatesSheet` 렌더를 기대.
- ✅ **참조 구현 존재**: `_workbench/search/page.tsx` + `_workbench/_components/quote-cart-panel.tsx` 가 이미 SourcingCandidatesSheet 를 import(부분 wiring). 즉 패턴·sheet·modes 다 있음.
- 🔧 **남은 갭(Phase 1/2 작업)** = bar(비교/견적/검토) onClick → `setCandidatesSheetMode(mode)` → `<SourcingCandidatesSheet>` 렌더 + open state 바인딩 연결. quote-cart-panel 패턴 재사용. 신규 컴포넌트 0.
- **Gate 결론:** scope = Small(wiring-only). sheet/mode/참조 모두 확정 → Phase 1 진입 준비 완료(baseline 후, 외부영향 없음이라 승인 가벼움).
- 🔎 Phase 1 첫 확인: `_workbench/search/page.tsx` 가 sheet 를 import만 하고 render 안 하는지 / quote-cart-panel 에만 있는지 → bar wiring 위치 결정.
