# §11.302d-6a-3-β Commit Message Draft (executive-summary-section.tsx tone palette swap)

```
chore(dashboard): §11.302d-6a-3b #executive-summary-amber-removed — executive-summary-section.tsx 4-tone palette amber value swap (key 보존, caller wiring 영향 0) (호영님 P1 sweep batch 3/4-β, 2026-05-26)

호영님 P1 sweep spec (Q35 = A, 2026-05-26):
§11.302d-6a critical surfaces batch 3/4-β (2/2). ai-action-inbox (6a-3-α)
완료 후속 — KPI 4-tone palette (blue=지출, emerald=정상, amber=경고, rose=위험)
의 amber value 만 yellow swap.

핵심 패턴 (badge.tsx 정합):
- tone key "amber" 보존 → caller toneOverride / risk 매핑 / 분기 로직
  영향 0 (단순 색상 swap)
- 값 (Tailwind class) 만 yellow swap
- 분기 로직 `tone === "amber"` literal 보존 (key 매칭용)

§11.302d-6 시리즈 진행:
- §11.302d-6 ✅ audit + scope 분할
- §11.302d-6a (critical 4 sub-batch)
  - §11.302d-6a-1 ✅ badge.tsx + Header.tsx
  - §11.302d-6a-2 ✅ BudgetPrediction + CategorySpending (soft_limit 후속)
  - §11.302d-6a-3-α ✅ ai-action-inbox
  - §11.302d-6a-3-β ✅ 본 batch (executive-summary tone palette)
  - §11.302d-6a-4 (3 ai-assistant-panel + dashboard/page.tsx) — 후속
- §11.302d-6b (workbench/approval) — 후속
- §11.302d-6c (lib + legacy) — 후속

Fix (1 file 10 위치 + 1 NEW sentinel):

- apps/web/src/components/dashboard/executive-summary-section.tsx:
  · iconContainerMap.amber (line 279):
    "bg-amber-50 text-amber-600" → "bg-yellow-50 text-yellow-600"
  · hoverBorderMap.amber (line 286):
    "hover:border-amber-200" → "hover:border-yellow-200"
  · progressBarMap.amber (line 293):
    "bg-amber-500" → "bg-yellow-500"
  · valueColorMap.amber (line 300):
    "text-amber-700" → "text-yellow-700"
  · 동적 shadow class (line 325):
    `shadow-${tone === "amber" ? "amber" : ...}-100`
    → `shadow-${tone === "amber" ? "yellow" : ...}-100`
  · delta chip glassmorphism (line 342):
    "bg-amber-50/80 text-amber-700 border-amber-200/60 backdrop-blur-sm"
    → "bg-yellow-50/80 text-yellow-700 border-yellow-200/60 backdrop-blur-sm"
  · dot ping (line 351):
    `tone === "amber" ? "bg-amber-500"` → `... ? "bg-yellow-500"`
  · gradientMap.amber (line 839):
    "from-amber-700 to-amber-900" → "from-yellow-700 to-yellow-900"
  · dotMap.amber (line 846):
    "bg-amber-400" → "bg-yellow-400"
  · §11.302d-6a-3-β 주석 3건 추가 (key 보존 + 값 swap 근거 명시)

- apps/web/src/__tests__/regression/
  executive-summary-amber-removed-302d6a3b.test.ts (NEW, ~24 it):
  · amber Tailwind class 0 — 5 it (bg/text/border/border-l/hover/
    shadow/from/to amber)
  · tone key 'amber' 보존 — 5 it (toneOverride type union /
    risk → tone 매핑 / tone === amber 분기 5+회 / 라벨 "주의" /
    width 78%)
  · 4 map yellow swap — 4 it (iconContainerMap/hoverBorderMap/
    progressBarMap/valueColorMap)
  · dynamic shadow + delta chip + dot ping — 3 it
  · gradientMap + dotMap yellow — 2 it
  · 회귀 0 — 6 it (iconContainerMap 4 entry / rose / emerald / blue
    변경 0 / breakdownExpanded 보존 / gradientMap 4 entry)

canonical truth 보존 (회귀 0):
- toneOverride type "blue" | "emerald" | "amber" | "rose" 유지
- risk → tone 매핑 (warning → amber) 보존 → caller behavior 변경 0
- tone === "amber" 분기 로직 보존 → JSX 출력 분기 유지
- 라벨 ("주의") + width (78%) + 주석 amber 보존 (의미 설명)
- rose / emerald / blue tone 변경 0
- §11.139 breakdownExpanded 보존 (모바일 collapsible)
- §11.82 / §11.206 KPI 시안 정합 보존

호영님 production effect:
1. labaxis.co.kr/dashboard 4 KPI 카드:
   - "warning" risk 카드 (예: 미회수 견적 N건) → amber → yellow tone
     · icon container / hover border / progress bar / value text 모두 yellow
     · delta chip / dot ping / shadow / gradient / dot 모두 yellow
   - 시각 차이: 따뜻한 amber → 밝은 yellow (경고 의미 유지)
2. 다른 risk 카드 (critical=rose / safe=emerald / spend=blue) 변경 0
3. CLAUDE.md §11.302 신호등 정합 — 본 file 위반 위치 ~10 → 0
4. 분기 로직 (tone === "amber") 그대로 → KpiCard caller (다른 widget) 영향 0

Out of Scope (§11.302d-6a-4 / 후속):
- 3 ai-assistant-panel (inventory / order / quote) — 6a-4
- dashboard/page.tsx (2 orange) — 6a-4
- workbench / approval / sourcing — 6b
- lib + legacy — 6c

Rollback path: git revert <SHA>
- 1 file amber 복원 + 1 sentinel 삭제
- 사용자 영향: warning risk KPI 카드 색상 amber 회귀 (시각만)
- 다른 tone (rose/emerald/blue) + KpiCard 동작 변경 0
- caller toneOverride / risk 매핑 영향 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/dashboard/executive-summary-section.tsx `
  apps/web/src/__tests__/regression/executive-summary-amber-removed-302d6a3b.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6a-3b-executive-summary.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6a-3b-executive-summary.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr/dashboard 4 KPI 카드 (Executive Summary):
   - warning risk 카드 (예: "미회수 견적 N건") = yellow tone 전반
     · 아이콘 컨테이너 / 호버 border / progress bar / value 모두 yellow
     · delta chip + dot ping + shadow 모두 yellow
     · 라벨 "주의" 유지
   - critical risk 카드 = rose 유지 (변경 0)
   - safe 카드 = emerald 유지 (변경 0)
   - spend 카드 = blue 유지 (변경 0)
3. Breakdown popup (호버 시 desktop) 정상 동작 — wiring 변경 0
4. Delta chip + arrow + percent 정상 표기
```
