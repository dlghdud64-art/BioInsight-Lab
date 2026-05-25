# §11.302d-2 Commit Message Draft (getCardBg switch 신호등 정합 + duplicate cleanup)

```
fix(inventory): §11.302d-2 #inventory-cardbg-traffic-light — getCardBg() switch case 신호등 정합 + duplicate className orphan cleanup

§11.302d-1 후속 — Karpathy minimum-diff:
inventory-main.tsx 의 getCardBg() return string 3 case 가 각
className 을 2번 반복 (duplicate orphan):
  case "expired"/"out_of_stock": "bg-red-100  bg-red-100 border-red-900/30  border-red-900/30"
  case "expiring":              "bg-yellow-50  bg-yellow-50 border-yellow-900/30  border-yellow-900/30"
  case "low_stock"/"reorder_lead": "bg-red-100  bg-red-100 border-red-900/30  border-red-900/30"

§11.302d-2 swap (호영님 spec 신호등 + duplicate 정리):
  expired/out_of_stock → bg-red-100 border-red-200
    (위험 spec red-600 + white 은 큰 카드 가독성 문제 — h5 text-slate-900
     conflict. KPI 카드 전용으로 보존. 큰 카드는 긴급 색상 red-100 으로
     통일.)
  expiring → bg-yellow-100 border-yellow-200 (검토 spec 정합)
  low_stock/reorder_lead → bg-red-100 border-red-200 (긴급 spec 정합)
  no_location → 보존 (utility, spec 외)

Fix (1 file ~12 line + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-main.tsx:
  · getCardBg() switch 3 case return string 정리:
    - duplicate className orphan cleanup (각 case 2번 → 1번)
    - bg-yellow-50 → bg-yellow-100 (expiring, spec 검토 정합)
    - border-red-900/30 → border-red-200 (light border)
    - border-yellow-900/30 → border-yellow-200 (light border)
  · case "expired" / "out_of_stock" 색상 결정 trace comment:
    spec 위험 (red-600 + white) 큰 카드 가독성 우려 → 긴급 (red-100)
    유지. KPI 카드 전용 spec 위험 적용 (§11.302c 정합).
  · case "no_location" — 변경 0 (utility, spec 외)

- apps/web/src/__tests__/regression/inventory-cardbg-traffic-light-302d2.test.ts
  (NEW, 9 it × 3 nested describe):
  · §11.302d-2 trace
  · getCardBg() 4 case spec literal 검증
  · duplicate className 패턴 0 (bg-red-100 bg-red-100 / bg-yellow-50
    bg-yellow-50 / border-*-900/30 * 2)
  · 회귀 0: line 1672 daysLeft Badge 이미 spec 정합 (변경 0) +
    §11.302c KPI 3-card 보존 + §11.302d-1 Badge 4 곳 보존

canonical truth 보존 (회귀 0):
- IssueType enum (expired / out_of_stock / expiring / low_stock /
  reorder_lead / no_location) 변경 0
- classifyIssue(inv) logic 변경 0
- getCardBg() 호출자 (line 1648 const cardBg = getCardBg(issueType))
  변경 0
- ISSUE_CONFIG / issueInfo 변경 0
- line 1672 daysLeft Badge — 이미 spec literal (bg-yellow-100
  text-yellow-700) 변경 0
- line 1890 임박 Lot KPI (Lot 추적 P2 widget) — §11.302e 별도 batch

호영님 production effect:
1. 작업 필요 카드 (조치 필요 항목) — expiring 케이스 카드 배경 노란색
   미세 진해짐 (yellow-50 → yellow-100). 검토 시그널 강화.
2. expired/out_of_stock/low_stock/reorder_lead 케이스 — 빨간색 그대로
   (큰 카드 가독성).
3. duplicate className 정리 — Tailwind output minimum, CSS specificity
   영향 0 (동일 class 반복은 noop).

§11.302d 후속 (호영님 결정 대기):
- §11.302d-3: inventory-content.tsx amber/yellow ~20 곳 — 큰 batch
  (분할 권장)
- §11.302d-4: "긴급 재발주 필요" 안내 박스 (inventory-content
  line 2036/2102 후보) — 호영님 위치 확정 필요
- §11.302e: inventory-summary-block + Lot 추적 widget (line 1885-1898)
  audit — 별도 widget surface

Out of Scope:
- 위험 spec (bg-red-600 + text-white) 큰 카드 적용 — h5/h4/p text 일괄
  text-white swap 필요 (scope 확대 + 가독성 검토 필요). 호영님 명시
  결정 후 별도 batch.
- ISSUE_CONFIG.cls (line 845-847 의 status mapping, 이미 spec 정합
  bg-yellow-100 text-yellow-700) — 변경 0.

Rollback path: git revert <SHA>
- 1 file ~12 line 복원 + sentinel test 삭제
- duplicate className 회귀 + bg-yellow-50 회귀

Lessons:
1. Tailwind duplicate className — 동일 class 2번 반복은 noop 이지만
   가독성 + 유지보수 부담. orphan cleanup 시 일괄 정리.
2. 색상 spec 적용 vs 가독성 trade-off — bg-red-600 + text-white 는
   KPI 카드 (작음) 전용. 큰 작업 카드는 bg-red-100 으로 가독성 우선.
3. switch case 별 별도 spec 매핑 — IssueType 별 의미 (expired = 위험,
   expiring = 검토, low_stock = 긴급, no_location = utility) 정확한
   매핑.
4. Karpathy surgical change — 변경 line 모두 spec 정합 또는 orphan
   cleanup. no_location case 변경 0 (spec 외).
5. Karpathy minimum-diff — 1 file ~12 line + 1 NEW test (9 it).
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-main.tsx \
        apps/web/src/__tests__/regression/inventory-cardbg-traffic-light-302d2.test.ts \
        docs/commit-drafts/COMMIT_11.302d-2-inventory-cardbg-traffic-light.md

git commit -F docs/commit-drafts/COMMIT_11.302d-2-inventory-cardbg-traffic-light.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/inventory Cmd+Shift+R
2. 조치 필요 항목 카드 — issueType 별 배경:
   - expiring (유효기간 임박) → 노란색 (yellow-100, 검토)
   - expired / out_of_stock → 빨간색 연한 (red-100)
   - low_stock / reorder_lead → 빨간색 연한 (red-100)
   - no_location → 회색 보드 (변경 0)
3. daysLeft Badge — expired (red-100) vs expiring (yellow-100) 변경 0
4. §11.302c KPI 3-card 보존 확인
5. §11.302d-1 Badge 4 곳 보존 확인
6. Tailwind class output bundle size — duplicate cleanup 미세 감소

## 후속 batch (호영님 push 응답 후 결정)

| § | scope | 우선도 |
|---|---|---|
| §11.302d-3 | inventory-content.tsx amber/yellow ~20 곳 (분할 권장) | 중-Large |
| §11.302d-4 | "긴급 재발주 필요" 안내 박스 (inventory-content line 2036) | 호영님 위치 확정 |
| §11.302e | inventory-summary-block + Lot 추적 widget | 호영님 결정 |
| §11.290 Phase 4c-3 | AI 스캔 PO 매칭 풀스펙 | planner 진입 OK |
