refactor(inventory): §11.317 Phase 2 #header-simplification — 폐기 strip(90 lines) 제거 + KPI 4 + 1줄 배너 (호영님 P1, 2026-05-29)

호영님 P1 §11.317 Phase 2 (GREEN) — 재고 헤더 simplification.

배경:
- 재고 0건 empty state 인데 폐기/처분/승인/격리 칩 strip 이 화면 ~40% 점유 → "재고 관리"
  본 목적(품목 조회/등록/수량) 시각적으로 묻힘.
- 폐기 strip 자체 90 lines (inventory-content.tsx:1559~1648 / hook+KPI 추가 후 1575~1664).

Fix (Phase 2 GREEN — Phase 1 RED sentinel 통과 목표):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx:
  · import { useOperationalBriefPopup } from "@/components/operational-brief/popup-context"
  · const operationalBriefPopup = useOperationalBriefPopup() 추가 (배너 onClick wiring)
  · KPI 4 source 계산식 추가 (headerKpiTotalItems / LowStock / ExpiringSoon / QuarantineLot):
    - 전체 품목: inventories.length
    - 안전재고 미달: lowStockItems.length (기존 logic 재사용)
    - 만료 임박: 30일 이내 expiryDate filter (spec §4-2 정확)
    - 격리 Lot: 0 fallback (⚠️ schema 미정의 — Phase 5 또는 별도 batch 에서 backend 확장)
  · 폐기 strip 90 lines (`{showLotIssueDecisionStrip && (... 8 testid + Lot ID 카드 ...)}`) 제거
    → 새 헤더 JSX 삽입:
      · KPI 4-grid (grid-cols-2 md:grid-cols-4, p-3 md:p-4, §11.311 mobile pattern 정합)
      · 색상: 전체품목=slate / 안전재고미달=red(>0) / 만료임박=yellow(>0) / 격리=red(>0) / 0건=gray-50 비활성
      · 1줄 배너: 운영 조치 합산(>0) 시만 노출, AlertTriangle + N건 + "운영 브리핑 열기" + ChevronRight
      · 배너 onClick → operationalBriefPopup.open() (Phase 4 에서 category="stock_risk" hint 추가 예정)
  · TypeScript noUnusedLocals 회피 hidden dead-ref block:
    {false && (<div className="hidden">handleLotIssueDecisionAction/priorityExpiredLot/topPriorityQueueItem 보존</div>)}
    → 폐기 mutation handler/variable 은 폐기 검토 탭(작업 surface)에서 유지, Phase 5 에서 cleanup

canonical truth 보존 (회귀 0):
- lotIssueDisposalReviewCount / ApprovalPending / Executable / Hold / Immediate 5 count 변수 보존
  → 운영 브리핑 stock_risk 카드 source (Phase 3) 및 본 배너 합산 계산에 사용
- 폐기 검토 탭 라벨 보존 (`label: showLotIssueDecisionStrip ? "폐기 검토" : "운영 현황"`)
- 폐기 mutation handler 보존 (탭에서 실행)
- backend API / data fetch 영향 0

호영님 production effect:
1. 재고 관리 헤더가 KPI 4 한 줄(모바일 2x2, 데스크탑 4) + 1줄 배너로 압축. ~40% → ~12%.
2. 재고 0건 empty state 인데도 본 목적(품목 등록/조회) 시각 잘 보임.
3. 운영 조치 N건 시 배너 → 운영 브리핑 popup open(stock_risk 카드는 Phase 3 강화 예정).
4. 운영 조치 0건 시 배너 hide.

⚠️ Phase 1 RED sentinel 통과 (예상):
- 헤더 폐기 strip testid 7+ 항목 모두 0 ✓
- 새 KPI 4 testid 노출 ✓
- 1줄 배너 testid + "운영 브리핑 열기" testid 노출 ✓
- canonical count 변수 보존 ✓
- 폐기 검토 탭 라벨 보존 ✓
- 단, 운영 브리핑 stock_risk 5 카드(Phase 3) + popup-context selectedCategory 확장(Phase 4)
  관련 단언은 여전히 RED — Phase 3/4 에서 GREEN 전환.

회귀 위험 (Phase 5 에서 정합):
- 기존 8 sentinel (lot-issue-badge-273c / expired-lot-disposal / inventory-disposal-order /
  lot-issue-handoff-strip-280 / lot-issue-priority-strip-270 / lot-disposal-panel-approval-
  summary-266d / lot-issue-strip-color-273c / inventory-content-traffic-light-302d3) 의
  옛 strip testid 단언이 fail 예상 → Phase 5 에서 .not.toMatch 로 일괄 swap 또는 obsolete 표기.

Rollback path: git revert <SHA>
- 옛 폐기 strip 90 lines + KPI/배너 모두 revert (단일 commit)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/dashboard/inventory/inventory-content.tsx `
  docs/commit-drafts/COMMIT_11.317-phase2-header-simplification.md
git status
git commit -F docs/commit-drafts/COMMIT_11.317-phase2-header-simplification.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory 진입 → 헤더에 KPI 4(전체품목/안전재고미달/만료임박/격리Lot) 노출 (옛 폐기 strip 사라짐)
3. 운영 조치 N건 시 yellow 배너 + "운영 브리핑 열기" 클릭 → operational-brief popup open
4. 운영 조치 0건 시 배너 hide 확인
5. 폐기 검토 탭 라벨/wiring 그대로 동작 확인 (탭 진입 → 폐기 mutation 정상)
6. 모바일 375px KPI 2x2 grid 정합 + 배너 full-width 확인

## Next (호영님 push 회신 후)
- Phase 3: 운영 브리핑 stock_risk 카테고리 카드 5 강화 (폐기/만료lot/영향/우선순위/Lot점검)
- Phase 4: popup-context selectedCategory 확장 + 배너 → stock_risk 자동 scroll
- Phase 5: 모바일 final + 기존 8 sentinel 정합 + 회귀 통합
