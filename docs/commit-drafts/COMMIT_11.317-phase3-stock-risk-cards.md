feat(brief): §11.317 Phase 3 #stock-risk-cards — 운영 브리핑 stock_risk 카테고리 5 카드 강화 (호영님 P1, 2026-05-29)

호영님 P1 §11.317 Phase 3 (GREEN) — 운영 브리핑 stock_risk 카드 강화.

배경:
- Phase 2 에서 재고 헤더의 폐기 strip(90 lines) 제거됨 → 폐기 정보가 운영 브리핑(stock_risk)
  카테고리에서 흡수되어야 함.
- 기존 stock_risk 카테고리는 일반 inbox item list 만 노출 — 폐기 영역 카드 부재.

Fix (Phase 3 — popup.tsx 단일 file):

- apps/web/src/components/operational-brief/popup.tsx:
  · import Link from "next/link" 추가
  · const STOCK_RISK_LOT_ISSUE_HREF = "/dashboard/inventory?filter=lot_issue&tab=overview"
    (§11.308e SmartReceivingStatusCard / Phase 4 헤더 배너와 동일 deep link)
  · PopupCategoryListWithExpand 안 (chip strip 후 items list 전) 에 stock_risk 분기 5 카드 grid 추가:
    1. 폐기 처분 (red) — 처분 검토·승인 대기·실행 가능 통합
    2. 만료 Lot (red) — 1순위 폐기 처리, 사용 금지 lot
    3. 폐기 영향 분석 (yellow) — 재고 영향·안전재고 확인
    4. 처리 우선순위 (slate) — 폐기 처리 우선·보류·즉시 확인·폐기 검토
    5. Lot 점검 필요 (blue, col-span-2) — Lot ID·수량·만료일·위치·사유
  · 각 카드 = <Link> deep link (real route, 항상 활성, dead button 0)
  · 안내문구: "카드를 누르면 폐기 검토 탭(작업 surface)으로 이동하여 실제 처리합니다"
    (운영 브리핑 = 알림/요약 / 폐기 검토 탭 = 작업 실행 원칙 명시)

canonical truth 보존 (회귀 0):
- 5 카드 = display-only (count value 직접 노출 0, label + helper text 만)
- 폐기 mutation = 폐기 검토 탭(작업 surface) 전담 — popup 안 mutation button 0
- 색상 §11.302 신호등 정합 (위험=red, 주의=yellow, 정보=blue, 정보성=slate)
- 다른 카테고리(quote/po/receiving) 영향 0 — stock_risk 분기 만

Phase 1 sentinel 통과 (예상 GREEN 전환):
- operational-brief-stock-risk-disposal-card ✓
- operational-brief-stock-risk-expired-lot-card ✓
- operational-brief-stock-risk-disposal-impact-card ✓
- operational-brief-stock-risk-priority-card ✓
- operational-brief-stock-risk-lot-check-card ✓
- /dashboard/inventory?filter=lot_issue&tab=overview deep link ✓

호영님 production effect:
1. 운영 브리핑 popup 에서 "재고 관리" 카테고리 선택 시 chip strip 바로 아래에 폐기 영역 5 카드 노출.
2. 각 카드 클릭 → /dashboard/inventory?filter=lot_issue&tab=overview (폐기 검토 탭) 이동.
3. 운영 브리핑 = 알림/요약 / 폐기 검토 탭 = 작업 실행 — 역할 분리 명확.
4. 다른 카테고리(견적/발주/입고) 영향 0.

Out of Scope (⚠️ 본 batch 미포함):
- count value 정확 표시 (Phase 5 에서 공통 hook 추출로 canonical 정합 강화 검토)
- popup-context selectedCategory 외부 노출 (Phase 4 — 헤더 배너 → stock_risk 자동 진입 wiring)
- 모바일 final + 기존 8 sentinel 정합 (Phase 5)

Rollback path: git revert <SHA>
- Link import + 5 카드 grid + STOCK_RISK_LOT_ISSUE_HREF 모두 단일 commit revert

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/operational-brief/popup.tsx `
  docs/commit-drafts/COMMIT_11.317-phase3-stock-risk-cards.md
git status
git commit -F docs/commit-drafts/COMMIT_11.317-phase3-stock-risk-cards.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard 또는 /dashboard/inventory 에서 운영 브리핑 popup open (FloatingEntry 또는 헤더 배너)
3. 카테고리 그리드 → "재고 관리" 선택
4. chip strip 바로 아래 5 카드 grid 노출 (폐기 처분/만료 Lot/폐기 영향 분석/처리 우선순위/Lot 점검 필요)
5. 각 카드 클릭 → /dashboard/inventory?filter=lot_issue&tab=overview (폐기 검토 탭) 이동 확인
6. 다른 카테고리(견적/발주/입고)는 5 카드 노출 0 (stock_risk 분기만)

## Next (호영님 push 회신 후)
- Phase 4: popup-context selectedCategory 확장 + 헤더 배너 onClick → operationalBriefPopup.open({ category: "stock_risk" }) wiring
- Phase 5: 모바일 final + 기존 8 sentinel(lot-issue-* testid) 정합 + 회귀 통합 + dead-ref block cleanup
