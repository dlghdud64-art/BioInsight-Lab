# §11.302d-6a-4-γ Commit Message Draft (dashboard/page.tsx amber/orange swap — 6a 종결)

```
chore(dashboard): §11.302d-6a-4g #dashboard-page-amber-removed — dashboard/page.tsx Tailwind amber(~20)+orange(2) → yellow swap (severity literal "amber" key 보존) — §11.302d-6a critical surfaces 종결 (호영님 P1 sweep batch 4/4-γ, 2026-05-27)

호영님 P1 sweep spec (Q35 = A, 2026-05-26):
§11.302d-6a critical surfaces 마지막 batch (4/4-γ). 본 batch 로 6a 완전 종결.

6a-4-γ scope (dashboard/page.tsx):
- Tailwind amber class (~20) → yellow:
  · risk === "amber" border-l / 아이콘 text-amber-700 (비교/견적/안전 등)
  · 납기 지연 chip / 처리 필요 항목 link / ping·dot / color map value
- orange (2) → yellow:
  · noMovementCount "다음 단계 없음" 정체 경고
  · handoffStallPoint 정체 지점 표시
  · 둘 다 정체/주의 의미 (위험 아님) → yellow

핵심 패턴 (executive-summary 정합):
- severity literal "amber" (risk 시스템 key) 보존 → caller 영향 0
  · inventoryRisk/stockRisk/spendingRisk/quoteRisk = "amber"
  · urgentItems severity "red" | "amber"
  · color map key amber + risk === "amber" 분기
- Tailwind class value 만 yellow swap

§11.302d-6 시리즈 진행:
- §11.302d-6 ✅ audit + scope 분할
- §11.302d-6a ✅✅ critical surfaces 종결 (8 sub-batch)
  - 6a-1 ✅ badge.tsx + Header.tsx
  - 6a-2 ✅ BudgetPrediction + CategorySpending (soft_limit 후속)
  - 6a-3-α ✅ ai-action-inbox
  - 6a-3-β ✅ executive-summary tone palette
  - 6a-4-α ✅ inventory-ai-assistant-panel
  - 6a-4-β ✅ order + quote ai-panel
  - 6a-4-γ ✅ 본 batch (dashboard/page.tsx) — 6a 종결
- §11.302d-6b (workbench/approval ~30 file) — 후속
- §11.302d-6c (lib + legacy ~30 file) — 후속
- §11.302d-6a-2-soft-limit (CategorySpending soft_limit orange) — Q 대기

Fix (1 file ~22 위치 + 1 NEW sentinel):

- apps/web/src/app/dashboard/page.tsx:
  · border-l-amber-500 → border-l-yellow-500 (risk amber + urgentItems)
  · text-amber-700 → text-yellow-700 (아이콘 6+ 위치)
  · text-amber-600 → text-yellow-600
  · text-amber-500 → text-yellow-500
  · bg-amber-50 (변형 /60 /70 포함) → bg-yellow-50
  · bg-amber-400 → bg-yellow-400 (ping)
  · bg-amber-500 → bg-yellow-500 (dot, bg-amber-50 substring swap 시 함께 처리)
  · border-amber-200 (변형 /60 포함) → border-yellow-200
  · text-orange-500 → text-yellow-600 (noMovement + handoffStall 2건)
  · §11.302d-6a-4-γ — severity literal "amber" + color map key 보존
    (Tailwind value 만 swap)

- apps/web/src/__tests__/regression/
  dashboard-page-amber-removed-302d6a4g.test.ts (NEW, ~16 it):
  · amber/orange Tailwind class 0 — 4 it
  · yellow swap 정합 — 4 it (risk border-l / color map / 납기 chip / noMovement)
  · severity literal 보존 — 4 it (risk 4종 / urgentItems type / color
    map type / stockRisk red)
  · 회귀 0 — 4 it (red severity border / slaBreached red /
    recommendedActions wiring / handleNavigateOrOverlay)

canonical truth 보존 (회귀 0):
- risk 시스템 severity literal "amber" key 보존 → risk 분기 동작 변경 0
- red severity 분기 보존 (stockRisk >= 3 / slaBreached → red)
- recommendedActions (비교 판정 / 견적 검토) wiring 변경 0
- handleNavigateOrOverlay 라우팅 변경 0
- urgentItems / color map 구조 보존
- §11.308b 헤더 (대시보드 title) 변경 0

호영님 production effect:
1. labaxis.co.kr/dashboard:
   - 처리 필요 항목 (재고 부족 등) amber → yellow tone
   - 긴급 항목 카드 좌측 border (amber severity) → yellow
   - "다음 단계 없음" / 정체 지점 경고 orange → yellow
   - 납기 지연 chip / 비교·견적 아이콘 amber → yellow
2. red severity (재고 0 / SLA breach) 위험 신호 보존
3. CLAUDE.md §11.302 신호등 정합 — 본 file 위반 위치 ~22 → 0
4. §11.302d-6a critical surfaces 전체 종결 (대시보드 직접 가시 영역 amber 0)

Out of Scope (후속):
- §11.302d-6a-2-soft-limit (CategorySpending soft_limit orange 의미 분석) — Q 대기
- §11.302d-6b (workbench / approval / sourcing ~30 file)
- §11.302d-6c (lib safety-visualization 등 + legacy _workbench ~30 file)

Rollback path: git revert <SHA>
- 1 file amber/orange 복원 + 1 sentinel 삭제
- 사용자 영향: 대시보드 warning 색상 amber 회귀 (시각만)
- risk severity literal + red 분기 + wiring 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/dashboard/page.tsx `
  apps/web/src/__tests__/regression/dashboard-page-amber-removed-302d6a4g.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6a-4g-dashboard-page.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6a-4g-dashboard-page.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr/dashboard:
   - 처리 필요 항목 / 긴급 카드 = yellow tone (이전 amber)
   - "다음 단계 없음" / 정체 지점 = yellow (이전 orange)
   - 납기 지연 chip + 비교·견적 아이콘 = yellow
   - 재고 0 / SLA breach 위험 = red (변경 0)
3. risk 분기 (재고 부족 → 긴급 항목 노출) 정상 동작
4. recommendedActions / handleNavigateOrOverlay 클릭 정상
```
