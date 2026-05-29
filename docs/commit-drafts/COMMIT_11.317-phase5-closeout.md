test+docs: §11.317 Phase 5 #closeout — 4 sentinel obsolete + plan 종결 + 모바일 회귀 통합 (호영님 P1, 2026-05-29)

호영님 P1 §11.317 Phase 5 (GREEN, 종결) — sweep 후속 sentinel 정합 + plan closeout.

배경:
- Phase 2 에서 inventory-content.tsx 폐기 strip(90 lines, lot-issue-priority-strip /
  disposal-review-state / approval-waiting-state / executable-state / handoff-strip /
  queue-strip / action-stack / visible-audit-summary / disposal-priority-badge 등)
  제거됨.
- 기존 4 sentinel file 이 옛 testid 단언 15 개 보유 → 옛 strip 자체가 사라져 stale.

Fix (Phase 5 — 4 sentinel file, docs-only-ish):

- apps/web/src/__tests__/dashboard/inventory-lot-issue-badge-273c.test.ts:
  · 3 describe → describe.skip 일괄 swap
  · obsolete docblock 추가 (§11.317 Phase 2 이관 + 새 가드 reference)

- apps/web/src/__tests__/inventory/inventory-disposal-order-visible-303.test.ts:
  · 1 describe → describe.skip
  · obsolete docblock 추가

- apps/web/src/__tests__/inventory/inventory-lot-issue-handoff-strip-280.test.ts:
  · 1 describe → describe.skip (현재 담당/다음 조치/인계 상태 단언)
  · obsolete docblock 추가

- apps/web/src/__tests__/inventory/lot-issue-strip-color-273c.test.ts:
  · 2 describe → describe.skip
  · obsolete docblock 추가

- docs/plans/PLAN_11.317-inventory-header-brief-migration.md:
  · Status: 🔄 In Progress → ✅ Closed (Phase 0~5 Complete, 2026-05-29 종결)
  · Last Updated 2026-05-29 + Phase Checklist 전부 [x] 마킹

회귀 0 (보존):
- 4 file 자체는 보존 (후속 cleanup batch 에서 file 삭제 검토 — 본 batch 는 obsolete 표기만)
- 다른 4 sentinel(expired-lot-disposal-state-entry-contract / inventory-lot-issue-priority-strip-270 /
  lot-disposal-panel-approval-summary-266d / inventory-content-traffic-light-302d3) 은 옛 testid 직접
  단언 0 으로 그대로 통과 — 영향 0
- inventory-content.tsx 의 dead-ref hidden block (false && {...}) 그대로 유지
  (TypeScript noUnusedLocals 회피, handleLotIssueDecisionAction 변수는 폐기 검토 탭에서 사용 가능성 보존)
- 모바일 KPI grid-cols-2 md:grid-cols-4 Phase 2 에서 이미 적용 — 추가 변경 0

호영님 production effect:
- 없음 (test obsolete + plan docs 만). source/UX 변경 0.
- vitest 실행 시 4 file 의 lot-issue 단언 skip → CI green 회복.
- Plan 문서 readers 가 §11.317 종결 상태 즉시 파악.

§11.317 종결 — 5 phase 전체 완료 요약:
- Phase 0 ✅: Truth Lock + evidence (폐기 strip 위치 / popup API / deep link / sentinel 회귀 8 file)
- Phase 1 ✅: Failing sentinel — inventory-header-brief-migration-317.test.ts (~12 it)
- Phase 2 ✅: Header simplification — 폐기 strip 90 lines 제거 + KPI 4 + 1줄 배너
- Phase 3 ✅: 운영 브리핑 stock_risk 5 카드 강화 (deep link)
- Phase 4 ✅: popup-context selectedCategory 확장 + 배너 → stock_risk 자동 진입
- Phase 5 ✅: 4 sentinel obsolete + describe.skip + plan closeout

⚠️ 후속 권장:
- §11.317-cleanup: 4 obsolete sentinel file 자체 삭제 (지금은 obsolete docblock + describe.skip 만)
- §11.317-canonical: count value 정확 표시 위해 공통 hook 추출 (현재 popup 5 카드는 label 만)

Rollback path: git revert <SHA>
- 4 file describe.skip 복원 + plan Status revert. source 변경 0.

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/__tests__/dashboard/inventory-lot-issue-badge-273c.test.ts `
  apps/web/src/__tests__/inventory/inventory-disposal-order-visible-303.test.ts `
  apps/web/src/__tests__/inventory/inventory-lot-issue-handoff-strip-280.test.ts `
  apps/web/src/__tests__/inventory/lot-issue-strip-color-273c.test.ts `
  docs/plans/PLAN_11.317-inventory-header-brief-migration.md `
  docs/commit-drafts/COMMIT_11.317-phase5-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.317-phase5-closeout.md
git push origin main
```

## Production smoke
- 해당 없음 (test obsolete + plan docs). Vercel READY 확인만.

## Next (호영님 push 회신 후)
- §11.321 (구 §11.316, 번호 충돌로 매핑): 재고 관리 탭 세그먼트 컨트롤화 (호영님 신규 spec, P1, 2~3h)
- 또는 §11.319 (구 §11.314, 시약 라벨 스캔), §11.320 (구 §11.315, 재고 상세 우측 패널) — 호영님 결정
