# §11.313 Commit Message Draft (대시보드 지출트렌드/카테고리비중 카드 높이 정합)

```
fix(dashboard): §11.313 #dashboard-card-height-align — 지출 트렌드 / 카테고리별 비중 카드 높이 정합 (items-stretch + h-full + flex-1) (호영님 P2 UI Polish, 2026-05-27)

호영님 P2 spec (지시문 §11.307 명명 — task #65 "견적 관리 모바일"
충돌로 §11.313 부여, §11.310~312 패턴 정합):
대시보드 "지출 트렌드 분석"(좌, col-span-2, 큼) + "카테고리별 비중"
(우, col-span-1, 짧음) 나란히 배치인데 높이 불일치 → 카테고리 카드
하단 빈 공간 발생.

fix: grid items-stretch + 카테고리 카드 h-full + 내부 flex-1 세로 균등.
스크린샷: 1779878300531_image.png

Fix (2 file 수정 + 1 NEW sentinel):

- apps/web/src/app/dashboard/page.tsx:
  · desktop grid (line 746): hidden lg:grid lg:grid-cols-3 gap-4
    → + items-stretch (두 cell 높이 정합)
  · CategoryDistributionCard 에 className="h-full" 전달
    (셀 = SpendTrend 높이 채움)
  · §11.313 주석 추가

- apps/web/src/components/dashboard/category-distribution-card.tsx:
  · CategoryDistributionCardProps 에 className?: string 추가
  · 함수 시그니처 { categorySpending, className } destructure
  · root div: flex flex-col + ${className ?? ""} 병합
    (h-full 수용 → 헤더 고정 + 차트 영역 flex-1 세로 채움)
  · non-empty 차트 영역 grid: + flex-1 (세로 균등 배치)
  · empty 차트 영역 grid: + flex-1 (mockup 도 동일 정합)

- apps/web/src/__tests__/regression/
  dashboard-card-height-align-313.test.ts (NEW, ~12 it):
  · page grid 3 it (items-stretch / className h-full / col-span 보존)
  · card 높이 4 it (className prop / flex flex-col 병합 / non-empty
    flex-1 / empty flex-1)
  · 회귀 0 5 it (도넛 차트 보존 / 모바일 탭 전환 / dynamic_import /
    empty mockup overlay)

canonical truth 보존 (회귀 0):
- SpendTrendCard / CategoryDistributionCard import / props / dynamic_import 보존
- §11.252b 모바일 탭 전환 (trend / category) 보존 — 모바일은 탭이라 1개씩
  노출, 높이 정합 무관 (className 미전달 분기 유지)
- 데스크탑 lg:grid-cols-3 + col-span-2/1 layout 보존
- §11.243b empty mockup overlay 보존
- 도넛 차트 (PieChart innerRadius 42 / CATEGORY_COLORS) 변경 0
- 차트 색상 hex (#f59e0b 등) — Tailwind class 아님, §11.302 sweep 무관 보존

호영님 production effect:
1. labaxis.co.kr/dashboard (데스크탑 lg+):
   - "지출 트렌드 분석"(좌) + "카테고리별 비중"(우) 하단 라인 일치
   - 카테고리 카드 도넛+범례가 세로 균등 배치 (상단 빈 공간 해소)
2. 모바일 (375px): 탭 전환 유지 — 세로 스택 아니므로 깨짐 0
3. 1280 / 1440 / 1920px 모두 grid items-stretch 로 자동 정합

완료 기준 (호영님 §7) 충족:
- ✅ 두 카드 하단 라인 일치 (items-stretch + h-full)
- ✅ 카테고리 카드 내부 세로 균등 배치 (flex-1, 상단 빈 공간 0)
- ✅ 1280/1440/1920px 정합 (grid stretch 반응형)
- ✅ 모바일 375px 깨짐 0 (탭 전환 유지)

Out of Scope:
- SpendTrendCard 내부 레이아웃 (기준 높이라 변경 불필요)
- §11.302d-6b amber sweep (진행 중 — 본 P2 후 재개)

Rollback path: git revert <SHA>
- 2 file (page grid + card) 복원 + 1 sentinel 삭제
- 사용자 영향: 카테고리 카드 하단 빈 공간 재발 (시각만, 기능 0)
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/dashboard/page.tsx `
  apps/web/src/components/dashboard/category-distribution-card.tsx `
  apps/web/src/__tests__/regression/dashboard-card-height-align-313.test.ts `
  docs/commit-drafts/COMMIT_11.313-dashboard-card-height.md

git status   # modified: 2 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.313-dashboard-card-height.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr/dashboard (데스크탑 1280/1440/1920px):
   - "지출 트렌드 분석" + "카테고리별 비중" 카드 하단 라인 일치
   - 카테고리 카드 도넛+범례 세로 중앙/균등 (상단 빈 공간 0)
3. 모바일 375px: 트렌드/카테고리 탭 전환 정상, 깨짐 0
4. 빈 데이터 상태 (mockup overlay) 도 높이 정합 확인
```
