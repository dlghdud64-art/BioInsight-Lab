# §11.302d-6a-4-β Commit Message Draft (order + quote ai-assistant-panel amber swap)

```
chore(ai): §11.302d-6a-4b #order-quote-ai-panel-amber-removed — order-ai (12) + quote-ai (8) assistant-panel amber → yellow swap (warning 의미, error/CANCELLED red 보존) (호영님 P1 sweep batch 4/4-β, 2026-05-26)

호영님 P1 sweep spec (Q35 = A, 2026-05-26):
§11.302d-6a critical surfaces batch 4/4-β. inventory-ai-panel (6a-4-α)
후속 — order + quote ai-assistant-panel dark mode warning tone swap.

6a-4-β scope:
- order-ai-assistant-panel.tsx (12 위치):
  · ORDERED status: text-amber-400 bg-amber-950/30 → yellow
  · warning severity (badge / icon / 컨테이너): amber → yellow
  · error/CANCELLED red 분기 보존
- quote-ai-assistant-panel.tsx (8 위치):
  · warning severity (badge / icon / 컨테이너): amber → yellow
  · fix 버튼 (수정하기, isWarning): text-amber-600/700 → yellow
  · isError red 분기 보존

§11.302d-6 시리즈 진행:
- §11.302d-6 ✅ audit + scope 분할
- §11.302d-6a (critical 4 sub-batch — 완료 임박)
  - §11.302d-6a-1 ✅ badge.tsx + Header.tsx
  - §11.302d-6a-2 ✅ BudgetPrediction + CategorySpending (soft_limit 후속)
  - §11.302d-6a-3-α ✅ ai-action-inbox
  - §11.302d-6a-3-β ✅ executive-summary tone palette
  - §11.302d-6a-4-α ✅ inventory-ai-assistant-panel
  - §11.302d-6a-4-β ✅ 본 batch (order + quote ai-panel)
  - §11.302d-6a-4-γ (dashboard/page.tsx risk severity literal ~30) — 후속
- §11.302d-6b (workbench/approval) — 후속
- §11.302d-6c (lib + legacy) — 후속

Fix (2 file 20 위치 + 1 NEW sentinel):

- apps/web/src/components/ai/order-ai-assistant-panel.tsx:
  · statusColors.ORDERED: text-amber-400 bg-amber-950/30 → yellow
  · IssueWarningsSection 컨테이너 (errors 0): bg-amber-950/10 → yellow
  · ShieldAlert icon (errors 0): text-amber-500 → text-yellow-500
  · 이슈 건수 badge (errors 0): bg-amber-950/30 text-amber-400
    border-amber-200 → yellow
  · 이슈 row (isWarning): border-amber-800/50 bg-amber-950/20 → yellow
  · severity icon (isWarning): text-amber-500 → yellow
  · 우선순위 medium: bg-amber-950/30 text-amber-400 border-amber-200 → yellow
  · 권장 액션 박스: border-amber-800/50 bg-amber-950/20 + text-amber-400 → yellow

- apps/web/src/components/ai/quote-ai-assistant-panel.tsx:
  · status warning: text-amber-400 bg-amber-950/30 → yellow
  · IssueWarningsSection 컨테이너 (errors 0): bg-amber-950/10 → yellow
  · severity icon / badge (isWarning): text-amber-500 +
    bg-amber-950/30 text-amber-400 border-amber-200 → yellow
  · 이슈 row (isWarning): border-amber-800/50 bg-amber-950/20 → yellow
  · fix 버튼 (수정하기, isWarning): text-amber-600 hover:text-amber-700 → yellow

- apps/web/src/__tests__/regression/
  order-quote-ai-panel-amber-removed-302d6a4b.test.ts (NEW, ~14 it):
  · order amber/orange 0 + ORDERED yellow + warning badge yellow — 4 it
  · quote amber/orange 0 + fix 버튼 yellow + warning yellow — 4 it
  · 회귀 0 — 6 it (CANCELLED red / CONFIRMED blue / SHIPPING purple /
    DELIVERED emerald / isError red 분기 / onFix wiring)

canonical truth 보존 (회귀 0):
- statusColors 5 entry 구조 보존 (ORDERED/CONFIRMED/SHIPPING/DELIVERED/CANCELLED)
- error / CANCELLED red 분기 보존 (warning 만 yellow)
- CONFIRMED (blue) / SHIPPING (purple) / DELIVERED (emerald) 변경 0
- isError / isWarning 분기 로직 변경 0
- onFix 수정하기 버튼 wiring 변경 0

호영님 production effect:
1. labaxis.co.kr 발주 → AI 도우미 패널 (order-ai):
   - "발주됨" (ORDERED) status: amber → yellow
   - warning severity 이슈 카드/배지: amber → yellow
   - error/취소(CANCELLED): red 보존
2. labaxis.co.kr 견적 → AI 도우미 패널 (quote-ai):
   - warning severity 이슈 카드/배지: amber → yellow
   - "수정하기" 버튼 (warning): amber → yellow
   - error: red 보존
3. 다른 status (확정 blue / 배송 purple / 입고 emerald) 변경 0

Out of Scope (§11.302d-6a-4-γ / 후속):
- dashboard/page.tsx (risk severity literal "amber" + Tailwind ~30 위치) — 6a-4-γ
  · risk 시스템 (inventoryRisk/stockRisk/spendingRisk/quoteRisk) +
    urgentItems severity literal + 색상 map 혼재 — executive-summary 패턴
    (key 보존 + 값 swap) 적용 필요, 신중
- workbench / approval / sourcing — 6b
- lib + legacy — 6c

Rollback path: git revert <SHA>
- 2 file amber 복원 + 1 sentinel 삭제
- 사용자 영향: 발주/견적 도우미 warning 색상 amber 회귀 (시각만)
- error/CANCELLED red + 다른 status 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/ai/order-ai-assistant-panel.tsx `
  apps/web/src/components/ai/quote-ai-assistant-panel.tsx `
  apps/web/src/__tests__/regression/order-quote-ai-panel-amber-removed-302d6a4b.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6a-4b-order-quote-ai-panel.md

git status   # modified: 2 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6a-4b-order-quote-ai-panel.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 발주 상세 → AI 도우미 패널:
   - "발주됨" status chip = yellow (이전 amber)
   - warning 이슈 카드/배지 = yellow
   - 취소(CANCELLED) status = red (변경 0)
3. labaxis.co.kr 견적 상세 → AI 도우미 패널:
   - warning 이슈 카드/배지 = yellow
   - "수정하기" 버튼 (warning) = yellow
   - error 이슈 = red (변경 0)
4. 다른 status (확정/배송/입고) 색상 변경 0
```
