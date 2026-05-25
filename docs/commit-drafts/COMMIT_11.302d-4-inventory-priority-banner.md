# §11.302d-4 Commit Message Draft (우선 처리 배너 신호등 의미 정합)

```
fix(inventory): §11.302d-4 #inventory-priority-banner — 우선 처리 배너 (호영님 spec "긴급 재발주 필요" 안내 박스) 신호등 색상 의미 역전 정정

호영님 spec 의 "긴급 재발주 필요" 안내 박스 = inventory-content.tsx
line 2035-2058 "우선 처리 배너" 정확 매칭. audit 결과 색상 의미 역전:

| trigger          | 현재         | 호영님 spec   |
|------------------|--------------|---------------|
| priorityExpiredLot | red-50/red-600 | 위험 red ✓ |
| expiringSoon       | red-50/red-600 | 검토 yellow ✗ |
| lowOrOutOfStock    | yellow-50/yellow-600 | 긴급 red ✗ |

만료 임박 (검토) 이 빨강, 재고 부족 (긴급) 이 노랑 — 의미 역전.
사용자 인지 혼란.

Fix (1 file 4 conditional swap + 1 NEW test):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx
  (line 2034-2058):
  · 박스 배경 conditional swap (4 분기):
    priorityExpiredLot → border-red-200 bg-red-100 (위험)
    expiringSoon → border-yellow-200 bg-yellow-100 (검토)
    lowOrOutOfStock → border-red-200 bg-red-100 (긴급)
    fallback → border-slate-200 bg-slate-50 (그대로)
  · icon container 배경 swap (강조용):
    priorityExpiredLot → bg-red-200
    expiringSoon → bg-yellow-200 (이전 red-100 정정)
    lowOrOutOfStock → bg-red-200 (이전 yellow-100 정정)
    fallback → bg-slate-100 (그대로)
  · icon color 정합:
    Trash2 → text-red-700 (위험)
    Calendar → text-yellow-700 (검토, 이전 red-600 정정)
    AlertTriangle → text-red-700 (긴급, 이전 yellow-600 정정)
    Zap → text-slate-600 (그대로)
  · button color 분기 정합:
    expiringSoon only && !priorityExpired → yellow-600 white (검토 action)
    그 외 (priorityExpired or lowOrOut) → red-600 white (위험/긴급 action)
  · 신호등 정합 trace comment 추가

- apps/web/src/__tests__/regression/inventory-priority-banner-302d4.test.ts
  (NEW, 13 it × 4 nested describe):
  · §11.302d-4 trace
  · 배경 색상 4 분기 — 의미 역전 정정 검증
  · icon container + icon color — spec 정합
  · button color 위험/긴급 vs 검토 분기
  · 회귀 0: issuesCount conditional + 정상 fallback (emerald) + 4
    배너 텍스트 + onClick handler 보존

큰 박스 가독성 결정:
spec "위험 red-600 + text-white" 는 KPI 카드 (작음) 전용. 큰 박스는
text-slate-900 heading conflict 회피 → bg-red-100 (긴급 색상으로
통일). priorityExpired vs lowOrOut 의 위험/긴급 구분은 icon
container 진하기 (bg-red-200) + button action 색상 유지.

canonical truth 보존 (회귀 0):
- issuesCount, priorityExpiredLot, expiringSoonCount,
  lowOrOutOfStockCount, topPriorityQueueItem, actionableExpiredLots
  source 변경 0
- openDisposalDock / handlePriorityQueueAction onClick 변경 0
- 정상 상태 fallback (emerald-200 bg-emerald-50 "모든 재고 정상")
  변경 0
- 4 배너 텍스트 ("우선 처리: 만료 lot/만료 임박/재고 부족", "처리
  대기") 변경 0
- 요약 칩 (line 2070-2094) 변경 0 — §11.302d-5 별도 batch

호영님 production effect:
1. 만료 임박 상태 (expiringSoonCount > 0, !priorityExpired) → 노란색
   배너 (검토 시그널). 이전: 빨간색 (잘못된 위험 시그널)
2. 재고 부족 상태 (lowOrOutOfStock > 0, others=0) → 빨간색 배너 (긴급
   재발주 시그널). 이전: 노란색 (잘못된 검토 시그널)
3. 이미 만료 (priorityExpiredLot) → 빨간색 (위험, 그대로)
4. 정상 (issuesCount=0) → 초록색 (그대로)

§11.302d 후속 (호영님 결정 대기):
- §11.302d-3: inventory-content.tsx 그 외 amber/yellow ~17 곳 분할
- §11.302d-5: 요약 칩 (line 2070-2094) 색상 정합 + "전체 재고" 칩
  §11.302c 정합 제거 여부

Out of Scope:
- 위험 spec literal (bg-red-600 + text-white) — 큰 박스 가독성
  conflict 회피. KPI 카드 전용 (§11.302c).
- 정상 상태 emerald — 호영님 spec 외 (긍정 시그널), 그대로 유지.

Rollback path: git revert <SHA>
- 1 file 4 conditional 복원 + sentinel test 삭제
- 색상 역전 회귀

Lessons:
1. 색상 의미 역전 = UX bug — 만료 임박 (검토) 이 빨강 으로 표시되면
   사용자가 "긴급" 으로 오인. spec audit 시 라벨 ↔ 색상 정합 검증
   필수.
2. priorityExpiredLot vs lowOrOut conditional 우선순위 — 박스 색상은
   동일 (red) 이지만 button conditional 은 분리 (검토 vs 위험/긴급)
   하여 미세 분기.
3. icon container 진하기 (bg-red-100 → bg-red-200) — 큰 박스에서
   icon 강조 + 박스 배경 가독성 두 마리 토끼.
4. button color logical 추론 — spec 외 영역 (button 은 KPI 카드 spec
   아님) 이지만 박스 색상 정합으로 swap. 검토 = yellow action, 위험/
   긴급 = red action.
5. Karpathy minimum-diff — 1 file 4 conditional + comment trace +
   1 NEW test (13 it).
```

## Push

```bash
git add apps/web/src/app/dashboard/inventory/inventory-content.tsx \
        apps/web/src/__tests__/regression/inventory-priority-banner-302d4.test.ts \
        docs/commit-drafts/COMMIT_11.302d-4-inventory-priority-banner.md

git commit -F docs/commit-drafts/COMMIT_11.302d-4-inventory-priority-banner.md
git push origin main
```

## Production smoke

1. labaxis-co.kr/dashboard/inventory 점검 사항 탭 Cmd+Shift+R
2. 4 상태별 우선 처리 배너 색상 확인:
   - priorityExpiredLot 있을 때 → 빨간 박스 + Trash2 + "폐기 처리
     시작" red button (위험)
   - expiringSoon만 (priorityExpired 없음) → 노란 박스 + Calendar +
     "폐기 처리 시작" yellow button (검토, 이전 red 정정)
   - lowOrOut만 → 빨간 박스 + AlertTriangle + "처리 시작" red button
     (긴급, 이전 yellow 정정)
   - issuesCount=0 → 초록 박스 + CheckCircle2 + "모든 재고 정상"
3. button onClick 정상 작동 (openDisposalDock / handlePriorityQueueAction)

## 후속 batch (호영님 push 응답 후 결정)

| § | scope | 호영님 결정 |
|---|---|---|
| §11.302d-5 | 요약 칩 (line 2070-2094) 색상 정합 + "전체 재고" 제거 여부 | spec 정합 권장 |
| §11.302d-3 | inventory-content.tsx 그 외 amber/yellow ~17 곳 분할 | 진입 OK |
| §11.302e | inventory-summary-block + Lot 추적 widget | 호영님 결정 |
| §11.290 Phase 4c-3 | AI 스캔 PO 매칭 풀스펙 | planner 진입 OK |
