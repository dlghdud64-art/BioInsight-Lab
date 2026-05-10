# Implementation Plan: Operational Brief Rail Conversion (Option A)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-11
- **Last Updated:** 2026-05-11
- **Estimated Completion:** 2026-05-11 (single session, ambitious)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/components/operational-brief/popup.tsx` (986 lines, F1 GREEN — 19 cluster land 누적)
- `apps/web/src/components/operational-brief/popup-context.tsx` (현재 modified — 호영님 직전 작업 audit 필요)
- `MobileOperationalBriefSheet` (mobile 전용)
- `CLAUDE.md` §11.142 lock — popup OR per-surface ContextPanel rail 허용
- 호영님 Gemini Studio mockup — dashboard 좌측 메인 + 우측 sticky `w-[420px]` rail

**Chosen Source of Truth:**
- popup.tsx 내부 contents 그대로 reuse (19 cluster invariant 보존)
- outer wrapper 만 responsive 분기 (rail / popup / sheet)

**Environment Reality Check:**
- [x] vitest, tsc, vercel deploy runnable
- [x] popup-context.tsx audit 필요 (Phase 0)

## 1. Priority Fit
- [x] P2 / Deferred (호영님 5 axis redesign 일관성으로 우선순위 ↑)

## 2. Work Type
- [x] Web
- [x] Design Consistency
- [x] Feature (rail wrapper 신설)

## 3. Overview

**Feature Description:**
운영 브리핑을 popup overlay (모든 surface 공통) 에서 desktop 한정 sticky right rail (`w-[420px]`) 로 전환. tablet/mobile 은 기존 popup/sheet 유지. dashboard / quotes / purchases / receiving / inventory 5 surface 통합. floating button 은 desktop 에서 hide.

**Success Criteria:**
- [ ] desktop (≥ xl): rail 항상 노출 + button hide
- [ ] tablet (md~xl): popup 유지 + button show
- [ ] mobile (< md): sheet 유지 + button show
- [ ] 5 surface 모두 정합 (dashboard / quotes / purchases / receiving / inventory)
- [ ] E3 (back button 강화) + E4 (상단 여백 압축) 통합
- [ ] popup.tsx 의 19 cluster invariant 보존
- [ ] vitest + tsc + Chrome smoke GREEN

## 4. Product Constraints

**Must Preserve:**
- [x] §11.142 운영 브리핑 lock (popup OR rail 허용)
- [x] same-canvas (rail 도 surface 안 통합 — 별도 페이지 X)
- [x] canonical truth (selectedSignals / item.priority / CATEGORIES 변경 0)
- [x] mobile (`MobileOperationalBriefSheet`) touch 0

**Must Not Introduce:**
- [x] page-per-feature (rail 은 surface 안 통합)
- [x] dead button / no-op
- [x] popup.tsx contents 회귀 (19 cluster invariant)

## 5. Architecture

**Wrapper 분리:**
```
<OperationalBriefRail />   — desktop, sticky right w-[420px], 항상 노출
<OperationalBriefPopup />  — tablet, overlay slide (현재 형태)
<MobileOperationalBriefSheet /> — mobile, sheet (현재 형태, touch 0)
```

**popup.tsx contents (19 cluster) 그대로 reuse:**
- PopupCategoryGrid (Tier 1)
- PopupCategoryListWithExpand (Tier 2+3)
- PopupBriefInline (Tier 3 expand)
- LABAXIS AI INSIGHT block (F1 다크 + glow)
- LIVE pill (F1)
- back button (F1)

## 7. Implementation Phases

### Phase 0: Truth Lock
- Status: [ ] Pending

popup-context.tsx 현재 modified 상태 audit. responsive breakpoint 결정 (xl=1280px 권장).

### Phase 1: RED — rail wrapper sentinel test
- Status: [ ] Pending

새 test `popup-rail-conversion-g1.test.ts` — rail wrapper 분기 + responsive + floating button hide + 19 cluster 보존.

### Phase 2: GREEN — rail wrapper 신설 + dashboard 통합
- Status: [ ] Pending

`<OperationalBriefRail />` 신설. dashboard 1 surface 통합 (sticky right rail). floating button desktop hide.

### Phase 3: dashboard canvas 재배치
- Status: [ ] Pending

dashboard 좌측 main content (KPI 4 cell + spend trend + 활동 timeline) max-w 조정. rail (w-[420px]) 와 balance.

### Phase 4: 4 surface 추가 통합
- Status: [ ] Pending

quotes / purchases / receiving / inventory 4 surface 동일 rail 통합.

### Phase 5: E3 + E4 적용
- Status: [ ] Pending

back button 추가 강화 (rail 모드 효익 재평가) + 상단 여백 압축.

### Phase 6: 검증 + ADR + commit
- Status: [ ] Pending

vitest + tsc + Chrome smoke (5 surface) + ADR §11.219 entry + commit.

## 11. Progress Tracking

- [ ] Phase 0
- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
- [ ] Phase 6
