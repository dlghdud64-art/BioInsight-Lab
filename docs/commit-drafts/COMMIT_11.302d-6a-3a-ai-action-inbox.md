# §11.302d-6a-3-α Commit Message Draft (ai-action-inbox.tsx variant 매핑 swap)

```
chore(dashboard): §11.302d-6a-3a #ai-action-inbox-amber-removed — ai-action-inbox.tsx 5 variant entry amber/orange → 신호등 swap (REORDER 위험 격상 + 다른 4 yellow) (호영님 P1 sweep batch 3/4-α, 2026-05-26)

호영님 P1 sweep spec (Q35 = A, 2026-05-26):
§11.302d-6a critical surfaces batch 3/4 (1/2). executive-summary-section
(tone palette ~25) 는 6a-3-β 후속.

6a-3-α scope (ai-action-inbox.tsx variant 매핑 ~10 위치):
- CONFIG.FOLLOWUP_DRAFT (회신 대기): amber → yellow (긴급/주의 의미)
- CONFIG.REORDER_SUGGESTION (재고 위험): orange → red 격상 (위험 강조,
  STAGE.REORDER_SUGGESTION 도 이미 red — 일관성)
- STAGE.QUOTE_DRAFT (검토 필요): orange → yellow (검토 단계)
- STAGE.VENDOR_EMAIL_DRAFT (검토 필요): orange → yellow (검토 단계)
- STAGE.FOLLOWUP_DRAFT (응답 대기): amber → yellow (긴급/주의)

§11.302d-6 시리즈 진행:
- §11.302d-6 ✅ audit + scope 분할
- §11.302d-6a (critical 4 sub-batch)
  - §11.302d-6a-1 ✅ badge.tsx + Header.tsx
  - §11.302d-6a-2 ✅ BudgetPrediction + CategorySpending (soft_limit 후속)
  - §11.302d-6a-3-α ✅ 본 batch (ai-action-inbox)
  - §11.302d-6a-3-β (executive-summary tone palette) — 후속
  - §11.302d-6a-4 (3 ai-assistant-panel + dashboard/page.tsx) — 후속
- §11.302d-6b (workbench/approval) — 후속
- §11.302d-6c (lib + legacy) — 후속

Fix (1 file 5 variant entry + 1 NEW sentinel):

- apps/web/src/components/dashboard/ai-action-inbox.tsx:
  · CONFIG.FOLLOWUP_DRAFT (line 68-81):
    - iconBg: bg-amber-50  bg-amber-50 → bg-yellow-50  bg-yellow-50
    - iconColor: text-amber-600/400 → text-yellow-600/400
    - borderColor: border-l-amber-500 → border-l-yellow-500
    - badgeClass: bg-amber-50 + text-amber-700/400 + border-amber-200/800
      → bg-yellow-50 + text-yellow-700/400 + border-yellow-200/800
  · CONFIG.REORDER_SUGGESTION (line 96-108) — orange → red 격상:
    - iconBg: bg-orange-50  bg-orange-950/40 → bg-red-50  bg-red-950/40
    - iconColor: text-orange-600/400 → text-red-600/400
    - borderColor: border-l-orange-500 → border-l-red-500
    - badgeClass: bg-orange-50 + text-orange-700/400 + border-orange-200/800
      → bg-red-50 + text-red-700/400 + border-red-200/800
    - 근거: badgeLabel "재고 위험" + STAGE.REORDER "조치 필요" 도 red →
      CONFIG/STAGE 일관성 위해 격상
  · STAGE.QUOTE_DRAFT (line 140-143):
    - className: bg-orange-50 ... → bg-yellow-50 + text-yellow-700/400 +
      border-yellow-200/800 (검토 단계)
  · STAGE.VENDOR_EMAIL_DRAFT (line 144-147): 동일 yellow swap
  · STAGE.FOLLOWUP_DRAFT (line 148-151): amber → yellow swap
  · §11.302d-6a-3-α 주석 2건 추가 (swap 결정 근거 + 격상 근거)

- apps/web/src/__tests__/regression/
  ai-action-inbox-amber-removed-302d6a3a.test.ts (NEW, ~22 it):
  · amber/orange Tailwind class 0 — 6 it (bg/text/border + border-l)
  · CONFIG swap 정합 — 4 it (FOLLOWUP yellow / REORDER red 격상 +
    badgeLabel 보존)
  · STAGE swap 정합 — 3 it (QUOTE/VENDOR_EMAIL/FOLLOWUP 모두 yellow)
  · 회귀 0 — 7 it (다른 variant blue/purple/red 보존 + STAGE
    REORDER/EXPIRY 보존 + approveHref 3건 보존)

canonical truth 보존 (회귀 0):
- 5 CONFIG entry + 6 STAGE_CONFIG entry 구조 보존
- icon / title / description / cta / badgeLabel / approveToast / approveHref 변경 0
- VENDOR_EMAIL_DRAFT (blue) / STATUS_CHANGE_SUGGEST (purple) / EXPIRY_ALERT (red) 변경 0
- STAGE.REORDER_SUGGESTION (red, "조치 필요") 보존 → CONFIG 격상과 일관
- STAGE.EXPIRY_ALERT (yellow, "확인 필요") 보존
- dark mode 짝 (bg-*-950/40 + text-*-400 + border-*-800) 모두 swap

호영님 production effect:
1. labaxis.co.kr/dashboard AI 인사이트 카드 (ai-action-inbox):
   - "회신 지연 주문" 카드 (FOLLOWUP_DRAFT): amber → yellow tone
   - "재발주 검토 필요" 카드 (REORDER_SUGGESTION): orange → red 격상
     · 좌측 border / icon / badge 모두 red — 위험 강조
2. labaxis.co.kr/dashboard 승인 단계 배지 (STAGE_CONFIG):
   - "검토 필요" (QUOTE_DRAFT / VENDOR_EMAIL_DRAFT): orange → yellow
   - "응답 대기" (FOLLOWUP_DRAFT): amber → yellow
   - "조치 필요" (REORDER_SUGGESTION): red 보존
   - "확인 필요" (EXPIRY_ALERT): yellow 보존
3. CLAUDE.md §11.302 신호등 정합 — 본 file 위반 위치 ~10 → 0

Out of Scope (§11.302d-6a-3-β / 6a-4 / 후속):
- executive-summary-section.tsx tone palette system (~25 위치) — 6a-3-β
  · 4-tone (blue/emerald/amber/rose) 시스템 — badge.tsx 패턴 정합 (key 보존+값 swap)
- 3 ai-assistant-panel (inventory/order/quote) + dashboard/page.tsx — 6a-4
- workbench / approval / sourcing — 6b
- lib + legacy — 6c

Rollback path: git revert <SHA>
- 1 file amber/orange 복원 + 1 sentinel 삭제
- 사용자 영향: 회신 지연/재발주 카드 + 검토/응답 배지 색상 회귀
- 다른 variant (blue/purple/red/yellow) 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/dashboard/ai-action-inbox.tsx `
  apps/web/src/__tests__/regression/ai-action-inbox-amber-removed-302d6a3a.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6a-3a-ai-action-inbox.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6a-3a-ai-action-inbox.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr/dashboard AI 인사이트 카드:
   - "회신 지연 주문이 있습니다" 카드 = yellow tone (이전 amber)
   - "재발주 검토가 필요한 품목" 카드 = red tone (이전 orange, 위험 격상)
3. 승인 단계 배지 (CardConfig stage):
   - "검토 필요" (QUOTE/VENDOR_EMAIL): yellow (이전 orange)
   - "응답 대기" (FOLLOWUP): yellow (이전 amber)
   - "조치 필요" (REORDER): red (변경 0)
   - "확인 필요" (EXPIRY): yellow (변경 0)
4. 다른 variant (VENDOR_EMAIL blue / STATUS_CHANGE purple / EXPIRY red) 변경 0
```
