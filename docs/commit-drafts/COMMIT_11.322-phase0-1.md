test(inventory): §11.322 Phase 0+1 #2nd-refinement-red — Truth Lock + failing sentinel (잘림·중복·위계 8 완료 기준 단언) (호영님 P1, 2026-05-29)

호영님 P1 §11.322 Phase 0+1 (RED) — 재고 상세 우측 레일 2차 고도화.

배경:
- §11.320 production smoke 후 호영님 잔여 5 문제 발견:
  · A. 재고 현황 카드 잘림 ("0 bot...") — 레일 ~400px 폭 grid-cols-3 카드 좁음
  · B. 빨간 카드 테두리 잔존 (qtyTone="danger" 카드만, 옆 카드 무테두리 = 불균형)
  · C. 상태 배너 ↔ 재고 현황 숫자 중복 ("현재 0 / 안전재고 8" 두 번)
  · D. 리스크 "안전재고 미만" ↔ 상태 배너 중복
  · E. 정보 위계 평면 — 6 섹션 동일 비중, 권장 액션 항상 펼침
- 호영님 spec 8 완료 기준 (잘림 해결 / 색상 정리 / 중복 제거 / 위계 / 공통)
- 번호 매핑: 호영님 spec §11.317 → §11.322 (§11.317-b ai-pipeline batch 와 충돌 회피)

Fix (Phase 0+1 — plan + sentinel, production code 변경 0):

- docs/plans/PLAN_11.322-inventory-context-panel-2nd-refinement.md:
  · 5 phase 구조 (§11.320 패턴 재사용)
  · §0 evidence: 5 문제 정확 line 매핑 (A=686, B=691, C=527-532, D=792-816, E=925-958)
  · 호출부 2곳 (inventory-content:2725 / inventory-main:1958) props 보존 명시
  · §11.320 결정 번복 명시: "최단 LOT 제거" → 인라인 row 4 (현재/안전재고/만료 임박/최단 LOT) 재도입

- apps/web/src/__tests__/regression/
  inventory-context-panel-2nd-refinement-322.test.ts (NEW):
  · 8 describe / ~11 it 단언
  · A: 인라인 row 4 testid (current/safety-stock/expiring-soon/shortest-lot) + grid-cols-3 패턴 0 + flex justify-between 패턴
  · B: qtyTone 보존 + 위험 값 text-red-600 분기
  · C: toneSub 옛 "현재 ${qty}" 패턴 0 + 신 결론 문구 ("즉시 재주문 필요" / "우선 소진 권장")
  · D: visibleRisks / risks.filter / filteredRisks 표현 + length 0 시 섹션 생략
  · E: isActionsSectionExpanded useState + aria-expanded
  · canonical 보존: caller props / §11.320 결정(탭 0 / 상태 배너 / 액션 상단 / 접기 3) / 권장 액션 섹션 자체 / 폐기 검토 분리
  · Phase 5: 액션 button min-h-[44px] (§11.320 Phase 5) + sourcing-context-rail 회귀 0

canonical 보존 (Phase 5 가드):
- caller 호출 시그니처 (InventoryContextPanel props) 변경 0
- §11.320 결정 보존 (탭 0 / 상태 배너 / 액션 상단 / 접기 3섹션)
- 권장 액션 섹션 자체 보존 (단지 접힘 추가)
- disposal-strip + isExpiredLotWithQty 보존

Phase 1 RED 상태 예상:
- 11 it 중 0~1 통과 (canonical "InventoryContextPanel props 유지" / "권장 액션 섹션 자체" 등만 통과)
- 나머지 10 it = Phase 2~4 작업으로 GREEN 전환

호영님 production effect (Phase 0+1):
- production 변화 0 (plan + sentinel 만)
- §11.322 작업 가드 확보 — Phase 2~5 작업이 호영님 spec 8 완료 기준 정합 검증

Out of Scope (Phase 2~5):
- Phase 2: A + B (인라인 row + 위험 텍스트 색상)
- Phase 3: C + D (상태 배너 결론 + 리스크 필터)
- Phase 4: E (권장 액션 접힘 + 모바일)
- Phase 5: 회귀 + closeout

검증 (sandbox 정적 grep):
- PLAN file 작성 ✓
- sentinel file 8 describe / ~11 it ✓
- production code 변경 0 ✓

Rollback path: git revert <SHA>
- sentinel + PLAN 삭제 (production 영향 0)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add docs/plans/PLAN_11.322-inventory-context-panel-2nd-refinement.md `
  apps/web/src/__tests__/regression/inventory-context-panel-2nd-refinement-322.test.ts `
  docs/commit-drafts/COMMIT_11.322-phase0-1.md
git status
git commit -F docs/commit-drafts/COMMIT_11.322-phase0-1.md
git push origin main
```

## Production smoke
- N/A (sentinel + plan 만, production 변화 0)

## Next (호영님 push 회신 후)
- Phase 2: A (재고 현황 인라인 row 4) + B (위험 텍스트 색상)
