# §11.302d-6a-4-α Commit Message Draft (inventory-ai-assistant-panel.tsx amber swap)

```
chore(inventory): §11.302d-6a-4a #inventory-ai-panel-amber-removed — inventory-ai-assistant-panel.tsx 16 위치 amber → yellow swap (warning 의미 유지, error/shortage red 보존) (호영님 P1 sweep batch 4/4-α, 2026-05-26)

호영님 P1 sweep spec (Q35 = A, 2026-05-26):
§11.302d-6a critical surfaces 마지막 batch 4/4-α. §11.310 시리즈가
직접 건드린 file → 신중 swap.

6a-4-α scope (inventory-ai-assistant-panel.tsx 16 위치):
- amber 모두 "warning/주의" 의미 (shortage/error 는 red 분기 — 보존)
- amber → yellow 일관 swap (5 고유 패턴 × 다수 위치):
  · bg-amber-50 (변형 /40, /80 포함) → bg-yellow-50
  · text-amber-600 → text-yellow-600
  · text-amber-500 → text-yellow-500
  · text-amber-700 → text-yellow-700
  · border-amber-200 → border-yellow-200

§11.302d-6 시리즈 진행:
- §11.302d-6 ✅ audit + scope 분할
- §11.302d-6a (critical 4 sub-batch)
  - §11.302d-6a-1 ✅ badge.tsx + Header.tsx
  - §11.302d-6a-2 ✅ BudgetPrediction + CategorySpending (soft_limit 후속)
  - §11.302d-6a-3-α ✅ ai-action-inbox
  - §11.302d-6a-3-β ✅ executive-summary tone palette
  - §11.302d-6a-4-α ✅ 본 batch (inventory-ai-assistant-panel)
  - §11.302d-6a-4-β (order + quote ai-panel + dashboard/page.tsx) — 후속
- §11.302d-6b (workbench/approval) — 후속
- §11.302d-6c (lib + legacy) — 후속

Fix (1 file 16 위치 + 1 NEW sentinel):

- apps/web/src/components/ai/inventory-ai-assistant-panel.tsx:
  · ratioColor 중간 구간 (stockRatio <= 0.7): text-amber-600 bg-amber-50
    → text-yellow-600 bg-yellow-50 (위험 0.3 = red, 정상 = emerald 보존)
  · 조치 필요 stat (actionNeededCount > 0): amber → yellow
  · 유효기간 임박 Lot: text-amber-600 → text-yellow-600
  · IssueWarningsSection 컨테이너 (isShortage false): bg-amber-50/40
    → bg-yellow-50/40 (isShortage true = bg-red-50/50 보존)
  · ShieldAlert icon (errors 0): text-amber-500 → text-yellow-500
  · 이슈 건수 Badge (errors 0): bg-amber-50 text-amber-600 border-amber-200
    → yellow (errors > 0 = red 보존)
  · 이슈 row (isWarning): border-amber-200 bg-amber-50/80 → yellow
    (isError = red 보존)
  · severity badge (isWarning): text-amber-600 border-amber-200 bg-amber-50
    → yellow
  · expiry/highlight 영역 (line 716+): bg-amber-50/40 + text-amber-500 +
    border-amber-200 bg-amber-50/80 + bg-amber-50 text-amber-600
    border-amber-200 + text-amber-600 → 모두 yellow

- apps/web/src/__tests__/regression/
  inventory-ai-panel-amber-removed-302d6a4a.test.ts (NEW, ~16 it):
  · amber/orange Tailwind class 0 — 4 it
  · warning yellow swap 정합 — 5 it (ratioColor 0.7 / 조치 필요 /
    IssueWarnings 컨테이너 / severity badge / 임박 Lot)
  · 회귀 0 — 7 it (ratioColor red 0.3 / emerald / error red / icon red /
    §11.310 [견적 요청][바로 발주] / 예상소진 7일 red)

canonical truth 보존 (회귀 0):
- §11.310 [견적 요청] / [바로 발주] 분기 wiring 변경 0
- isShortage / errors / warnings / severity 분기 로직 변경 0
- ratioColor red (0.3) / emerald (정상) 보존 — amber (0.7) 만 yellow
- IssueWarningsSection error severity red 보존 (warning 만 yellow)
- 예상 소진 7일 이하 red 보존
- ReorderReviewSheet 연동 (§11.310) 변경 0
- useReorderRecommendation hook 연동 (§11.310b) 변경 0

호영님 production effect:
1. labaxis.co.kr 재고 → 운영 도우미 패널:
   - 재고 위험 요약 stat: "주의" 구간 (재고 30~70%) amber → yellow
   - "조치 필요" stat: amber → yellow (1+건 시)
   - 유효기간 임박 Lot 표시: amber → yellow
2. 확인 필요한 재고 이슈 섹션:
   - warning severity 이슈 카드 / 배지: amber → yellow
   - error severity (재고 부족 등): red 보존
   - 컨테이너 배경: 부족(shortage) red / 그 외 yellow
3. 시각 차이: 따뜻한 amber → 밝은 yellow (warning 의미 유지)
4. error/shortage 위험 신호 (red) 변경 0 — 위험 인지 유지

Out of Scope (§11.302d-6a-4-β / 후속):
- order-ai-assistant-panel.tsx (12 위치) — 6a-4-β
- quote-ai-assistant-panel.tsx (8 위치) — 6a-4-β
- dashboard/page.tsx (2 orange) — 6a-4-β
- workbench / approval / sourcing — 6b
- lib + legacy — 6c

Rollback path: git revert <SHA>
- 1 file amber 복원 + 1 sentinel 삭제
- 사용자 영향: 재고 도우미 warning 색상 amber 회귀 (시각만)
- error/shortage red + §11.310 wiring 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/ai/inventory-ai-assistant-panel.tsx `
  apps/web/src/__tests__/regression/inventory-ai-panel-amber-removed-302d6a4a.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6a-4a-inventory-ai-panel.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6a-4a-inventory-ai-panel.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 재고 → 운영 도우미 패널 (inventory-ai-assistant):
   - 재고 위험 요약: "주의" 구간 (재고 30~70%) = yellow stat
   - "조치 필요" 1+건 = yellow / 0건 = emerald
   - 유효기간 임박 Lot = yellow
3. 확인 필요한 재고 이슈 섹션:
   - warning 이슈 카드 + 배지 = yellow
   - error/shortage 이슈 = red (변경 0)
4. §11.310 [재발주안 검토하기] → [견적 요청] / [바로 발주] 정상 동작
```
