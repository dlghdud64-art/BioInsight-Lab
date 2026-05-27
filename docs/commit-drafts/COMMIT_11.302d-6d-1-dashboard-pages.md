chore(dashboard): §11.302d-6d-1 #dashboard-pages-amber-removed — dashboard/* sub-pages amber/orange → 의미별(red/yellow/sky) swap (호영님 P2 sweep 옵션 A, 2026-05-27)

호영님 P2 sweep 옵션 A — §11.302d-6 초기 audit 누락분(96 file) 중
dashboard/* sub-pages + _components 처리 (6d-1).

위험 의미 정책 (호영님 옵션 A): 위험 orange → red 격상, status → yellow,
장식(avatar 팔레트) → 비-orange.

Fix (dashboard amber sed + orange 8 file 의미별 + 1 NEW sentinel):

- dashboard/* amber → yellow sed (warning status 일괄):
  · quotes / receiving / settings / reports / analytics / budget /
    purchases / inbox / audit / activity-logs / _components 등 다수
- orange 위험 → red (옵션 A):
  · safety/page: 인화성 물질(flammable, GHS 위험물) + 안전 섹션 → red
  · stock-risk/page: 만료 위험(expiry_risk) → red
  · budget/page + budget/[id]: critical(예산 초과/경고) → red
- orange status → yellow:
  · purchase-orders/page + [poId]: HIGH priority / 대체품 표시 → yellow
  · activity-logs/page: PRODUCT_FAVORITED 활동 색 → yellow
- orange 장식 → sky:
  · organizations/page: AVATAR_COLORS 팔레트 (사용자 아바타 6색 순환)
    bg-orange-500 → bg-sky-500 (§11.302 신호등 무관 장식, orange 토큰만 제거)

- apps/web/src/__tests__/regression/
  dashboard-pages-amber-removed-302d6d1.test.ts (NEW, ~7 it):
  · dashboard 디렉토리 recursive amber/orange 0
  · 위험 red (safety/stock-risk/budget) / status yellow (PO/activity) /
    장식 sky (avatar)

canonical truth 보존 (회귀 0):
- 위험도/상태/장식 의미 분류 정확 (위험=red, 주의=yellow, 장식=sky)
- 안전(GHS 위험물) 위험 강조 (인화성 red — 과소표시 방지)
- avatar 6색 구분 유지 (orange→sky, 나머지 5색 보존)
- dashboard page 동작/wiring 변경 0 (색상 토큰만)

호영님 production effect:
1. labaxis.co.kr dashboard sub-pages:
   - 안전 인화성 물질 = red (위험 강조) / 재고 만료 위험 = red / 예산 초과 = red
   - PO HIGH priority / 대체품 / 활동 = yellow
   - 조직 아바타 주황색 = sky(하늘색)
   - 기타 warning status = yellow
2. §11.302 신호등 정합 (위험 red / 주의 yellow / 장식 비-신호색)

§11.302d-6 진행 (6d = 초기 누락분 96 file):
- 6d-1 ✅ 본 batch (dashboard sub-pages)
- 6d-2 (components/*: ops-hub/ontology/console/ai/governed-action 등) — 후속
- 6d-3 (admin + vendor-portal + app 기타) — 후속

Rollback path: git revert <SHA>
- dashboard amber/orange 복원 + sentinel 삭제
- 위험 red → orange 회귀 (위험 표시 약화)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
# dashboard 디렉토리 정규식 치환 (amber→yellow) 후 위험 file(safety/stock-risk/
#   budget) orange→red / status(PO/activity) orange→yellow / avatar orange→sky 수동
git add apps/web/src/app/dashboard/ `
  apps/web/src/__tests__/regression/dashboard-pages-amber-removed-302d6d1.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6d-1-dashboard-pages.md
git status
git commit -F docs/commit-drafts/COMMIT_11.302d-6d-1-dashboard-pages.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. dashboard/safety: 인화성 물질 = red / dashboard/stock-risk: 만료 위험 = red /
   dashboard/budget: 초과 = red
3. dashboard/purchase-orders: HIGH/대체품 = yellow / activity-logs = yellow
4. dashboard/organizations: 아바타 주황 → 하늘색(sky)
5. 기타 sub-page warning = yellow
