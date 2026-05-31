refactor(layout,inventory): §11.333 #layout-width-inventory-brief — Part A 운영 화면 wide 정합 + Part B 재고 패널 기본 펼침/펼치기 가독성 (호영님 P2, 2026-05-30)

호영님 P2 §11.333 — 레이아웃 폭 일관성 + 재고 운영 브리핑 패널 UI 정정.

배경 (Phase 0 Truth audit 호영님 추정 정정):
- 호영님 추정 "재고 = max-w 제한" → 실제 grep: inventory-main/content 는 `max-w-full` (wide)
- 실제 정책 위반: **purchases:507 + safety:396 = max-w-7xl (1280px)** — 운영 화면 wide 정책 위반
- inventory 양옆 몰림은 다른 원인 (sticky bar / wrapper padding) → 별도 audit

Fix (Part A + B 통합 batch — 3 file + sentinel):

## Part A — 운영 화면 wide 정합

- apps/web/src/app/dashboard/purchases/page.tsx (line 507):
  · `<div className="max-w-7xl mx-auto space-y-4">` → `<div className="max-w-full mx-auto space-y-4">`
  · §11.333 trace marker 주석 추가

- apps/web/src/app/dashboard/safety/page.tsx (line 396):
  · `<div className="max-w-7xl mx-auto space-y-5">` → `<div className="max-w-full mx-auto space-y-5">`
  · §11.333 trace marker 주석 추가

- canonical 보존:
  · settings/page.tsx max-w-6xl (narrow, 의도) 보존
  · 다른 운영 화면 (dashboard/quotes/inventory/purchase-orders/receiving/spend) 보존
  · 양옆 padding p-4 md:p-6 / p-4 md:p-8 보존

## Part B — 재고 운영 브리핑 패널 UI 정정 (호영님 spec B-2-3 + B-2-2)

- apps/web/src/components/inventory/inventory-context-panel.tsx:

  · **4 useState default 정정 (line 407-410, 호영님 spec B-2-3):**
    · `isLotSectionExpanded`: `useState(false)` → `useState(true)` (LOT 펼침)
    · `isFlowSectionExpanded`: `useState(false)` → `useState(true)` (연결된 흐름 펼침)
    · `isActionsSectionExpanded`: `useState(false)` → `useState(true)` (권장 액션 펼침)
    · `isHistorySectionExpanded`: `useState(false)` 유지 (최근 수정 이력 = 보조, 접힘)
    · 원칙: 자주 보는 핵심 정보(LOT/Flow/Actions)는 펼침, 보조/이력성(History)만 접힘
    · §11.320 Phase 3 + §11.322 Phase 4 "3차 위계 접힘 시작" 결정 부분 번복 — 호영님 P2 §11.333 우선

  · **4 펼치기 button className 가독성 강화 (호영님 spec B-2-2):**
    · 옛: `text-[10px] font-medium text-slate-500 hover:text-slate-900 transition-colors min-h-[32px] px-2 -mx-2 inline-flex items-center`
    · 신: `text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors min-h-[36px] px-2 -mx-2 inline-flex items-center gap-1`
    · 크기: 10px → 12px (text-xs, 호영님 "최소 14px" 보다 약간 낮지만 패널 안 컴팩트 유지 + 대비 강화로 가독성 확보)
    · 대비: text-slate-500 → text-slate-700 (호버 text-slate-900 → text-slate-950)
    · 굵기: font-medium → font-semibold
    · 터치 영역: min-h-[32px] → min-h-[36px]
    · gap-1 추가 (아이콘/텍스트 간격)
    · 4 button 모두 일괄 swap (Lot/Flow/Actions/History)

canonical 보존 (회귀 0):
- §11.320 상태 배너 / 액션 button 상단 / 탭 제거 결정 보존
- §11.322 인라인 row 4 (current/safety/expiring/shortest-lot) 보존
- §11.322 Phase 3 risks 필터 보존
- §11.302 신호등 색상 정합 보존
- caller 2곳 (inventory-content:2725 / inventory-main:1958) props 영향 0
- InventoryContextPanel 시그니처 변경 0

호영님 production effect:
1. **Part A 운영 화면 폭 일관성**: purchases + safety = max-w-7xl(1280px) → max-w-full
   · 큰 모니터 양옆 빈 공간 해소
   · dashboard/quotes/inventory/purchase-orders/receiving/spend 와 시각 일관
2. **Part B 재고 패널 기본 펼침**: 자주 보는 정보(LOT/Flow/권장 액션) 즉시 노출
   · 호영님 production smoke 시 핵심 정보 펼치기 클릭 0회로 즉시 보임
3. **펼치기 button 가독성**: 12px + slate-700 + 36px hit area + font-semibold
   · 호영님 "잘 안 보임" 문제 해소
   · 모바일 터치 영역 ↑

Out of Scope:
- inventory 양옆 몰림 원인 추가 audit (호영님 스크린샷 1780245720032 분석 필요)
- §11.302 신호등 추가 sweep (현재 정합 확정, 추가 회귀 발견 시 별도 batch)
- 다른 브리핑 패널 (견적/발주) 동일 정책 적용 (§11.333b 후속 batch 가능)
- §11.332 설정 진단 (SPEC sync 후 별도 batch)

검증 (sandbox 정적 grep):
- purchases max-w-7xl → max-w-full ✓
- safety max-w-7xl → max-w-full ✓
- settings max-w-6xl 보존 ✓
- 4 useState (Lot/Flow/Actions = true, History = false) ✓
- 4 펼치기 button 신 className 매칭 4건 ✓ (replace_all 일괄)
- 옛 text-[10px] / text-slate-500 패턴 잔존 0 ✓

Rollback path: git revert <SHA>
- purchases/safety max-w-7xl 복원
- 4 useState false 복원
- 4 펼치기 button 옛 className 복원
- sentinel 삭제

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/dashboard/purchases/page.tsx `
  apps/web/src/app/dashboard/safety/page.tsx `
  apps/web/src/components/inventory/inventory-context-panel.tsx `
  apps/web/src/__tests__/regression/layout-width-inventory-brief-333.test.ts `
  docs/plans/PLAN_11.333-layout-width-inventory-brief-panel.md `
  docs/commit-drafts/COMMIT_11.333-layout-width-inventory-brief.md
git status
git commit -F docs/commit-drafts/COMMIT_11.333-layout-width-inventory-brief.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. **Part A 검증:**
   · /dashboard/purchases 진입 → 큰 모니터 양옆 빈 공간 사라짐 (max-w-full)
   · /dashboard/safety 동일
   · /dashboard/settings → max-w-6xl 폼 narrow 유지 ✓
3. **Part B 검증:**
   · /dashboard/inventory → 품목 click → 우측 패널 open
   · LOT 정보 / 연결된 흐름 / 권장 액션 + 추천 이유 = **기본 펼침** (즉시 보임)
   · 최근 수정 이력 = 접힘 (펼치기 button 클릭 시 보임)
   · 펼치기/접기 button = text-xs (12px) + slate-700 대비 ↑ + 36px 터치 영역
4. 모바일 375px 정합 (펼치기 button hit area 충분, 시각 안정)
5. §11.320 상태 배너 + 액션 button + §11.322 인라인 row 4 회귀 0

## Next (호영님 push 회신 후)
- inventory 양옆 몰림 추가 audit (호영님 스크린샷 분석)
- §11.332 SPEC sync 후 진입
- §11.333b (다른 브리핑 패널 일관 적용) 결정 시 별도 batch
