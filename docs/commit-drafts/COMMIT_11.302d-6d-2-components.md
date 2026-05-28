chore(components): §11.302d-6d-2 #components-amber-removed — components/* amber/orange → yellow sed 일괄 (status/warning) (호영님 P2 sweep 옵션 A, 2026-05-27)

호영님 P2 sweep 옵션 A — §11.302d-6 초기 audit 누락분(96 file) 중
components/* (6a dashboard widgets 외 ops-hub/ontology/console/ai/
governed-action/fast-track/operational-brief/review-queue/quote-draft/
protocol/products/orders/legal/layout/inventory/impact-analysis/
compare-queue/checkout 등).

분석: components 의 amber/orange 는 전부 status/warning
(SLA 지연 / 경고 / high 우선순위 / 임계 초과 / 기한 초과 / 추출 경고 등).
위험 red 격상 대상 0 (orange 12곳 모두 status 확인),
장식 sky 대상 0 (chart palette 는 hex #f59e0b 라 Tailwind class sweep 무관).

Fix (components sed 일괄 + 1 NEW sentinel):

- apps/web/src/components/**/*.tsx:
  · sed amber/orange → yellow (status/warning 일괄)
  · 대표: ontology(strategic-analytics 9 등) / ops-hub(org-overview-hub 7) /
    work-queue-inbox(SLA/no-move) / console(remediation/governance/daily-review
    high·임계·기한) / governed-action / fast-track / quote-draft /
    protocol(extraction 경고) / vendor-portal board 등

- apps/web/src/__tests__/regression/
  components-amber-removed-302d6d2.test.ts (NEW, ~4 it):
  · components 디렉토리 recursive amber/orange 0
  · work-queue-inbox / console remediation / protocol extraction yellow

canonical truth 보존 (회귀 0):
- status/warning 의미만 yellow (위험 red·장식 sky 대상 없음)
- chart palette (hex) 변경 0 (Tailwind class 아님)
- component 동작/wiring 변경 0 (색상 토큰만)

호영님 production effect:
1. components 기반 surface (ontology/ops-hub/console/work-queue/protocol 등):
   - SLA 지연 / 경고 / high 우선순위 / 임계 초과 / 추출 경고 = yellow
2. §11.302 신호등 정합 (status warning = yellow)

§11.302d-6d 진행 (초기 누락분 96 file):
- 6d-1 ✅ dashboard sub-pages
- 6d-2 ✅ 본 batch (components/*)
- 6d-3 (admin + vendor-portal + app 기타: search/quotes/products/protocol/
  extract/billing/contract-preview/compare 등) — 후속
→ 6d-3 완료 시 application-wide amber/orange 0 (장식 sky 예외)

⚠️ line-ending only file 은 git add 제외 (정규식 치환 권장).

Rollback path: git revert <SHA>
- components amber/orange 복원 + sentinel 삭제

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
# components 디렉토리 정규식 치환 (status 위주라 일괄 yellow 안전):
# (bg|text|border|border-l|from|to|ring)-(amber|orange)-([0-9]+) → $1-yellow-$3
git add apps/web/src/components/ `
  apps/web/src/__tests__/regression/components-amber-removed-302d6d2.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6d-2-components.md
git status
git commit -F docs/commit-drafts/COMMIT_11.302d-6d-2-components.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. ontology/ops-hub/console/work-queue 등 status: SLA지연/경고/high/임계초과 = yellow
3. protocol 추출 경고 = yellow
4. chart 색(hex) 변경 0 확인
