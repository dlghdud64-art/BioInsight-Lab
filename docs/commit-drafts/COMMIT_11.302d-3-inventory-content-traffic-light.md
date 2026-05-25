# §11.302d-3 Commit Message Draft (inventory-content 잔여 yellow 일괄 신호등)

```
fix(inventory): §11.302d-3 #inventory-content-traffic-light — inventory-content.tsx 잔여 yellow 6 surface 일괄 신호등 spec 정합 (호영님 일괄 결정)

호영님 결정 (2026-05-25):
"이걸 나눠서 해야하는건지? 일괄로 작업하면 안되는건가?"
→ 같은 file 같은 spec 동시 적용 — 일관성 + review 한 번 이득.
sub-batch b/c/d 통합으로 §11.302d-3 본체 일괄 진행.

§11.302d-3a (ISSUE_CONFIG central mapping) 후속 — 잔여 6 surface:

| surface | 위치 | swap |
|---------|------|------|
| 승인 대기 Badge | line 1567 | bg-yellow-50 → bg-yellow-100 (검토 강화) |
| getCardBg switch | line 2171-2184 | 4 case red-50 → red-100 (긴급) / yellow-50 → yellow-100 (검토) |
| stock badge text | line 2211 | lowStock yellow → red 긴급 정정 |
| 우선 사용 Badge | line ~2253 | yellow-50 → yellow-100 + duplicate cleanup |
| button color | line ~2225 | out_of_stock blue + low_stock yellow → red 통일 |
| Summary cards | line 2440-2451 | 만료 임박 text-yellow-700 / 만료 소진 text-red-700 |

Fix (1 file ~30 line + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx:
  · line 1567 승인 대기 — bg-yellow-50 → bg-yellow-100 (검토 spec literal)
  · line 2171-2184 getCardBg switch (inventory-content 별도 함수, §11.302d-2
    inventory-main getCardBg 와 다른 file):
    - expired/out_of_stock: bg-red-50 → bg-red-100 (긴급, 큰 카드 가독성)
    - expiring: bg-yellow-50 → bg-yellow-100 (검토)
    - low_stock/reorder_lead: bg-red-50 → bg-red-100 (긴급)
    - no_location: 보존 (utility)
  · line 2211 stock badge text — lowStock 조건 text-yellow-700 → text-red-700
    (긴급 spec 정합, 이전 yellow 잘못 정정)
  · line ~2253 "우선 사용" Badge — bg-yellow-50 → bg-yellow-100, border-yellow-700
    → border-yellow-200, duplicate "bg-yellow-50 text-yellow-700 border-yellow-700"
    중복 cleanup
  · line ~2225 button color — out_of_stock 도 red 통일 (이전 blue 정정),
    low_stock/reorder_lead 도 red (이전 yellow 정정) — 모두 hover:bg-red-50
  · line 2440-2451 Summary cards — "만료 임박" text-yellow-500 → text-yellow-700,
    "만료/소진" text-rose-500/border-rose-200 → text-red-700/border-red-200
    (rose → red 통일)

- apps/web/src/__tests__/regression/inventory-content-traffic-light-302d3.test.ts
  (NEW, 12 it × 7 nested describe):
  · §11.302d-3 trace
  · 6 surface 각 spec literal 검증
  · 회귀 0: §11.302d-3a ISSUE_CONFIG + §11.302d-4 우선 처리 배너 +
    §11.302d-5 요약 칩 + D-day color (이미 정합) 보존

canonical truth 보존 (회귀 0):
- displayInventories / classifyIssue / IssueType enum 변경 0
- ISSUE_CONFIG (§11.302d-3a) 변경 0
- 우선 처리 배너 (§11.302d-4) 변경 0
- 요약 칩 (§11.302d-5) 변경 0
- D-day color (line 2207) 이미 spec 정합 — 변경 0
- 위치 없음 text-yellow-500 (line 2214) utility, spec 외 — 보존
- "활성" / "전체 Lot" Summary cards — utility/긍정, 보존
- Lot status filter / lotStatusFilter setter 변경 0
- 점검 사항 / Lot 추적 / button onClick handler 변경 0

호영님 production effect:
1. lot-issue-priority-strip "승인 대기" Badge — 노랑 강화 (검토 시그널)
2. 점검 사항 큐의 카드 배경 — 모두 spec 정합 (긴급 red-100 / 검토 yellow-100)
3. stock badge — 부족 상태도 빨간색 (이전 노랑 정정 → 긴급 시그널)
4. button color — 모든 issueType action button red 통일 (위험/긴급 모두 red 톤)
5. Lot Summary cards — 만료 임박 노랑 강화 / 만료 소진 빨강 (rose 통일)
6. §11.302d-3a (central mapping) + §11.302d-3 (잔여 surface) 결합으로
   inventory-content.tsx 의 신호등 spec 정합 거의 완성

§11.302d 시리즈 진행 (7/8):
- §11.302d-1 ✅ inventory-main 4 Badge
- §11.302d-2 ✅ inventory-main getCardBg + duplicate cleanup
- §11.302d-3 ✅ inventory-content 잔여 yellow 6 surface (본 batch)
- §11.302d-3a ✅ ISSUE_CONFIG central mapping
- §11.302d-4 ✅ 우선 처리 배너
- §11.302d-5 ✅ 요약 칩

남은 후보:
- §11.302e: inventory-summary-block.tsx (별도 4-card widget) + Lot 추적
  widget (line 1885-1898) audit

Out of Scope:
- inventory-summary-block.tsx (별도 widget, 4-card) — §11.302e
- Lot 추적 P2 placeholder widget (line 1885-1898) — §11.302e
- §11.290 Phase 4c-3 AI 스캔 PO 매칭 (planner 필요)

Rollback path: git revert <SHA>
- 1 file ~30 line 복원 + sentinel test 삭제
- 6 surface 색상 역전 회귀

Lessons:
1. 일괄 vs 분할 — 같은 file 같은 spec 적용 시 일괄 권장. review 부담
   1 push + 일관성 동시 완성.
2. 같은 함수명 (getCardBg) 이 두 file (inventory-main / inventory-content)
   에 각각 존재 — 각각 별도 batch 필요. §11.302d-2 (inventory-main) +
   §11.302d-3 (inventory-content) 으로 분할.
3. duplicate className 패턴 (bg-yellow-50 text-yellow-700 border-yellow-700
   * 2) cleanup — 본 swap 으로 자연스럽게 정리.
4. utility 색상 (위치 없음 yellow-500, 활성 emerald, 전체 Lot slate) 보존 —
   spec scope 외 micro-decision.
5. rose → red 통일 — 호영님 spec literal rose 없음. 통일 색상 체계로 swap.
6. Karpathy minimum-diff — 1 file ~30 line + 1 NEW test (12 it).
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-content.tsx \
        apps/web/src/__tests__/regression/inventory-content-traffic-light-302d3.test.ts \
        docs/commit-drafts/COMMIT_11.302d-3-inventory-content-traffic-light.md

git commit -F docs/commit-drafts/COMMIT_11.302d-3-inventory-content-traffic-light.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/inventory 점검 사항 탭 Cmd+Shift+R
2. lot-issue priority strip "승인 대기" Badge — 노랑 강화 (yellow-100)
3. 점검 사항 카드 배경 — 모두 신호등 정합:
   - expired/out_of_stock → 빨강 (red-100)
   - expiring → 노랑 (yellow-100)
   - low_stock/reorder_lead → 빨강 (red-100)
4. stock badge — 재고 부족 상태 빨강 (이전 노랑 정정)
5. button color — 모든 action button red 통일
6. Lot 추적 탭 Summary cards:
   - 만료 임박 → 노랑 강화 (yellow-700)
   - 만료/소진 → 빨강 (red-700, rose → red 통일)
7. §11.302d-3a/-4/-5 보존 확인

## §11.302d 시리즈 종결 후보 (호영님 결정)

| § | scope |
|---|---|
| §11.302e | inventory-summary-block.tsx (별도 widget) + Lot 추적 widget |
| §11.290 Phase 4c-3 | AI 스캔 PO 매칭 풀스펙 (planner) |
| 새 P0/P1 | 호영님 다른 지시 |
