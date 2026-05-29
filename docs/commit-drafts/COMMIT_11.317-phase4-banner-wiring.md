feat(brief): §11.317 Phase 4 #banner-wiring — popup-context selectedCategory 확장 + 헤더 배너 → stock_risk 자동 진입 (호영님 P1, 2026-05-29)

호영님 P1 §11.317 Phase 4 (GREEN) — 진입 동선 wiring 종결.

배경:
- Phase 2: 재고 헤더에 1줄 배너 추가, onClick = operationalBriefPopup.open() (category hint 없음)
- Phase 3: 운영 브리핑 stock_risk 카테고리에 5 카드 추가
- 현재: 배너 클릭 시 popup 은 열리지만 카테고리 grid 부터 시작 → 사용자가 다시 "재고 관리" 선택해야 함 (2 step)
- 목표: 배너 클릭 즉시 stock_risk 카테고리로 진입 (1 step, 자동 scroll)

Fix (Phase 4 — 3 file):

- apps/web/src/components/operational-brief/popup-context.tsx:
  · import type { InboxSourceModule } 추가
  · OperationalBriefPopupContextValue 확장:
    - `selectedCategory: InboxSourceModule | null` (외부 hint state)
    - `setSelectedCategory: (cat) => void` (외부에서 직접 set 가능)
    - `open(opts?: { category?: InboxSourceModule })` 시그니처 확장 (backward compatible, 인자 0 호출 영향 0)
  · Provider 안 selectedCategory state + open 안 opts.category → setSelectedCategory wiring
  · close 시 selectedCategory 도 reset (다음 open 시 stale hint 차단)
  · NOOP_VALUE 도 selectedCategory/setSelectedCategory 포함 (Provider 미mount 시 silent noop)

- apps/web/src/components/operational-brief/popup.tsx:
  · useOperationalBriefPopup() destructure 에 `selectedCategory: ctxSelectedCategory`, `setSelectedCategory: setCtxSelectedCategory` 추가
  · useEffect 추가 (단방향 context → internal sync):
    - isOpen && ctxSelectedCategory → setSelectedCategory(ctx) + setViewMode("list") + setSelectedItemId(null)
    - 즉시 ctx hint reset (1회성, 동일 카테고리 재open 도 sync 보장)
  · 기존 popup close reset useEffect / internal state / 다른 setSelectedCategory 호출 영향 0

- apps/web/src/app/dashboard/inventory/inventory-content.tsx:
  · 배너 onClick: `() => operationalBriefPopup.open()` → `() => operationalBriefPopup.open({ category: "stock_risk" })`
  · 1줄 변경, 다른 wiring 영향 0

canonical truth 보존 (회귀 0):
- 다른 caller(FloatingEntry / mobile-bottom-sheet 등)의 open() 인자 0 호출 변경 0 — backward compatible
- popup 내부 onSwitchCategory / setSelectedCategory(internal) wiring 보존
- close → reset (selectedItemId + selectedCategory + isMinimized 모두 reset) — 다음 open 깨끗
- categoryStats / items derivation 영향 0

Phase 1 sentinel GREEN 전환 (예상):
- popup-context.tsx selectedCategory: type 단언 ✓
- popup-context.tsx setSelectedCategory: 단언 ✓
- popup-context.tsx open({category}) 시그니처 ✓
- NOOP_VALUE selectedCategory/setSelectedCategory ✓
→ Phase 1 RED sentinel 의 §11.317 — popup-context selectedCategory API 확장 describe 블록 모두 GREEN.

호영님 production effect:
1. /dashboard/inventory 진입 → 운영 조치 N건 시 yellow 배너 노출 (Phase 2)
2. 배너 클릭 즉시 운영 브리핑 popup open + "재고 관리" 카테고리 노출 + 5 카드 grid 노출 (Phase 3 + 4)
3. 사용자 1 step 으로 폐기 영역 진입 (기존 2 step → 1 step)
4. 다른 popup 호출 경로(FloatingEntry / MobileBottomSheet 헤더 등) 영향 0

Out of Scope (⚠️ 본 batch 미포함, Phase 5):
- 모바일 final + 기존 8 sentinel(labaxis-inventory-lot-issue/disposal/...) 정합 처리
- dead-ref hidden block (handleLotIssueDecisionAction 등) cleanup
- count value 정확 표시 위한 canonical hook 추출 (선택)

Rollback path: git revert <SHA>
- popup-context 확장 + popup useEffect + 배너 onClick 모두 단일 commit revert

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/operational-brief/popup-context.tsx `
  apps/web/src/components/operational-brief/popup.tsx `
  apps/web/src/app/dashboard/inventory/inventory-content.tsx `
  docs/commit-drafts/COMMIT_11.317-phase4-banner-wiring.md
git status
git commit -F docs/commit-drafts/COMMIT_11.317-phase4-banner-wiring.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory 진입 → 운영 조치 N건 시 yellow 배너 노출
3. 배너 클릭 → 운영 브리핑 popup open + 즉시 "재고 관리" 카테고리 표시 (카테고리 grid 단계 skip)
4. 5 카드 grid 노출 → 카드 클릭 → 폐기 검토 탭 이동 (Phase 3 wiring)
5. popup close 후 다른 트리거(FloatingEntry / 헤더 등)로 popup open → category grid 부터 시작 (stale hint 0)
6. 다른 카테고리 진입(chip strip) 정상 동작 확인 (회귀 0)

## Next (호영님 push 회신 후)
- Phase 5: 모바일 final + 기존 8 sentinel 정합 + dead-ref cleanup + 회귀 통합
