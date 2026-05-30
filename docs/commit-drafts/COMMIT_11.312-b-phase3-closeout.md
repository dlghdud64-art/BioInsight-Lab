test(workbench): §11.312-b Phase 3 #closeout — 회귀 audit + §11.268c sentinel 갱신 + PLAN 종결 (호영님 P1, 2026-05-30)

호영님 P1 §11.312-b Phase 3 (GREEN, closeout) — 회귀 audit + 기존 sentinel 갱신 + plan 종결.

배경:
- §11.312-b Phase 2 작업 (별도 줄 제거 + bar 본체 🗑 + AlertDialog) → 기존 sentinel 1건 영향:
  · `__tests__/dashboard/sourcing-action-dock-divider-268c.test.ts` line 44-49: "전체 해제 row border-t border-white/15" 단언 깨짐 (§11.312-b 핵심 결정 = 별도 줄 제거)
- 다른 sentinel (§11.252f search-action-bar-2row + §11.268c 나머지 it) = aria-label="견적 후보 전체 해제" + onClick 패턴 매칭으로 자연 보존
- §11.312-b Phase 1 sentinel (sourcing-bar-clear-all-confirm-312b.test.ts) 모두 자연 GREEN

Fix (Phase 3 — sentinel 1건 갱신 + PLAN closeout):

- apps/web/src/__tests__/dashboard/sourcing-action-dock-divider-268c.test.ts:
  · "전체 해제 row border-t border-white/15 강화" → "§11.312-b 정합 — 옛 별도 줄 'border-t border-white/15' 제거 후 견적 bar 본체 🗑 통합 (라벨/onClick 보존)" 으로 의도 swap
  · `expect(page).toMatch(/border-t border-white\/15/)` → `expect(page).not.toMatch(/border-t border-white\/15[\s\S]{0,200}전체 해제/)` 으로 잔존 0 단언
  · §11.312-b 신규 testid + aria-label 매칭 추가 (canonical 보존 검증)

- docs/plans/PLAN_11.312-b-sourcing-bar-ux-refinement.md:
  · Status: 🔄 In Progress → ✅ Complete
  · Phase 0~3 모두 sandbox 완료
  · scope 3 phases / small (실제 잔여 = 데스크탑 보강 only)

회귀 audit 결과 (sandbox grep):
- §11.252f search-action-bar-2row-252f.test.ts:
  · line 64 `ml-auto|justify-between + Trash2|견적 요청` — Trash2 매칭 ✓
  · line 100-102 handleProtectedAction / setComparisonModalOpen / setRequestWizardOpen 보존 ✓
  · line 105-107 "전체 해제 button 보존" 단언 → aria-label="견적 후보 전체 해제" 안 "전체 해제" 단어 자연 매칭 ✓
- §11.268c sourcing-action-dock-divider-268c.test.ts (line 44-49 갱신 후):
  · 1행 비교 row border-b border-white/20 보존 ✓
  · clearCompare + removeQuoteItem onClick 보존 ✓ (AlertDialogAction 안 동일 패턴)
  · "전체 해제" 라벨 보존 ✓ (aria-label 안 매칭)
  · min-h-[44px] 2 row 보존 ✓
- 다른 sentinel (autocomplete / filter / header / hamburger 등) = 영향 0 ✓
- SourcingCandidatesSheet wiring 영향 0 (§11.312 1차 보존)
- AlertDialog 다른 사용 site 영향 0 (compare/page.tsx clearCompare 단독 사용 보존)

§11.312-b 전체 3 phase 합산 effect:
- Phase 0 Truth audit: §11.312 1차 stale 정정 (sandbox 실제 완료) + §11.312-b 잔여 = 데스크탑 보강 only
- Phase 1 RED: 8 it sentinel
- Phase 2 GREEN: search/page.tsx 1 Edit (별도 줄 제거 + bar 본체 🗑 AlertDialog 통합)
- Phase 3 회귀 + closeout: §11.268c sentinel 1 it 갱신 + PLAN closeout

호영님 production effect (Phase 3 단독):
- production 변화 0 (sentinel + PLAN 갱신만)
- §11.268c sentinel 의도 갱신 = §11.312-b 정합 명시

Out of Scope:
- 다음 트랙 (§11.324 랜딩 Triage 데모 정리 P2 / SMTP §11.314 Phase 2 / 신규 spec)

검증 (sandbox 정적 grep):
- §11.268c sentinel line 44-49 갱신 ✓
- "border-t border-white/15 + 전체 해제" 잔존 0 단언 ✓
- §11.312-b 신규 testid + aria-label 매칭 추가 ✓
- PLAN file Status Complete ✓

Rollback path: git revert <SHA>
- §11.268c sentinel 옛 단언 복원 + PLAN 갱신 revert

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/__tests__/dashboard/sourcing-action-dock-divider-268c.test.ts `
  docs/plans/PLAN_11.312-b-sourcing-bar-ux-refinement.md `
  docs/commit-drafts/COMMIT_11.312-b-phase3-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.312-b-phase3-closeout.md
git push origin main
```

## Production smoke
- N/A (sentinel + PLAN closeout only, production 변화 0)
- 호영님 §11.312-b Phase 2 production smoke 누적 결과 = 효과 확인 완료 가정

## Next (호영님 push 회신 후)

§11.312-b 완전 종결. 다음 트랙 (호영님 결정):
- §11.324 랜딩 /search Triage 데모 정리 (P2 backlog)
- SMTP 자동발송 §11.314 Phase 2 (release-prep deferred)
- §11.318-CORRECTION 환각 억제 batch
- 또는 다른 신규 spec
