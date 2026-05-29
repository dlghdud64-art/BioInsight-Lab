refactor(inventory): §11.322 Phase 4 #actions-collapse — 권장 액션 useState 접기 + 3차 위계 통일 (호영님 P1, 2026-05-30)

호영님 P1 §11.322 Phase 4 (GREEN) — E. 정보 위계 평면 해소 (권장 액션 접힘).

배경:
- §11.320 production smoke 후 호영님 잔여 문제 E:
  · 정보 위계 평면 — 6 섹션 동일 비중, 권장 액션 항상 펼침
- 호영님 spec 6/7 정합: 정보 위계 3 단계
  · 1차 (항상 펼침, above fold): 상태 배너 / 재고 현황
  · 2차 (조건부 펼침): 리스크 (부가 리스크 있을 때만, Phase 3에서 below_safety 흡수)
  · 3차 (접힘 시작): LOT / 연결된 흐름 / **권장 액션** / 최근 수정
- 권장 액션은 §11.320 phase 3 에서 누락된 마지막 3차 섹션 — 본 Phase 4 에서 통일

Fix (Phase 4 — inventory-context-panel.tsx 단일):

- apps/web/src/components/inventory/inventory-context-panel.tsx:
  · useState 신규 (line 408 근처):
    · `const [isActionsSectionExpanded, setIsActionsSectionExpanded] = useState(false);`
    · 다른 3 섹션(isLotSectionExpanded / isFlowSectionExpanded / isHistorySectionExpanded) 와 동일 패턴
  · 권장 액션 섹션 헤더 wrap (line 978-991):
    · 옛: `<SectionHeader icon={Sparkles} label="권장 액션 + 추천 이유" />`
    · 신: `<div className="flex items-center justify-between">` + SectionHeader + 토글 button
    · 토글 button: `min-h-[32px] px-2 -mx-2 inline-flex items-center` (모바일 hit area 확장, §11.320 Phase 5 패턴 정합)
    · aria-expanded={isActionsSectionExpanded}
    · "접기 ▴" / "펼치기 ▾" label
  · 권장 액션 body wrap:
    · `{isActionsSectionExpanded && (` ... `)}` 으로 본문 전체(visibleActions.map + isExpiredLotWithQty 보조 액션 카드 포함) wrap
    · default false → 패널 진입 시 접힌 상태

canonical 보존 (회귀 0):
- 권장 액션 섹션 자체 보존 (§11.322 sentinel canonical 단언 정합)
- visibleActions.map render 로직 보존 (action.label / Button onClick wiring / 추천 이유)
- isExpiredLotWithQty 보조 액션 카드(폐기 후 재주문 검토) 본문 안에 보존 — 접기 시 함께 접힘
- 다른 3 섹션 토글 패턴(§11.320 Phase 3+5) 그대로 유지
- 권장 액션 onClick → onReorder/onDispose/onEdit caller wiring 보존

§11.322 Phase 1 sentinel GREEN 전환 (E):
- E: isActionsSectionExpanded / setIsActionsSectionExpanded 매칭 ✓
- E: SectionHeader label="권장 액션 + 추천 이유" 직후 aria-expanded={isActionsSectionExpanded} 매칭 ✓
- canonical: 권장 액션 섹션 자체 보존 + visibleActions.map 보존 ✓

Phase 5 sentinel 영향 (자연 GREEN 전환):
- 접기 button 3 → 4 (LOT/Flow/History + Actions 신규) — sentinel 단언 `>= 3` 이므로 4도 통과
- 모바일 min-h-[44px] 액션 button + min-h-[32px] 접기 button 패턴 보존

호영님 production effect:
1. 권장 액션 섹션 접힌 상태 시작 — above the fold 공간 회수.
2. 정보 위계 3 단계 통일:
   · 1차 (상태 배너/재고 현황): 항상 펼침
   · 2차 (리스크): 부가 리스크 있을 때만(Phase 3 visibleRisks)
   · 3차 (LOT/연결된 흐름/권장 액션/최근 수정): 모두 접힘 시작 — 펼치기 헤더만 노출
3. 패널 세로 길이 단축 — 모바일 first fold 도달성 ↑
4. 펼치기 button 클릭 → 권장 액션 본문 노출 (visibleActions + isExpiredLotWithQty 보조 액션 카드)

Out of Scope (Phase 5):
- 모바일 final 통합 검증 + sourcing-context-rail 회귀 audit + plan closeout

검증 (sandbox 정적 grep):
- useState 4 (Lot/Flow/History + Actions) ✓
- 권장 액션 토글 button + aria-expanded ✓
- {isActionsSectionExpanded && (...)} wrap 본문 ✓
- 옛 SectionHeader 단독 패턴 (label + 직후 mt-2.5) 잔존 0 (wrap 제외)

Rollback path: git revert <SHA>
- useState 1 + 권장 액션 헤더 wrap + body conditional wrap 모두 revert (단일 file)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/inventory/inventory-context-panel.tsx `
  docs/commit-drafts/COMMIT_11.322-phase4-actions-collapse.md
git status
git commit -F docs/commit-drafts/COMMIT_11.322-phase4-actions-collapse.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory → 품목 click → 우측 패널 open
3. 패널 위계 3 단계 확인:
   · 1차 펼침: 상태 배너 + 재고 현황 인라인 row 4
   · 2차: 리스크 섹션 (visibleRisks > 0 시만)
   · 3차 접힘: LOT / 연결된 흐름 / 권장 액션 / 최근 수정 — 모두 펼치기 ▾ 헤더만 노출
4. 권장 액션 펼치기 클릭 → visibleActions 리스트 + 추천 이유 + 실행 button + isExpiredLotWithQty 보조 액션 카드 노출
5. 접기 ▴ 클릭 → 본문 접힘
6. 모바일 375px above the fold = 상태 배너 + 액션 button + 재고 현황 인라인 row 4 (4 row 위계 1차 노출 도달)
7. caller 핸들러 정상 동작 — 펼친 상태에서 권장 액션 실행 button click → onReorder/onDispose/onEdit wiring

## Next (호영님 push 회신 후)
- Phase 5: 모바일 final + 회귀 통합 + sourcing-context-rail audit + plan closeout (§11.322 종결)
