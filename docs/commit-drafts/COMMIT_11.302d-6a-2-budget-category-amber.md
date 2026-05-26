# §11.302d-6a-2 Commit Message Draft (BudgetPredictionWidget + CategorySpendingWidget amber swap)

```
chore(dashboard): §11.302d-6a-2 #budget-category-amber-removed — BudgetPredictionWidget 4 위치 + CategorySpendingWidget warning STATUS_CONFIG amber → yellow swap (soft_limit orange 보존 — 의미 분석 후속) (호영님 P1 sweep batch 2/4, 2026-05-26)

호영님 P1 sweep spec (Q35 = A, 2026-05-26):
§11.302d-6a critical surfaces ~10 file 안에서 batch 2/4.
1/4 (§11.302d-6a-1) = badge.tsx + Header.tsx ✅
2/4 (본 batch) = BudgetPredictionWidget + CategorySpendingWidget (단순/중간)
3/4 (§11.302d-6a-3) = executive-summary + ai-action-inbox (tone palette)
4/4 (§11.302d-6a-4) = 3 ai-assistant-panel + dashboard/page.tsx

6a-2 scope:
- BudgetPredictionWidget.tsx (4 위치, 단순 alert):
  - 예산 경고 alert box (line 329-331): amber → yellow
  - 다른 예산 link (line 351): text-amber → text-yellow
- CategorySpendingWidget.tsx (~10 위치, STATUS_CONFIG + bar + chip):
  - warning STATUS_CONFIG (4 properties): amber → yellow 1:1 swap
  - UsageBar warning color: bg-amber-500 → bg-yellow-500
  - 미분류 chip (line 335): text-amber/bg-amber → text-yellow/bg-yellow

§11.302d-6a-2 의도적 보존 (별도 후속):
- soft_limit STATUS_CONFIG (orange 4 properties): 의미 분석 필요
  - "warning (yellow)" 과 "over_budget (red)" 사이 중간 강도
  - 단순 swap 불가 (yellow = warning 과 충돌, red = over_budget 과 충돌)
  - §11.302d-6a-2-soft-limit 후속에서 호영님 Q 후 결정

Fix (2 file 수정 + 1 NEW sentinel):

- apps/web/src/components/dashboard/BudgetPredictionWidget.tsx:
  · line 329-331 예산 경고 alert (selectedBudget.hasWarning):
    - bg-amber-50 → bg-yellow-50
    - border-amber-200 / border-amber-800/40 → border-yellow-200 / border-yellow-800/40
    - text-amber-600 text-amber-400 → text-yellow-600 text-yellow-400
    - text-amber-200 → text-yellow-200
  · line 351 다른 예산 link:
    - text-amber-600 text-amber-400 → text-yellow-600 text-yellow-400
  · §11.302d-6a-2 주석 추가 (swap 근거 명시)

- apps/web/src/components/dashboard/CategorySpendingWidget.tsx:
  · STATUS_CONFIG.warning (line 60-66):
    - bgColor: bg-amber-50 → bg-yellow-50
    - textColor: text-amber-700 → text-yellow-700
    - dotColor: bg-amber-500 → bg-yellow-500
    - borderColor: border-amber-200 → border-yellow-200
  · UsageBar barColor (line 164):
    - status === "warning" ? "bg-amber-500" → "bg-yellow-500"
  · 미분류 chip (line 335):
    - text-amber-700 bg-amber-50 hover:bg-amber-100
    → text-yellow-700 bg-yellow-50 hover:bg-yellow-100
  · STATUS_CONFIG.soft_limit orange 보존 + 주석으로 후속 검토 명시
  · §11.302d-6a-2 주석 추가

- apps/web/src/__tests__/regression/
  budget-category-amber-removed-302d6a2.test.ts (NEW, ~17 it):
  · BudgetPredictionWidget 5 it (amber/orange 0 / 경고 alert yellow /
    link yellow / hasWarning 분기 보존)
  · CategorySpendingWidget warning swap 4 it (amber 0 / warning 4
    property yellow / UsageBar warning yellow / 미분류 chip yellow)
  · soft_limit orange 보존 2 it (orange 4 property + 주석 명시)
  · 회귀 0 5 it (STATUS_CONFIG 5 entry / UsageBar over_budget red /
    normal emerald / over_budget red / MomBadge+StatusIcon 함수)

canonical truth 보존 (회귀 0):
- BudgetPredictionWidget selectedBudget.hasWarning 분기 보존
- CategorySpendingWidget STATUS_CONFIG 5 entry 구조 보존
- UsageBar over_budget/soft_limit → red / warning → yellow / 그 외 emerald
- MomBadge / StatusIcon / formatWon 함수 변경 0
- soft_limit orange 보존 (별도 후속 batch §11.302d-6a-2-soft-limit)

호영님 production effect:
1. labaxis.co.kr/dashboard 예산 예측 widget:
   - 경고 alert box: amber → yellow tone
   - "다른 예산 N건" link: amber → yellow text
   - 시각 차이: 따뜻한 amber → 밝은 yellow (의미 유지)
2. labaxis.co.kr/dashboard 카테고리별 예산 widget:
   - 주의 (warning) status badge / bar: amber → yellow
   - 미분류 chip: amber → yellow
   - 소프트 리밋 (soft_limit) status: orange 유지 (후속 검토 대기)
   - 위험 (over_budget): red 보존
3. CLAUDE.md §11.302 신호등 정합 — 본 2 file warning 위반 0

Out of Scope (§11.302d-6a-3 / 6a-4 / 후속):
- soft_limit orange → yellow/red 결정 (의미 분석 필요)
- executive-summary-section.tsx (tone palette, ~25 위치) — 6a-3
- ai-action-inbox.tsx (variant 매핑, ~10 위치) — 6a-3
- 3 ai-assistant-panel + dashboard/page.tsx — 6a-4
- workbench / approval / sourcing — 6b
- lib + legacy — 6c

Rollback path: git revert <SHA>
- 2 file amber 복원 + 1 sentinel 삭제
- 사용자 영향: 예산 widget 경고 색상 amber 회귀 (시각만, 동작 0)
- soft_limit / over_budget 변경 0 → 위험 신호 보존
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/dashboard/BudgetPredictionWidget.tsx `
  apps/web/src/components/dashboard/CategorySpendingWidget.tsx `
  apps/web/src/__tests__/regression/budget-category-amber-removed-302d6a2.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6a-2-budget-category-amber.md

git status   # modified: 2 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6a-2-budget-category-amber.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr/dashboard 예산 예측 widget:
   - 경고 (hasWarning) 시 alert box = yellow tone (이전 amber)
   - "+ 주의가 필요한 다른 예산 N건" link = yellow text
3. labaxis.co.kr/dashboard 카테고리별 예산 widget:
   - "주의" status badge + UsageBar = yellow
   - "미분류 N건" chip = yellow
   - "소프트 리밋" status badge = orange 유지 (의도적, 후속 검토)
   - "예산 초과 위험" status = red (변경 0)
4. 캐치합: 다른 amber/orange 위반 위치는 후속 batch
```
