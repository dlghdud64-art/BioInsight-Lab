chore(ui): §11.302d-6d-3 #app-wide-amber-removed — admin/vendor-portal/app 기타 amber·orange → 신호등 (sweep 종결, 호영님 P2 옵션 A, 2026-05-28)

호영님 P2 sweep 옵션 A — §11.302d-6 영역별 분할의 마지막 batch.
6a(critical) → 6b(workbench-approval) → 6c(lib-legacy) →
6d-1(dashboard) → 6d-2(components) → 6d-3(잔여 전체) 종결.

대상 (33 .tsx file): admin/* (page/users/orders/quotes/[id]/requests/
safety/analytics) + vendor-portal/* (top-nav/po-confirmation-panel/board)
+ app 기타 (search/quotes/products/[id]/protocol-bom/extract/billing/
contract-preview/compare-drawer/compare-history/not-found/quotes-[id] +
_components(dashboard-sidebar/page-header/ops-evidence/ops-console-preview/
landing-role-summary/hero-demo-flow) + ontology(link-graph/command-overlay)
+ features/organization-overview).

→ 본 batch 완료 시 apps/web/src/**/*.tsx amber/orange Tailwind class 0
   (application-wide 종결, 장식은 sky 예외).

Fix (분류별, sed amber 일괄 + orange 의미별 targeted + 1 NEW sentinel):

- amber → yellow (전 occurrence 균일, status/warning/categorical):
  · 승인대기/검토중/회신추적/주의/추출경고/안전취급 + ontology Quote 노드 +
    accent checkbox + 아이콘 status 색 등
  · sed -E 's/(bg|text|border|border-l|from|to|via|ring|ring-offset|
    fill|stroke|accent|divide|decoration|outline|shadow)-amber-([0-9]+)/
    \1-yellow-\2/g'
  · dotColorMap·STATUS_RING·BADGE_COLORS·gradientMap "amber" 키 보존(값만 swap)

- orange → yellow (status/warning):
  · extract 추출 경고 alert / compare-history "N일 대기" /
    compare-drawer SIGNIFICANT_DIFFERENCES(중요한 차이) verdict /
    compare-drawer 핵심 변경사항 bullet / admin/safety GHS picto tint

- orange → red (위험 격상, safety high→red 정합):
  · compare-drawer significance HIGH(높음) + highCount badge
    (CRITICAL=red-600 보존, HIGH=red-500 lighter 로 5-tier 구분 유지:
     치명적 red-600 / 높음 red-500 / 보통 yellow / 낮음 blue / 참고 slate)

- orange → sky (장식/categorical/icon tint):
  · link-graph DispatchPackage 노드(fill/stroke) / not-found 404 badge /
    page-header iconColor "orange" tint / dashboard-sidebar safety nav icon /
    admin/quotes 요청일 calendar icon / admin/analytics Share2 icon

- apps/web/src/__tests__/regression/
  app-wide-amber-removed-302d6d3.test.ts (NEW, ~6 it):
  · src 전체 .tsx recursive 스캔 amber/orange 0 (sweep 종결 guard)
  · 대표 분류 검증: extract=yellow / compare HIGH=red·SIGNIFICANT=yellow /
    link-graph DispatchPackage=sky / safety nav=sky / 404=sky

canonical truth 보존 (회귀 0):
- status/warning=yellow, 위험=red, 장식=sky (의미 1:1 보존, 동작/wiring 변경 0)
- chart palette hex(#f59e0b) 변경 0 (Tailwind class 아님)
- "amber" 문자열 키 보존 (caller wiring 영향 0, 값만 색상 swap)

호영님 production effect:
1. 관리자/공급사 포털/검색/견적/제품/프로토콜/추출/청구/비교 surface 색상
   §11.302 신호등 정합 (amber·orange 잔존 0)
2. 비교 분석 severity: 치명적·높음=red 계열, 중요한차이·보통=yellow (위험 위계 강화)
3. application-wide 신호등 체계 1차 완성 (.tsx 기준)

⚠️ 후속 발견 — stale sentinel (§11.302d-6e 권장, 본 commit 범위 아님):
- 6a~6d2(이미 push) sweep 으로 source 가 yellow 로 바뀌었으나, 옛 sentinel
  ~49곳(18 test file)이 아직 amber/orange 를 **positive assert**
  (예: toMatch(/border-l-amber-500/), toContain('bg-amber-500')).
- 영향: Vercel 빌드(next build)에는 영향 0. vitest sentinel 묶음 실행 시에만
  ~49 stale fail (테스트 무결성 이슈, production 무관).
- source 색상 자체는 정상 (예: 폐기=red 정확). 테스트만 옛 색 단언.
- 권장: §11.302d-6e 에서 positive assertion 만 새 색(amber→yellow,
  폐기 orange→red, 장식 orange→sky)으로 정정. .not.toMatch(/amber/)
  회귀 sentinel 은 보존 (정상). → 호영님 진행 여부 회신 후 별도 batch.

⚠️ line-ending only file 은 git add 제외 (정규식 치환 권장).

Rollback path: git revert <SHA>
- amber/orange 복원 + app-wide sentinel 삭제

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
# 1) amber → yellow 일괄 (apps/web/src 전체 .tsx):
#    (bg|text|border|border-l|from|to|via|ring|ring-offset|fill|stroke|accent|divide|decoration|outline|shadow)-amber-([0-9]+) → $1-yellow-$2
# 2) orange 는 의미별 (sandbox 와 동일하게 아래 file만 수동/정규식):
#    - yellow: extract/page.tsx, compare/_components/compare-history-section.tsx, admin/safety/page.tsx
#    - sky:    admin/analytics/page.tsx, admin/quotes/[id]/page.tsx, not-found.tsx, _components/dashboard-sidebar.tsx, components/ontology/link-graph-visualizer.tsx, _components/page-header.tsx(bg-orange-50→bg-sky-50)
#    - 수동: compare/_components/compare-analysis-drawer.tsx (HIGH/highCount→red-500, SIGNIFICANT/bullet→yellow)
git add apps/web/src/app/ apps/web/src/components/ apps/web/src/features/ `
  apps/web/src/__tests__/regression/app-wide-amber-removed-302d6d3.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6d-3-app-wide.md
git status
git commit -F docs/commit-drafts/COMMIT_11.302d-6d-3-app-wide.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. admin/* (대시보드/사용자/주문/견적/요청/안전/분석): 승인대기·검토중·마감 = yellow
3. vendor-portal: 대기/검토 배지 = yellow
4. 비교 분석 drawer: 치명적·높음 = red 계열, 중요한차이·보통 = yellow
5. 안전 nav 아이콘 / 404 badge / 요청일 calendar = sky (장식, 신호등 아님)
6. chart 색(hex) 변경 0 확인
