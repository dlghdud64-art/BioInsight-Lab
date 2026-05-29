refactor(inventory): §11.321 #inventory-tab-segmented-control — 재고 탭 세그먼트 컨트롤 스타일 (호영님 P1 구 §11.316, 2026-05-29)

호영님 P1 (구 §11.316, 번호 충돌로 §11.321 매핑) — 재고 관리 탭 시각 강화.

배경:
- 재고 관리 탭 4개(품목 관리 / 운영 현황 / 보관 위치 / 입출고 흐름)가 회색 텍스트 + 파란
  하단 인디케이터 bar 만으로 표시 → 시각 비중 매우 약함, 다른 뷰 존재 인지 못 함.
- §11.317 으로 헤더가 simplify 된 직후 surface 라 탭 시각 강화가 자연스러운 후속.

Fix (single-file batch, inventory-content.tsx 탭 영역만):

- apps/web/src/app/dashboard/inventory/inventory-content.tsx (탭 영역 line 1670~):
  · 컨테이너 className: `flex items-center gap-0.5 border-b border-slate-200 mb-4` →
    `flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-4` (세그먼트 박스)
  · data-testid="dashboard-inventory-tab-segmented" 추가
  · 활성 tab className: `text-blue-600` →
    `bg-white text-slate-900 shadow-sm font-semibold` (활성 흰 배경 + shadow)
  · 비활성 tab className: `text-slate-400 hover:text-slate-600` →
    `bg-transparent text-gray-600 hover:bg-gray-200` (호버 배경)
  · 각 button 에 flex-1 (모바일 + 데스크탑 균등 분할)
  · 아이콘 w-3.5 h-3.5 → **w-5 h-5** (16px → 20px, 변별력 증가)
  · 아이콘 색: 활성=text-blue-600 / 비활성=text-gray-500
  · suffix("S") 색: 활성=text-blue-600 / 비활성=text-gray-500
  · 하단 인디케이터 bar 제거 (`<span absolute bottom-0...bg-blue-600 />` 삭제 — 흰 배경이 대체)
  · "현재 화면" 배지 제거 (`labaxis-inventory-manage-current-reason` testid + 텍스트 모두 삭제)
  · transition: `transition-colors` → `transition-all duration-150` (부드러운 흰 배경 이동)
  · `isActive` 변수 추출 (가독성)

canonical 보존 (회귀 0):
- 4 탭 key (manage / overview / storage-location / flow) 보존
- aria-current="page" 활성 / aria-disabled / disabled / title 보존
- min-h-[44px] WCAG SC 2.5.5 / Apple HIG / Material touch target 보존
- testid 보존 (labaxis-inventory-overview-tab / manage-tab)
- badge rose-500 (issuesCount) + suffix "S" 보존
- showLotIssueDecisionStrip 분기 + handleLotIssueDecisionAction onClick wiring 보존
- Tabs/TabsContent wrapper 보존

호영님 production effect:
1. 재고 관리 진입 시 탭 영역이 회색 세그먼트 박스로 시각 강조 — 다른 뷰 존재 즉시 인지.
2. 활성 탭이 흰 배경 + shadow 로 명확히 떠 보임 (옛 하단 인디케이터 1pt 보다 강함).
3. 아이콘 변별력 ↑ (w-3.5 → w-5).
4. 모바일 4 탭 균등 분할(flex-1) — 폭 차이 없음.
5. "현재 화면" 배지 redundant → 제거로 시각 단순화.
6. 4 탭 동작/wiring/aria 모두 보존 — 회귀 0.

- apps/web/src/__tests__/regression/
  inventory-tab-segmented-control-321.test.ts (NEW, ~9 it):
  · 컨테이너 testid + bg-gray-100 rounded-lg p-1
  · 활성/비활성 className 분기
  · 아이콘 w-5 h-5 4 탭 모두
  · 옛 인디케이터 bar / "현재 화면" 배지 0 (회귀 가드)
  · canonical: 4 key + aria + testid + WCAG + showLotIssueDecisionStrip 분기
  · flex-1 균등 분할 + badge rose-500 + suffix 보존

Out of Scope (⚠️ 본 batch 미포함, 후속 가능):
- 공통 컴포넌트 `<SegmentedTabs>` 추출 (호영님 spec §5 "디자인 시스템화 가능" — §11.321-b 후속 가능)
- 다른 화면(견적/입고/구매 운영) 동일 패턴 적용 (§11.321-c~)
- URL 쿼리 파라미터로 탭 상태 유지 (호영님 spec §3-3 — 현재 useState 만, 새로고침 시 manage 로 복원)

검증 (sandbox 정적 grep):
- 컨테이너 testid + bg-gray-100 ✓ (1건)
- 활성/비활성 className 2 분기 ✓
- 아이콘 w-5 h-5 4 탭 ✓
- 옛 인디케이터 + "현재 화면" 배지 0 ✓
- canonical 단언 11 건 매칭 ✓

Rollback path: git revert <SHA>
- 옛 border-b + text-blue-600 + 하단 인디케이터 + "현재 화면" 배지 복원 (단일 file)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/app/dashboard/inventory/inventory-content.tsx `
  apps/web/src/__tests__/regression/inventory-tab-segmented-control-321.test.ts `
  docs/commit-drafts/COMMIT_11.321-inventory-tab-segmented.md
git status
git commit -F docs/commit-drafts/COMMIT_11.321-inventory-tab-segmented.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory 진입 → 탭 영역이 회색 세그먼트 박스 + 활성 탭(품목 관리) 흰 배경 + shadow 노출
3. 아이콘 4 탭 모두 20px (이전 16px) 변별력 확인
4. 비활성 탭 hover → bg-gray-200 적용
5. 다른 탭(운영 현황/보관 위치/입출고 흐름) 클릭 → 활성 흰 배경 이동(transition 150ms)
6. "현재 화면" 배지 사라짐 확인 (활성 흰 배경이 충분 명시)
7. 모바일 375px: 4 탭 균등(flex-1) + 라벨 + 아이콘 정상 표시
8. badge(N건) + suffix("S") rose-500 + blue 톤 보존
9. showLotIssueDecisionStrip ON 시 overview 탭 → "폐기 검토" 라벨 + 클릭 시 handleLotIssueDecisionAction 동작

## Next (호영님 push 회신 후)
- §11.319 (구 §11.314): 시약 라벨 스캔 정보 조회 + 가이드 프레임
- §11.320 (구 §11.315): 재고 상세 우측 패널 재구성
- §11.321-b (선택): 공통 `<SegmentedTabs>` 컴포넌트 추출 + 다른 화면 적용
