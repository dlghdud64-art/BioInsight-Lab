refactor(inventory): §11.320 Phase 5 #mobile-closeout — 액션 button 모바일 44px + 접기 button hit area + 회귀 audit + plan closeout (호영님 P1, 2026-05-29)

호영님 P1 §11.320 Phase 5 (GREEN, closeout) — 모바일 정합 + 회귀 0 audit + plan 종결.

배경:
- Phase 2~4 작업 후 Phase 5 = 모바일 + 회귀 + closeout.
- CLAUDE.md §8 "터치 영역 ≥ 44px (iOS HIG)" 강제 — 액션 button h-8(=32px) 모바일 미달.
- 접기 button(text-[10px] 단독) 모바일 hit area 작음.
- sourcing-context-rail.tsx 이식본 회귀 0 grep evidence 필요.
- 기존 sentinel(amber/orange 부재, disposal-priority) 영향 audit 필요.

Fix (Phase 5 — inventory-context-panel.tsx 단일 + sentinel 1):

- apps/web/src/components/inventory/inventory-context-panel.tsx:
  · 액션 button 4개(재주문/우선소진/입고등록/정보수정) 모바일 정합:
    · "flex-1 h-8 text-xs ..." → "flex-1 min-h-[44px] md:min-h-0 md:h-8 text-xs ..."
    · 모바일 44px (iOS HIG) + 데스크탑 h-8 유지 (md+ 단순화)
  · 접기/펼치기 button 3개(LOT/Flow/History) hit area 확장:
    · "text-[10px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
      → 위 className + " min-h-[32px] px-2 -mx-2 inline-flex items-center"
    · text 자체는 보존 (-mx-2 로 시각 width 영향 0)
    · 모바일 touch 32px 확보, aria-expanded 유지

- apps/web/src/__tests__/regression/
  inventory-context-panel-restructure-320.test.ts:
  · Phase 5 describe 4 추가:
    · 액션 button min-h-[44px] md:min-h-0 md:h-8 ≥ 4 매칭 + 옛 h-8 단독 잔존 0
    · 접기 button min-h-[32px] px-2 -mx-2 inline-flex items-center ≥ 3 매칭
    · KPI grid grid-cols-3 gap-3 mt-3 모바일 한 줄 (CLAUDE.md §1)
    · sourcing-context-rail.tsx — SEVERITY_STYLE / SectionHeader 미공유 grep 0

canonical 보존 (회귀 0):
- 액션 button 핸들러(onReorder/onEdit) 시그니처 변경 0
- 접기 button onClick (setIs*Expanded) 핸들러 보존
- 시각 너비 영향 0 (-mx-2 로 padding 상쇄)
- 데스크탑(md+) 액션 button 높이 h-8 유지 (시각 회귀 0)

회귀 audit 결과 (Phase 5 grep + 단언):
- §11.283c-2 amber/orange 잔존 0 sentinel: 영향 0 ✓ (yellow/red/blue 만 사용)
- inventory-context-panel-disposal-priority: disposal-strip / dispose-cta / isExpiredLotWithQty / reorder-after-disposal 모두 보존 ✓
- operational-brief-* 4 file: caller-side 영향 0 (popup-context import 추가만)
- sourcing-context-rail.tsx: InventoryContextPanel 내부 SEVERITY_STYLE/SectionHeader 패턴 미이식 grep 0 ✓
- caller 2곳(inventory-content:2725 / inventory-main:1958) props 변경 0 ✓

Plan closeout:
- docs/plans/PLAN_11.320-inventory-context-panel-restructure.md:
  · Status: 🔄 In Progress → ✅ Complete
  · Phase 0~5 모든 체크박스 [x]
  · Last Updated: 2026-05-29 (Phase 5 closeout)
  · Notes & Learnings 섹션 추가 (Blockers / commit history / production effect 5 phase 합산)

호영님 production effect (Phase 5 단독):
1. 모바일 액션 button 44px 터치 영역 확보 — iOS HIG 정합, 잘못 누르기 감소.
2. 모바일 접기 button hit area 32px — 손가락 터치 정확도 ↑.
3. 데스크탑 시각 변경 0 (md+ h-8 유지).
4. §11.320 전체 종결 — 9 섹션 → 5 섹션, 색상 §11.302 정합, 모바일 first fold 도달.

Out of Scope:
- 다음 트랙(§11.319 시약 라벨 스캔 / SMTP §11.314 Phase 2 / §11.317-b/c) 별도 batch

검증 (sandbox 정적 grep):
- min-h-[44px] md:min-h-0 md:h-8 매칭: 4건 (액션 button 4개)
- min-h-[32px] px-2 -mx-2 inline-flex items-center 매칭: 3건 (접기 button 3개)
- 옛 "flex-1 h-8 text-xs bg-(blue|yellow)-600" 잔존: 0
- sourcing-context-rail 의 SEVERITY_STYLE Record 패턴: 0 (의존 0)
- sourcing-context-rail 의 function SectionHeader 패턴: 0 (미공유)

Rollback path: git revert <SHA>
- 옛 액션 button h-8 + 접기 button text-[10px] 단독 복원 (단일 file)
- sentinel Phase 5 describe 4 제거

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/inventory/inventory-context-panel.tsx `
  apps/web/src/__tests__/regression/inventory-context-panel-restructure-320.test.ts `
  docs/plans/PLAN_11.320-inventory-context-panel-restructure.md `
  docs/commit-drafts/COMMIT_11.320-phase5-mobile-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.320-phase5-mobile-closeout.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory → 품목 click → 우측 패널 open (모바일 375px viewport)
3. 액션 button (재주문/우선소진/입고등록 + 정보수정) 모바일 높이 44px 정합 확인
4. 데스크탑(md+) 액션 button 시각 변경 0 (h-8 유지)
5. LOT/연결된 흐름/최근 수정 접기 button 모바일 hit area 확장 확인 (32px)
6. 접기 button 시각 너비 변경 0 (-mx-2 padding 상쇄)
7. KPI 3 grid-cols-3 모바일 한 줄 정합 확인
8. 상태 배너 클릭 → 운영 브리핑 popup 정상 (Phase 2 wiring 회귀 0)
9. 재주문 button click → §11.303 재발주안 바텀시트 정상 (Phase 4 caller 회귀 0)
10. sourcing-context-rail (소싱 dock) 회귀 0 — 다른 caller 패널 영향 없음 확인

## Next (호영님 push 회신 후)

§11.320 종결 → 후속 트랙 진입 (호영님 선택):
1. §11.319 시약 라벨 스캔 + 가이드 프레임 (P1, 6-12h, Opus 4.8 권장)
2. §11.317-b/c ai-pipeline @ts-nocheck 제거 (release-prep deferred, 2-4h)
3. SMTP 자동발송 §11.314 Phase 2 (lib/email/sender.ts 실제 발송, 2-3h)
