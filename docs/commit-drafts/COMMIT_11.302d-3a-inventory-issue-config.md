# §11.302d-3a Commit Message Draft (ISSUE_CONFIG 신호등 정합)

```
fix(inventory): §11.302d-3a #inventory-issue-config — ISSUE_CONFIG 6 IssueType Badge cls 신호등 정합 (low_stock yellow→red 긴급 / reorder_lead blue→red 긴급 / expired+out_of_stock red→red-600 위험)

§11.302d-4 (우선 처리 배너) + §11.302d-5 (요약 칩) 후속:
inventory-content.tsx ISSUE_CONFIG (line 1080-1111) 의 6 IssueType
Badge cls mapping 신호등 정합. 색상 의미 역전 + spec literal 강화.

audit 결과:
| issueType    | 라벨        | 현재 cls                            | 호영님 spec |
|--------------|-------------|-------------------------------------|-------------|
| expired      | 만료됨      | bg-red-500/10 text-red-700          | 위험 red-600 |
| out_of_stock | 품절        | bg-red-500/10 text-red-700          | 위험 red-600 |
| expiring     | 만료 임박   | bg-yellow-500/10 text-yellow-700    | 검토 yellow-100 |
| low_stock    | 부족        | bg-yellow-500/10 text-yellow-700 ✗ | 긴급 red-100 |
| reorder_lead | 재발주 필요 | bg-blue-500/10 text-blue-400 ✗     | 긴급 red-100 |
| no_location  | 위치 미지정 | bg-el text-slate-400                | utility 보존 |

low_stock + reorder_lead 가 yellow / blue 로 잘못 표시 — 사용자
인지 오류. spec literal 정합으로 red-100 (긴급) swap.

expired + out_of_stock = 위험 — Badge 작은 칩이므로 bg-red-600
text-white 가독성 OK. spec literal 정합.

Fix (1 file 1 record + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx
  (line 1080-1111):
  · ISSUE_CONFIG 6 IssueType cls swap:
    - expired: bg-red-500/10 text-red-700 → bg-red-600 text-white (위험)
    - out_of_stock: bg-red-500/10 text-red-700 → bg-red-600 text-white (위험)
    - expiring: bg-yellow-500/10 text-yellow-700 → bg-yellow-100
      text-yellow-700 (검토, spec literal 강화)
    - low_stock: bg-yellow-500/10 text-yellow-700 → bg-red-100
      text-red-700 (긴급, 이전 yellow 잘못 정정)
    - reorder_lead: bg-blue-500/10 text-blue-400 → bg-red-100
      text-red-700 (긴급, 이전 blue 잘못 정정)
    - no_location: bg-el text-slate-400 보존 (utility)
  · §11.302d-3a trace comment 추가 (위험/검토/긴급/utility 매핑 명시)

- apps/web/src/__tests__/regression/inventory-issue-config-302d3a.test.ts
  (NEW, 9 it × 4 nested describe):
  · §11.302d-3a trace
  · 위험 × 2 (expired / out_of_stock) 검증
  · 긴급 × 2 (low_stock / reorder_lead) 색상 역전 정정 검증
  · 검토 × 1 (expiring) spec literal 검증
  · utility 보존 (no_location) + 이전 잘못 패턴 부재 + priority 0~5 보존

canonical truth 보존 (회귀 0):
- IssueType enum 변경 0
- classifyIssue(inv) logic 변경 0
- ISSUE_CONFIG record 의 label / priority 변경 0 (cls 만 swap)
- issueInfo.cls 사용처 — Badge className 매핑 (다른 surface 변경 0)
- ISSUE_CONFIG record 호출자 (priority 정렬, label 표시) 변경 0

호영님 production effect:
1. 점검 사항 큐의 issueType Badge:
   - "만료됨" → 빨간 진한 + 흰 글자 (위험)
   - "품절" → 빨간 진한 + 흰 글자 (위험)
   - "만료 임박" → 노랑 (검토, 미세 강화)
   - "부족" → 빨강 연한 (긴급, 이전 노랑 정정)
   - "재발주 필요" → 빨강 연한 (긴급, 이전 파랑 정정)
   - "위치 미지정" → 회색 (utility)
2. 우선 처리 배너 (§11.302d-4) + 요약 칩 (§11.302d-5) 과 색상 일관성
   완성 — 만료 임박 yellow / 부족·재발주 red / 만료·품절 red-600

§11.302d 시리즈 진행 (5/6):
- §11.302d-1 ✅ inventory-main 4 Badge
- §11.302d-2 ✅ getCardBg switch + duplicate cleanup
- §11.302d-3a ✅ ISSUE_CONFIG (본 batch)
- §11.302d-3b ⏳ approval-waiting line 1560/1579
- §11.302d-3c ⏳ card BG + lot detail line 2164/2194-2241
- §11.302d-3d ⏳ KPI valueClass line 2429-2430
- §11.302d-4 ✅ 우선 처리 배너
- §11.302d-5 ✅ 요약 칩

Out of Scope (별도 batch):
- §11.302d-3b: approval-waiting state (line 1560 + lot-issue-hold-count
  Badge line 1579)
- §11.302d-3c: card BG conditional (line 2164) + lot detail Badge
  (line 2194/2198/2201/2212/2241)
- §11.302d-3d: KPI valueClass (line 2429-2430)
- §11.302e: inventory-summary-block + Lot 추적 widget

Rollback path: git revert <SHA>
- 1 file 1 record 복원 + sentinel test 삭제
- 색상 역전 회귀

Lessons:
1. ISSUE_CONFIG 같은 central mapping = 가장 큰 leverage. 1 record 만
   swap 으로 모든 Badge 사용처 (수십 개) 자동 정합.
2. 위험 (bg-red-600 white) vs 긴급 (bg-red-100 red-700) 분기 — Badge
   작은 칩이므로 가독성 우려 0. KPI 카드 큰 박스 가독성 우려와 다름.
3. 색상 역전 패턴 — yellow=긴급, blue=재발주 는 호영님 spec 신호등
   체계 외 임의 결정. spec 정합 strict 적용으로 통일.
4. Karpathy minimum-diff — 1 file 1 record + 1 NEW test (9 it).
   central mapping 의 leverage 활용.
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-content.tsx \
        apps/web/src/__tests__/regression/inventory-issue-config-302d3a.test.ts \
        docs/commit-drafts/COMMIT_11.302d-3a-inventory-issue-config.md

git commit -F docs/commit-drafts/COMMIT_11.302d-3a-inventory-issue-config.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/inventory 점검 사항 탭 Cmd+Shift+R
2. issueType Badge 색상 확인:
   - 만료됨 / 품절 → 빨강 진한 + 흰 글자 (위험)
   - 만료 임박 → 노랑 (검토)
   - 부족 → 빨강 연한 (긴급, 이전 노랑 정정)
   - 재발주 필요 → 빨강 연한 (긴급, 이전 파랑 정정)
   - 위치 미지정 → 회색 (utility)
3. 우선 처리 배너 (§11.302d-4) + 요약 칩 (§11.302d-5) 색상 일관성 확인
4. priority 정렬 정상 (0~5)

## 후속 batch (호영님 push 응답 후)

| § | scope |
|---|---|
| §11.302d-3b | approval-waiting line 1560/1579 |
| §11.302d-3c | card BG + lot detail (line 2164/2194/2198/2201/2212/2241) |
| §11.302d-3d | KPI valueClass line 2429-2430 |
| §11.302e | inventory-summary-block + Lot 추적 widget |
| §11.290 Phase 4c-3 | AI 스캔 PO 매칭 (planner) |
