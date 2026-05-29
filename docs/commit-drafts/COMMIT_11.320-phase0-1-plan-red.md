docs+test(plan): §11.320 Phase 0+1 — Truth Lock + failing sentinel (RED) for 재고 상세 우측 패널 재구성 (호영님 P1 구 §11.315, 2026-05-29)

호영님 P1 (구 §11.315, 번호 충돌로 §11.320 매핑) Phase 0+1.

배경:
- 재고 관리 우측 운영 브리핑 패널이 9 섹션 세로 나열로 화면 2배 길이, 스크롤 필수.
- 상황 요약 + 리스크 + 권장 액션 중복 / "핵심 근거" 라벨 의미 불명 / 보라+빨간테두리+회색 글씨 색상 혼재.
- 탭 4개(상태 요약/보유량/리스크/재발주)가 있는데 내용 다 펼침 → 탭 무의미.
- 정보 우선순위 부재로 가장 중요한 정보(현재 상태 + 권장 액션)가 묻힘.
- §11.317 패턴 따라 5 phase 분할 + 호영님 phase별 push.

Phase 0 (Truth Lock — read-only evidence) ✅:

| 항목 | 결과 |
|---|---|
| Target file | components/inventory/inventory-context-panel.tsx (1020 lines) |
| Header (운영브리핑+선택한재고) | line 447-450 (유지/압축) |
| 탭 4 (요약/보유/리스크/재발주) | line 456-459 (**제거** — 어차피 펼침) |
| 상황 요약 (1줄+LLM) | line 573-588 (**상태 배너로 통합**) |
| 핵심 근거 (4 KPI) | line 590~ (**"재고 현황" 라벨** + KPI 3 — 최단LOT 제거) |
| 리스크 | line 714 (**상태 배너 통합 — 중복 제거**) |
| 연결된 흐름 | line 739 (**접힌 상태 시작**) |
| 권장 액션+추천이유 | line 834 (**상태 배너 한 줄 흡수**) |
| 최근 수정 이력 | line 893 (**접힌 상태 시작**) |
| § 4. 다음 조치 (sticky footer) | line 911-955 (**상단 배너 하단으로 이동**) |
| 호출부 2곳 | inventory-content.tsx:2720 + inventory-main.tsx:1954 (props 시그니처 보존 → caller 변경 0) |
| 외부 의존 | sourcing-context-rail.tsx 이식 — Phase 5 회귀 가드 |
| 상태별 분기 source | item.currentQuantity / safetyStock / expiryDate (이미 컴포넌트 안 존재) |

Fix (Phase 0 + Phase 1 묶음, 2 file):

- docs/plans/PLAN_11.320-inventory-context-panel-restructure.md (NEW):
  · 5 phase plan + Phase 0 evidence 12항목 + Phase 1~5 spec mapping + Risk/Rollback
  · Status: 🔄 In Progress / Phase 0 ✅ Complete

- apps/web/src/__tests__/regression/
  inventory-context-panel-restructure-320.test.ts (NEW, ~10 it):
  · Phase 2 RED: 상태 배너 testid / 3 상태 분기(emerald/yellow/red) / 탭 4 제거
  · Phase 2 RED: 액션 button testid 상단 + sticky footer 위치 제거
  · Phase 3 RED: "핵심 근거" → "재고 현황" 라벨 + KPI 3 testid (current/safety-stock/expiring-soon)
  · Phase 3 RED: useState 접기 (isLotSectionExpanded/isFlowSectionExpanded/isHistorySectionExpanded)
  · Phase 4 RED: 보라/빨간테두리 강조 0 (§11.302 정합)
  · Phase 4 RED: 재주문 wiring (onReorderReview) + 상태 배너 onClick → operationalBriefPopup
  · canonical 가드: InventoryContextPanel props 시그니처 유지 / item mutation 0 / 폐기 mutation 0(deep link 만)

회귀 0 (보존):
- source/UX 변경 0 (Phase 0 = read-only, Phase 1 = sentinel only)
- 호출부 2곳 (inventory-content / inventory-main) props 변경 0
- sourcing-context-rail 이식본 손대지 않음 (Phase 5 회귀 가드)
- Vercel build 영향 0 (test file 추가만)

호영님 production effect:
- 없음 (Phase 0+1 = evidence + RED test). Phase 2 부터 사용자 노출 변경 시작.

⚠️ Phase 1 RED 의도적 fail — 현재 source 와 충돌. Phase 2~4 작업으로 GREEN 전환.

Rollback path: git revert <SHA>
- plan 문서 + sentinel file 삭제 (source 변경 0 안전)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add docs/plans/PLAN_11.320-inventory-context-panel-restructure.md `
  apps/web/src/__tests__/regression/inventory-context-panel-restructure-320.test.ts `
  docs/commit-drafts/COMMIT_11.320-phase0-1-plan-red.md
git status
git commit -F docs/commit-drafts/COMMIT_11.320-phase0-1-plan-red.md
git push origin main
```

## Production smoke
- 해당 없음 (docs + RED test). Vercel READY 확인만.

## Next (호영님 push 회신 후)
- Phase 2: Header + 상태 배너 + 액션 button 상단 + 탭 4 제거
- 별도 commit + present_files
