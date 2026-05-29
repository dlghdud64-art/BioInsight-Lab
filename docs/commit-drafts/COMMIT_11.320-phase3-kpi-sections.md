refactor(inventory): §11.320 Phase 3 #kpi-sections — '재고 현황' 라벨 + KPI 4→3 + 1줄 메타 + 3 섹션 접기 (호영님 P1, 2026-05-29)

호영님 P1 §11.320 Phase 3 (GREEN) — 정보 우선순위 명확화.

배경:
- "핵심 근거" 라벨 의미 불명 → "재고 현황"으로 변경
- KPI 4(현재/안전재고/만료까지/최단 Lot)에서 최단 Lot 제거 → 3개로 단순화 (LOT 섹션과 중복)
- 카테고리/보관/위치/시험항목 4 InfoRow 세로 grid → 1줄 메타로 압축
- LOT / 연결된 흐름 / 최근 수정 이력 = 자주 보지 않는 정보 → 접힌 상태 시작

Fix (Phase 3 — inventory-context-panel.tsx 단일 file, 6 Edit):

- import { useState } from "react" 추가
- useState 3개 추가: isLotSectionExpanded / isFlowSectionExpanded / isHistorySectionExpanded (default false)
- SectionHeader label "핵심 근거" → "재고 현황"
- KPI 4 cell grid-cols-2 → 3 cell grid-cols-3, 각 cell 에 data-testid:
  · inventory-context-kpi-current (현재 수량, qtyTone 보존)
  · inventory-context-kpi-safety-stock (안전재고)
  · inventory-context-kpi-expiring-soon (만료 임박, expiryTone 보존, "만료까지"→"만료 임박")
  · 최단 Lot cell 제거 (LOT 섹션에서 노출됨, 중복 제거)
- InfoRow 4 (카테고리/보관/위치/시험항목) grid-cols-2 4 row → 1줄 flex 메타 (text-[11px] text-slate-500)
- LOT 정보 섹션: SectionHeader 옆 접기/펼치기 토글 button + 본문 {isLotSectionExpanded && (...)} wrap
  · "Lot 정보" → "Lot 정보 (N건)" (펼치기 전에도 건수 인지)
- 연결된 흐름 섹션: 동일 패턴 (D. Connected Flow)
- 최근 수정 이력 섹션: 동일 패턴 (H. Last Modified)
- aria-expanded 속성 보존 (a11y)

canonical 보존 (회귀 0):
- qtyTone / expiryTone logic 보존 (위험·주의·정상 분기 동일)
- onLotDrillDown / lots.map / flows.map / transactions render 영향 0 (펼침 시 동일)
- InventoryContextPanel props 시그니처 변경 0 — caller 2곳 영향 0
- §11.302 신호등 정합 (Phase 4 에서 보라/빨간테두리 강조 제거 예정)

Phase 1 sentinel GREEN 전환:
- label="재고 현황" ✓ / label="핵심 근거" 0 ✓
- inventory-context-kpi-current/safety-stock/expiring-soon testid ✓
- isLotSectionExpanded / isFlowSectionExpanded / isHistorySectionExpanded useState ✓
- canonical: caller props 보존 ✓

호영님 production effect:
1. "재고 현황" 라벨 명확 (의미 불명 해소).
2. KPI 3개로 단순화 — 정보 우선순위 명확, 중복 제거.
3. 카테고리/보관/위치 1줄 메타로 압축 — 패널 세로 길이 단축.
4. LOT/연결된 흐름/최근 수정 접힌 상태 시작 → above the fold 에 핵심 정보만 노출.
5. 펼치기 button 으로 필요 시 detail 확인 (a11y aria-expanded 정합).

Out of Scope (Phase 4~5):
- 보라/빨간 테두리/회색 글씨 강조 제거 (§11.302 정합) — Phase 4
- 재주문 → §11.303 재발주안 바텀시트 caller wiring — Phase 4 (현재는 onReorder prop 그대로 호출, caller 결정)
- 모바일 + 회귀 통합 + sourcing-context-rail 영향 audit — Phase 5

검증 (sandbox 정적 grep):
- "재고 현황" 라벨 + KPI 3 testid + 1줄 메타 = 9건 매칭 ✓
- "핵심 근거" / "최단 Lot" / 옛 4 InfoRow = 0 ✓
- useState 3 + 토글 사용 = 9 매칭 ✓

Rollback path: git revert <SHA>
- 옛 "핵심 근거" + KPI 4 + grid-cols-2 InfoRow 4 + 펼침 default 복원 (단일 file)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/inventory/inventory-context-panel.tsx `
  docs/commit-drafts/COMMIT_11.320-phase3-kpi-sections.md
git status
git commit -F docs/commit-drafts/COMMIT_11.320-phase3-kpi-sections.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory 진입 → 품목 click → 우측 패널 open
3. § 2. 섹션 라벨 "재고 현황" 확인 ("핵심 근거" 사라짐)
4. KPI 3 (현재 수량 / 안전재고 / 만료 임박) — 4개 grid-cols-3, 최단 Lot 없음
5. KPI 아래 1줄 메타 (카테고리 · 보관 · 위치 · 시험항목)
6. LOT 정보 / 연결된 흐름 / 최근 수정 이력 = 접힌 상태 (펼치기 ▾ button 노출)
7. 펼치기 button 클릭 → 본문 보임, 접기 ▴ button 으로 swap
8. 모바일 375px 정합 (Phase 5에서 최종 검증)

## Next (호영님 push 회신 후)
- Phase 4: 색상 §11.302 정합 (보라/빨간테두리 제거) + 재주문 wiring 정합
