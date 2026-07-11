# #reports-filter-redesign — 구매 리포트 필터 5→2컨트롤 접기 (시안 §1)

- **Status:** ✅ sandbox 완료 (operator build+vitest+push + 육안 스모크 대기)
- **Date:** 2026-07-11
- **입력:** 구매 리포트 필터 구현 지시문.md + 리디자인.html(시안). 승인: 호영님 2026-07-11 (+4 가드).

## Truth Reconciliation
- **이미 반영(무접촉):** §2 데이터 뷰(리스크 배너·4 KPI 스파크라인·카테고리/벤더/월별 차트·상세 테이블·budgetUsage, 전부 canonical `/api/reports/purchase`)·§3 딥링크 3개(카테고리→purchases L744·벤더→search L778·월별→purchases L850, plain href·가짜 프리필 0 — purchases는 파라미터 미수용이라 정직).
- **실 델타 = §1 필터 바뿐:** 5필터 인라인 Select `lg:grid-cols-5` 한 줄 = 넘침 문제.

## 변경 (2파일)
`reports/page.tsx`:
- 기간 **프리셋 세그먼트**(최근7일/30일/분기/올해, `applyPreset`→start/endDate + `activePreset`) + 커스텀 pill(`DateRangePicker` onDateChange 시 `setActivePreset(null)` — 세그먼트 active 해제, 가드2).
- 카테고리·팀·벤더·예산 4 Select → **Popover 접기** + `필터 (n)` 개수 배지(=적용된 필터 수, 가드4).
- **활성 칩**(`activeFilters`=value≠"all"만, `chips:empty` 숨김) — 칩 ✕ → `f.set("all")` 상태 초기화 → 쿼리 재실행(가드1) + `전체 해제`.
- 컨테이너 `relative`(모바일 오버레이 튀어나옴 방지, 가드3).
- **무접촉:** selectedCategory/Team/Vendor/Budget + start/endDate 상태·쿼리 파라미터(params.append)·4 Select 옵션·데이터 파생 그대로.
- 신규 sentinel `reports-filter-redesign.test.ts`.

## 가드 이행 (호영님 4)
1. 칩↔상태 동기화 — 칩 ✕ = `f.set("all")`(실 상태 setter) → useQuery key 변경 → 재실행. ✅
2. 프리셋↔커스텀 — 프리셋=start/endDate 세팅+activePreset, 커스텀=setActivePreset(null). ✅
3. 부모 `relative`. ✅
4. 개수 배지 = `activeFilterCount`(비어있지 않은 필터 수) 정확 일치. ✅

## 스코프 노트 (딥링크 정직성)
- §3 딥링크는 이미 존재·정직(purchases plain, search는 q 수용). 추가 없음.
- ⚠️ **모바일 = Popover 사용(별도 바텀시트 아님).** 시안은 모바일 바텀시트 제시. Radix Popover가 모바일서도 접기+무넘침을 충족하므로 단일 구현 채택(리스크·diff 최소). 부모 relative는 향후 Sheet 전환 대비 유지. 리터럴 바텀시트 원하면 후속.

## 검증 (sandbox)
- page.tsx·sentinel 구문 0, 꼬리 정상. sentinel 전항목 PASS(프리셋·팝오버·칩·개수배지·구 grid 제거 + 무접촉 보존 4).

## operator 게이트
```
git add apps/web/src/app/dashboard/reports/page.tsx \
        apps/web/src/__tests__/regression/reports-filter-redesign.test.ts \
        docs/plans/PLAN_reports-filter-redesign.md
tail -2 apps/web/src/app/dashboard/reports/page.tsx   # } 정상
cd apps/web && npm run build && npx vitest run
# 판정: build 0 · reports-filter-redesign GREEN · baseline-delta 0
# 커밋 → push
```
**배포 후 육안:** 좁은 창/모바일에서 필터 바 한 줄 유지(넘침 0) · 프리셋 탭·커스텀 기간 active 정합 · 필터 팝오버 4종 + 배지 · 칩 ✕ 시 리스트 재조회 · 데이터 있음/없음 뷰 정상.

## Rollback
단일 커밋 revert(필터 바 국소, 데이터/쿼리 로직 무접촉).
