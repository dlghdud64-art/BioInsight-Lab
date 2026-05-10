# Implementation Plan: Operational Brief Visual Uplift (Option B)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-11
- **Last Updated:** 2026-05-11
- **Estimated Completion:** 2026-05-11 (single session, ~3-4h)

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

**Latest Truth Source:**
- `apps/web/src/components/operational-brief/popup.tsx` (오늘 세션 D1~D5 + E1+E2 land 완료 — commit `a0a492a8` production GREEN)
- `CLAUDE.md` §11.142 운영 브리핑 lock — popup 또는 per-surface ContextPanel rail 둘 다 허용
- 호영님 Gemini Studio mockup — 다크 모드 LABAXIS AI INSIGHT + glow + LIVE pulse + 큰 back button + 비활성 grayscale spec

**Secondary References:**
- `docs/decisions/ADR-002-pilot-tenant-seed.md` — 오늘 세션 D1~D5 + E1+E2 entry
- `MobileOperationalBriefSheet` — mobile 분기 (이번 batch 에서는 touch 0)

**Conflicts Found:**
- 호영님 mockup 의 큰 layout (좌측 메인 + 우측 sticky rail) 은 popup → rail 전환 의도 포함
- 다만 이번 batch 는 Option B (popup 유지 + 내부 디자인 강화) 한정
- popup → rail 전환은 별도 batch (Option A, 다음 세션) 으로 deferred

**Chosen Source of Truth:**
- popup.tsx 가 desktop popup canonical
- §11.142 lock 가 surface 형식의 canonical
- 이번 batch 는 popup 내부 시각 디자인만 변경 — surface 형식 변경 0

**Environment Reality Check:**
- [x] repo / branch context 이해됨 (main, 18 cluster 누적)
- [x] runnable commands: vitest, tsc, vercel deploy
- [x] mobile 분기 (`MobileOperationalBriefSheet`) — 이번 batch touch 0

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [x] P2 / Deferred (오늘 세션 5 axis redesign 일관성으로 우선순위 ↑)

**Why This Priority:**
호영님 production 검증 5 axis redesign 흐름의 일관성 유지 — D1~D5 + E1+E2 가 land 완료된 상태에서, 호영님이 직접 production Chrome 체감 후 Gemini Studio mockup 으로 추가 spec (다크 INSIGHT / glow / LIVE pulse / 큰 back button / 비활성 grayscale) 을 작성. 같은 popup 컴포넌트의 시각 일관성 강화이므로 별도 세션 분리 시 cognitive load 의 누수가 더 큼.

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [x] Web
- [x] Design Consistency

## 3. Overview

**Feature Description:**
운영 브리핑 popup 의 내부 시각 디자인을 호영님 Gemini Studio mockup 기준으로 강화. LABAXIS AI INSIGHT 영역에 다크 모드 + glow gradient 효과 적용, LIVE 뱃지에 emerald + animate-pulse 적용, < 카테고리 back button 의 크기/터치 영역 강화, 비활성 카테고리 카드 (count 0) 에 grayscale 적용.

**Success Criteria:**
- [ ] LABAXIS AI INSIGHT block: `bg-slate-900 + text-white + rounded-xl + overflow-hidden + relative` 구조 + glow gradient 절대 위치 element
- [ ] LIVE 뱃지: `bg-emerald-500/20 text-emerald-400` + `animate-pulse` dot
- [ ] < 카테고리 back button: 클릭 영역 ≥ 32px (현재 inline text → button 컴포넌트 + padding)
- [ ] 비활성 카테고리 카드 (count 0) 에 `opacity-60 grayscale` 또는 등가 패턴
- [ ] vitest + tsc GREEN
- [ ] Chrome production smoke 검증 GREEN

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] popup → ContextPanel rail 전환 (Option A — 별도 batch)
- [ ] mobile (`MobileOperationalBriefSheet`) 디자인 변경
- [ ] dashboard / quotes / purchases / receiving / inventory surface canvas layout 변경
- [ ] 새 페이지 신설 (page-per-feature 회귀 금지)

**User-Facing Outcome:**
운영 브리핑 popup 진입 시 LABAXIS AI INSIGHT 영역이 다크 모드 + glow 로 시선 집중도 ↑. LIVE 뱃지가 pulse 로 실시간성 강조. < 카테고리 back button 이 즉시 클릭 가능한 크기. 비활성 카테고리는 시각적으로 약화되어 활성 카테고리에 시선 집중.

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock (popup overlay 유지)
- [x] same-canvas (popup 내부 변경만)
- [x] canonical truth (selectedSignals, item.priority 등 변경 0)
- [x] invalidation discipline (mutation 0 — UI only)

**Must Not Introduce:**
- [x] page-per-feature
- [x] chatbot/assistant reinterpretation of ontology
- [x] dead button / no-op / placeholder success
- [x] fake billing/auth shortcut
- [x] preview overriding actual truth

**Canonical Truth Boundary:**
- Source of Truth: `selectedSignals`, `item.priority`, `item.dueState`, `CATEGORIES` 상수
- Derived Projection: 컬러 tone (CATEGORY_TONE_*), priority hierarchy 분기, 비활성 grayscale 분기
- Snapshot / Preview: 없음 (실시간 brief data 만)
- Persistence Path: 없음 (UI only)

**UI Surface Plan:**
- [x] Inline expand (popup 내부)
- [ ] Right dock
- [ ] Bottom sheet
- [ ] Split panel
- [ ] Existing route section
- [ ] Settings panel
- [ ] New page

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| popup.tsx 단일 파일 변경 | minimal-diff + 오늘 세션 D5 와 같은 파일 | popup 분해 / 컴포넌트 재구성 X (option A 시 분해 권장) |
| Tailwind literal class (dynamic 금지) | E1 batch 에서 검증된 패턴 — purge safe | const Record 패턴 또는 literal switch |
| AI INSIGHT block 다크 모드 = literal `bg-slate-900` | 다크모드 toggle X — 항상 다크 (mockup 정합) | 추후 light/dark theme 전환 시 prop 추가 필요 |

**Dependencies:**
- Required Before Starting: [x] 오늘 세션 D1~D5 + E1+E2 land 완료 (`a0a492a8`)
- External Packages: 없음 (Tailwind 만)
- Existing Routes / Models / Services Touched: `apps/web/src/components/operational-brief/popup.tsx` 단일

**Integration Points:**
- popup.tsx 내부 LABAXIS AI INSIGHT block — D3 한 줄 reason 영역 인접
- popup.tsx 내부 PopupCategoryGrid — E1 tone 매핑 영역 인접
- popup.tsx 내부 PopupCategoryListWithExpand — D5 chip strip + back button 영역

## 6. Global Test Strategy

**Test Strategy by Work Type:**
- Design Consistency → source-level grep sentinel (vitest readFileSync 패턴) — 오늘 세션 D1~D5 + E1+E2 와 동일

**Execution Notes:**
- vitest sandbox 정합 (이미 §11.117 land)
- tsc 정합
- Chrome production smoke (vercel deploy 후)

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** popup.tsx 현재 구조 audit + Gemini mockup spec 4개 추출 + § 11.142 lock 정합 재확인
- Status: [x] Complete

**🔴 RED:** popup.tsx 현재 LABAXIS AI INSIGHT / LIVE 뱃지 / back button / 카테고리 grid grayscale 영역 위치 식별
**🟢 GREEN:** Gemini mockup 4 spec 명확화 (다크 INSIGHT / glow / LIVE pulse / 큰 back button / 비활성 grayscale)
**🔵 REFACTOR:** scope 단순화 — popup.tsx 단일 파일 변경

**✋ Quality Gate:** spec 4 항목 명확, 충돌 0, P2 정합
**Rollback:** planning-only

### Phase 1: RED — popup-visual-uplift sentinel test
**Goal:** Gemini mockup 4 spec 의 source-level grep test 작성 (FAIL 확인)
- Status: [ ] Pending

**🔴 RED:** 새 test 파일 `popup-visual-uplift-f1.test.ts` 작성
- LABAXIS AI INSIGHT: `bg-slate-900` + `rounded-xl overflow-hidden relative` 패턴
- glow gradient: `bg-blue-500/10 blur-2xl` + `absolute` 패턴
- LIVE 뱃지: `animate-pulse` + `bg-emerald-500/20 text-emerald-400` 패턴
- back button: `px-3 py-2` 또는 등가 클릭 영역 패턴
- 비활성 카테고리: `opacity-60 grayscale` 패턴

**🟢 GREEN:** 현재 popup.tsx 에서 5 패턴 모두 미존재 → test FAIL 확인
**🔵 REFACTOR:** test 명세 cleanup

**✋ Quality Gate:** vitest run 시 5 spec 모두 RED, 기존 D1~D5 + E1+E2 test 모두 GREEN 보존
**Rollback:** test 파일 삭제

### Phase 2: GREEN — popup.tsx 시각 강화
**Goal:** Phase 1 의 5 spec 을 popup.tsx 에 land
- Status: [ ] Pending

**🔴 RED:** Phase 1 test 가 FAIL 상태 시작
**🟢 GREEN:**
- LABAXIS AI INSIGHT block: 기존 light card → `<div className="relative overflow-hidden rounded-xl bg-slate-900 text-white p-4">` + glow gradient `<div className="absolute -top-8 -right-8 w-32 h-32 bg-blue-500/10 blur-2xl pointer-events-none" />`
- LIVE 뱃지: 기존 static badge → `<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>`
- < 카테고리 back button: 기존 inline text → `<button className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">← 카테고리</button>`
- 비활성 카테고리 grayscale: stat.total === 0 분기 시 카드에 `opacity-60 grayscale` 추가

**🔵 REFACTOR:** className 정리, dead code 제거 (기존 light AI INSIGHT block 잔존 차단)

**✋ Quality Gate:** Phase 1 test 모두 GREEN, 기존 D1~D5 + E1+E2 + Phase A test 모두 GREEN 보존, tsc clean, lint clean
**Rollback:** popup.tsx git revert (commit 단위)

### Phase 3: 검증 + ADR + Chrome smoke
**Goal:** vitest + tsc 검증 + ADR-002 entry append + Chrome production smoke
- Status: [ ] Pending

**🔴 RED:** vercel deploy READY 전까지 production 미반영 상태
**🟢 GREEN:** vitest run, tsc run, vercel deploy READY 확인, Chrome production smoke 5 spec 모두 시각 확인
**🔵 REFACTOR:** ADR-002 §11.218 entry append (popup 시각 강화 cluster summary)

**✋ Quality Gate:** Chrome production smoke 5 spec GREEN, ADR-002 entry append, commit message draft 호영님 echo
**Rollback:** vercel previous deploy rollback (이전 commit `a0a492a8`)

## 8. Optional Addenda — N/A

이 작업은 design consistency 단일 작업으로, workflow/ontology / billing / API slimming / mobile addendum 적용 안 함.

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Tailwind dynamic class purge 위험 (`bg-slate-900` 등) | Low | Med | literal class 사용 (E1 검증된 패턴) — Record 매핑 없음 |
| 다크 INSIGHT block 안 child 텍스트 contrast 부족 | Med | Med | `text-white` / `text-emerald-400` / `text-slate-200` literal 강제 + Chrome smoke 색대비 확인 |
| Mobile 분기 회귀 | Low | High | popup.tsx 만 수정 — `MobileOperationalBriefSheet` touch 0 |
| 기존 D5 chip strip / D4 priority hierarchy / D3 reason 회귀 | Low | High | Phase 1 test 가 D1~D5 + E1+E2 invariant 보존 grep 포함 |
| Vercel build module-not-found (오늘 세션 hot fix 패턴) | Low | High | popup.tsx 만 수정 — 새 helper 파일 신설 0 |

## 10. Rollback Strategy

- If Phase 1 Fails: test 파일 삭제 (`popup-visual-uplift-f1.test.ts`)
- If Phase 2 Fails: popup.tsx git revert (단일 commit)
- If Phase 3 Fails: vercel previous deploy `a0a492a8` rollback

**Special Cases:** 없음 — DB migration / billing / soft_enforce 전환 무관

## 11. Progress Tracking

- Overall completion: 25% (Phase 0 complete)
- Current phase: Phase 1 진입 직전
- Current blocker: 없음
- Next validation step: Phase 1 RED test 작성

**Phase Checklist:**
- [x] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete

## 12. Notes & Learnings

**Blockers Encountered:**
- 없음

**Implementation Notes:**
- Option A (popup → rail 전환) 는 별도 batch — 다음 세션 권장. 이번 batch 의 LABAXIS AI INSIGHT block 의 다크 모드 + glow 디자인은 rail 으로 옮겨도 그대로 reuse 가능 (block 단위 단일 위치).
- 호영님 Gemini mockup 의 layout (`flex items-start gap-8` + `w-[420px] sticky top-8`) 은 다음 batch 영역 — 이번 batch 에서는 popup 내부 시각만.
