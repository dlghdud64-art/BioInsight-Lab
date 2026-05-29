docs+test(plan): §11.317 #inventory-header-brief-migration Phase 0+1 — Truth Lock evidence + failing sentinel (RED) (호영님 P1, 2026-05-29)

호영님 P1 (구 §11.313, 번호 충돌로 §11.317 매핑) Phase 0+1.

배경:
- 재고 관리 메인 헤더가 폐기/처분/승인/격리 메타로 과적재 → "재고 관리" 본 목적
  (품목 조회/등록/수량) 시각적으로 묻힘. 폐기는 운영 브리핑 책임 영역.
- 5 phase 계획 호영님 승인 완료 (옵션 A — §11.317 종결 후 §11.319 진행).

Phase 0 (Truth Lock — read-only evidence) ✅:

| Evidence | 결과 |
|---|---|
| 폐기 strip 컨테이너 | inventory-content.tsx:1559~1640+ (showLotIssueDecisionStrip && (...)) |
| 우측 "Lot ID 확인" 카드 | 같은 strip 의 lot-issue-action-stack > visible-audit-summary (별도 file 0) |
| 표시 조건 | isBrowserPilotInventoryDisposal \|\| statusFilter === "lot_issue" \|\| activeInventoryTab === "overview" (line 1046) |
| count 변수 (line 1040-1045) | DisposalReview/ApprovalPending/Executable/Hold/Immediate — Phase 2 보존 (브리핑 카드 source) |
| popup-context API | { open, close, isOpen, selectedItemId, setSelectedItemId, isMinimized, toggleMinimize } — selectedCategory 미노출, Phase 4 확장 필요 |
| 폐기 검토 탭 deep link | /dashboard/inventory?filter=lot_issue&tab=overview (이미 §11.308e SmartReceivingStatusCard 정합 사용) |
| 기존 sentinel 회귀 (8 file) | lot-issue-badge-273c / expired-lot-disposal / inventory-disposal-order / lot-issue-handoff-strip-280 / lot-issue-priority-strip-270 / lot-disposal-panel-approval-summary-266d / lot-issue-strip-color-273c / inventory-content-traffic-light-302d3 — Phase 2/5 정합 처리 |

Fix (Phase 0 + Phase 1 묶음, 2 file):

- docs/plans/PLAN_11.317-inventory-header-brief-migration.md (NEW + 갱신):
  · 5 phase plan + Phase 0 evidence 7건 + Phase 4 wiring 디테일 보강
  · Status: 🔄 In Progress / Phase 0 ✅ Complete

- apps/web/src/__tests__/regression/
  inventory-header-brief-migration-317.test.ts (NEW, ~12 it):
  · 헤더: 폐기 strip testid 0, 폐기 chip testid 7 항목 0, 새 KPI 4 testid, 1줄 배너 + 운영 브리핑 열기 testid
  · canonical 보존: lotIssue* 5 count 변수 mutation 0
  · 폐기 검토 탭 라벨 자체 보존 (작업 surface)
  · 브리핑 stock_risk 5 카드 testid (Phase 3 RED)
  · 브리핑 카드 액션 deep link real route (dead button 0)
  · popup-context selectedCategory + setSelectedCategory + open({category}) 확장 + noop fallback 정합 (Phase 4 RED)

회귀 0 (보존):
- source/UX 변경 0 (Phase 0 = read-only, Phase 1 = sentinel only)
- 기존 8 sentinel(labaxis-inventory-lot-issue/disposal 등) 손대지 않음 — Phase 2 sweep + Phase 5 정합 처리
- Vercel build 영향 0 (test file 추가만)

호영님 production effect:
- 없음 (Phase 0+1 은 evidence + RED test). Phase 2 부터 사용자 노출 변경 시작.

⚠️ 진행 강령 (호영님 통제 구조):
- Phase 1 sentinel 은 의도적 FAIL (현재 source 와 충돌) — vitest 1회 실행 시 fail 정상.
- Phase 2 작업으로 GREEN 전환. Phase 별 별도 push.

Rollback path: git revert <SHA>
- plan 문서 + sentinel file 삭제 (source 변경 0 이라 안전)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add docs/plans/PLAN_11.317-inventory-header-brief-migration.md `
  apps/web/src/__tests__/regression/inventory-header-brief-migration-317.test.ts `
  docs/commit-drafts/COMMIT_11.317-phase0-1-plan-red.md
git status
git commit -F docs/commit-drafts/COMMIT_11.317-phase0-1-plan-red.md
git push origin main
```

## Production smoke
- 해당 없음 (docs + RED test). Vercel READY 확인만.

## Next (호영님 push 회신 후)
- Phase 2: 헤더 simplification (폐기 strip 제거, KPI 4 + 1줄 배너)
- 별도 commit + present_files
