refactor(inventory): §11.320 Phase 2 #status-banner — 상태 배너 통합 + 액션 상단 + 탭 4 제거 (호영님 P1, 2026-05-29)

호영님 P1 §11.320 Phase 2 (GREEN) — 재고 상세 우측 패널 상태 배너 통합 + 액션 상단 + 탭 제거.

배경:
- Phase 0+1 RED 단계 후 GREEN 전환. 현재 9 섹션 세로 나열 → 정보 우선순위 부재.
- 상황 요약 + 리스크 Badge + 권장 액션 + 추천 이유 = 사실상 동일 정보 4중 표시.
- 탭 4(상태 요약/보유량/리스크/재발주)가 있으나 내용 다 펼침 → 탭 무의미.
- 다음 조치 액션 button 이 sticky footer(최하단) → 가장 중요한 액션이 묻힘.

Fix (Phase 2 — inventory-context-panel.tsx 단일 file, 5 Edit):

- Edit 1: **탭 4 (preset chips anchor jump) 제거** (line 453-474 → 1줄 docblock)
- Edit 2: Item Header 안 **risks Badge 제거** (상태 배너로 통합). 유해물질 Badge 만 유지.
- Edit 3: **상태 배너 + 액션 button 카드 신설** (Item Header 직후, isExpiredLotWithQty 전):
  · 만료 case (isExpiredLotWithQty) 는 disposal-strip 에 위임 — 본 배너는 그 외 분기만
  · 3 상태 분기 — 위험(currentQty=0 또는 ≤safetyStock) / 주의(만료 D-30 이내) / 정상
  · 색: bg-red-50 text-red-700 / bg-yellow-50 text-yellow-700 / bg-emerald-50 text-emerald-700
  · 라벨: "재고 소진/안전재고 미달" / "만료 임박" / "정상" + sub-text + "→ {권장 액션}"
  · onClick → operationalBriefPopup.open() (풀 패널 진입)
  · 액션 button 2개 (위험=재주문/정보수정 / 주의=우선소진/정보수정 / 정상=입고등록/정보수정)
  · data-testid: inventory-context-status-banner / inventory-context-primary-actions
- Edit 4: **useOperationalBriefPopup import + hook 호출 추가** (line 30+)
- Edit 5: **§ 1. 상황 요약 (line 573-588) 제거** — 상태 배너로 통합됨
- Edit 6: **§ 4. 다음 조치 sticky footer (line 911-955) 제거** — 액션 상단으로 이동
- onReorder 호출 정합 (기존 prop 활용, 새 prop 추가 0)

canonical 보존 (회귀 0):
- InventoryContextPanel props 시그니처 변경 0 — caller 2곳(inventory-content:2720, inventory-main:1954)
  영향 0 (onReorder/onEdit/onDispose 기존 prop 그대로 활용)
- isExpiredLotWithQty disposal-strip + onDispose mutation 보존 (만료 case)
- briefNarrative / briefCached / risks variable 다른 섹션에서 여전히 사용 (Phase 3~4 에서 정리)
- sourcing-context-rail.tsx (이식본) 영향 0

Phase 1 sentinel GREEN 전환 (예상 부분):
- 상태 배너 testid + 3 분기(red/yellow/emerald) ✓
- 액션 button 상단 testid + "§ 4. 다음 조치" sticky footer 제거 ✓
- 탭 4 array 제거 ✓
- useOperationalBriefPopup hook 사용 ✓

여전히 RED (Phase 3~4 GREEN target):
- "핵심 근거" → "재고 현황" 라벨 (Phase 3)
- KPI 3 testid (current/safety-stock/expiring-soon) (Phase 3)
- useState 접기 (LOT/Flow/History) (Phase 3)
- 보라/빨간테두리 강조 제거 (Phase 4)

호영님 production effect:
1. 패널 진입 즉시 상태 배너(현재 상태 + 권장 액션) 가장 위 노출 — above the fold.
2. 액션 button (재주문/정보수정 등) 상태 배너 바로 아래 — 즉시 액션 가능.
3. 탭 4 (어차피 무의미) 사라짐 — 시각 깔끔.
4. 만료 case 는 기존 disposal-strip 가 처리 (보존).
5. 상태 배너 클릭 → 운영 브리핑 popup open (풀 패널 진입).

Out of Scope (Phase 3~5 처리):
- "핵심 근거" → "재고 현황" 라벨 변경 + KPI 4 → 3 (Phase 3)
- LOT / 연결된 흐름 / 최근 수정 useState 접기 (Phase 3)
- 보라/빨간테두리 강조 제거 + §11.302 신호등 정합 (Phase 4)
- 재주문 → §11.303 재발주안 바텀시트 caller wiring 정합 (Phase 4 — caller 결정)
- 모바일 + 회귀 통합 (Phase 5)

Rollback path: git revert <SHA>
- 옛 탭 4 + § 1. 상황 요약 + § 4. 다음 조치 sticky footer + risks Badge 모두 복원 (단일 file)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/inventory/inventory-context-panel.tsx `
  docs/commit-drafts/COMMIT_11.320-phase2-status-banner.md
git status
git commit -F docs/commit-drafts/COMMIT_11.320-phase2-status-banner.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory 진입 → 품목 click → 우측 패널 open
3. 위험 케이스 (currentQty=0 또는 ≤safetyStock): 상태 배너 red + "재주문" button (위 상단)
4. 주의 케이스 (만료 D-30 이내): 상태 배너 yellow + "우선 소진" button
5. 정상 케이스: 상태 배너 emerald + "입고 등록" button
6. 탭 4 (상태 요약/보유량/리스크/재발주) 사라짐 확인
7. 다음 조치 sticky footer 사라짐 확인 (액션이 상단으로 이동)
8. 상태 배너 클릭 → 운영 브리핑 popup open 확인
9. 만료 case (isExpiredLotWithQty) 는 기존 disposal-strip 그대로 동작
10. 회귀: 다른 caller 패널 (sourcing-context-rail) 정상 동작 확인

## Next (호영님 push 회신 후)
- Phase 3: "재고 현황" 라벨 + KPI 4 → 3 + 섹션 접기 (LOT/Flow/History useState)
