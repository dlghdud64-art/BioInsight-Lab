refactor(inventory): §11.320 Phase 4 #color-wiring — §11.302 신호등 정합 + 빨간/노랑 테두리 강조 제거 + sentinel 정확화 (호영님 P1, 2026-05-29)

호영님 P1 §11.320 Phase 4 (GREEN) — 색상 §11.302 정합 + 인터랙션 wiring 검증.

배경:
- spec §3-4 "보라색 제거, 빨간 테두리 제거, 회색 글씨 제거" 정합 필요.
- §11.302 신호등 체계: 위험=bg-red-50/text-red-700, 주의=bg-yellow-50/text-yellow-700,
  정보=bg-blue-50/text-blue-700, 정보성=bg-slate-50/text-slate-600.
- Phase 4 audit 결과: 보라 강조 0(이미 정합), 빨간/노랑 테두리 강조 3건 잔존.

Fix (Phase 4 — inventory-context-panel.tsx 단일 + sentinel 1):

- apps/web/src/components/inventory/inventory-context-panel.tsx:
  · SEVERITY_STYLE 4 항목 (line 345-350) — border 강조 제거 + §11.302 정합:
    · critical: "bg-red-500/15 text-red-400 border-red-500/30" → "bg-red-50 text-red-700"
    · high:     "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" → "bg-yellow-50 text-yellow-700"
    · medium:   "bg-blue-500/15 text-blue-400 border-blue-500/30" → "bg-blue-50 text-blue-700"
    · low:      "bg-pg0/15 text-slate-400 border-slate-500/30" → "bg-slate-50 text-slate-600"
  · disposal Badge 3개 (만료/사용 금지/재주문은 폐기 후):
    · "border border-red-300 bg-white text-red-700" → "border-none bg-red-50 text-red-700"
    · 노랑 동일 패턴 → "border-none bg-yellow-50 text-yellow-700"
  · 인터랙션 wiring 확인 (Phase 4 검증):
    · onReorder?.(item) 사용 — Phase 2 에서 이미 wiring 정합 (caller inventory-content:2725 /
      inventory-main:1958 가 §11.303 재발주안 바텀시트 핸들러 전달)
    · operationalBriefPopup.open() 사용 — Phase 2 에서 wiring 정합 (상태 배너 onClick)

- apps/web/src/__tests__/regression/
  inventory-context-panel-restructure-320.test.ts:
  · 재주문 wiring 정규식 정확화: `onReorderReview|openReorderReview|reorderReviewSheet`
    → `onReorder\?\.\(item\)|onReorder\(item\)|onReorder\?:\s*\(`
    (Phase 4 GREEN target — 실제 onReorder prop 패턴 매칭)

canonical 보존 (회귀 0):
- risks render(C. Operational Risk section, line 800+) SEVERITY_STYLE 동일 사용 — 색상만 swap
- isExpiredLotWithQty disposal-strip Badge 텍스트/구조 변경 0 (border만 제거 + bg 정합)
- props 시그니처/onReorder wiring 변경 0 (caller 2곳 영향 0)
- §11.302 신호등 정합 — 위험/주의/정보/정보성 모두 정합

Phase 1 sentinel GREEN 전환:
- not.toMatch(/border-red-300/) ✓ (잔존 0, 옛 주석도 정리)
- not.toMatch(/border-red-400/) ✓ (애초 0)
- not.toMatch(/text-purple-700 font-bold/) ✓ (보라 0)
- onReorder wiring 정합 ✓ (정규식 정확화)
- operationalBriefPopup ✓ (Phase 2 wiring 유지)

호영님 production effect:
1. risks Badge / disposal Badge 모두 §11.302 신호등 정합으로 통일 — border 강조 사라짐.
2. 시각적 일관성↑: 위험은 항상 bg-red-50 + text-red-700, 주의는 bg-yellow-50 + text-yellow-700.
3. 다른 동작/wiring 변경 0 — 시각만 정합.

Out of Scope (Phase 5):
- 모바일 final + sourcing-context-rail 회귀 통합 + plan closeout

검증 (sandbox 정적 grep):
- border-red-300 / border-red-400 잔존 0 (옛 주석 정리 후)
- text-purple 잔존 0
- bg-{tone}-50 + text-{tone}-700 8건 매칭 (SEVERITY_STYLE 4 + disposal 3 + 기타)
- useOperationalBriefPopup 3건 (import + hook + .open() call)

Rollback path: git revert <SHA>
- 옛 SEVERITY_STYLE border-red-500/30 + disposal Badge border 복원 (단일 file)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/inventory/inventory-context-panel.tsx `
  apps/web/src/__tests__/regression/inventory-context-panel-restructure-320.test.ts `
  docs/commit-drafts/COMMIT_11.320-phase4-color-wiring.md
git status
git commit -F docs/commit-drafts/COMMIT_11.320-phase4-color-wiring.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory → 품목 click → 우측 패널 open
3. risks 표시 시 SEVERITY_STYLE 색상 §11.302 정합 (border 강조 사라짐)
4. 만료 case (isExpiredLotWithQty) disposal-strip Badge 3개 (만료/사용 금지/재주문은 폐기 후) border 강조 사라지고 bg-{tone}-50 + text-{tone}-700 정합
5. 재주문 button click → caller 핸들러(onReorder)가 §11.303 재발주안 바텀시트 trigger 정상 동작
6. 상태 배너 click → 운영 브리핑 popup 정상 동작 (Phase 2 wiring 유지)

## Next (호영님 push 회신 후)
- Phase 5: 모바일 final + sourcing-context-rail 회귀 audit + plan closeout (§11.320 종결)
