# §11.294 Commit Message Draft (호영님 P2 1단계 — 데스크탑 필터 단순화)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(workbench): §11.294 #sourcing-filter-row-dropdown — 소싱 검색 필터 3 row → 1 row dropdown 단순화 (호영님 P2 1단계 데스크탑)

호영님 P2 spec (2026-05-24):
데스크탑 검색 결과 필터 3 row (카테고리/가격대/제조사) → 1 row +
3 dropdown 단순화.

근거:
1. 3줄 세로 적층 = 공간 과다 (~80px 회수)
2. "전체 / 전체 가격 / 전체 제조사" label 어색 (미선택 = 전체,
   별도 버튼 불필요)
3. 기본 상태인데 파란색 (혼란)

호영님 단계적 진행:
- 1단계 (이번): 데스크탑 한 줄 dropdown (single select)
- 2단계 (별도 batch): 모바일 필터 시트 + 다중 선택

Fix (1 file 156 line → ~165 line swap, minimum-diff):

- apps/web/src/app/_workbench/search/page.tsx:
  · filterDropdownOpen useState 추가
    ("category" | "price" | "vendor" | null) — 3 dropdown
    mutually exclusive
  · 기존 §11.258b 카테고리 row (line 1044-1102, 58 line) +
    §11.258d-1 가격대 row (line 1104-1162, 58 line) +
    §11.258d-2 제조사 row (line 1164-1203, 40 line) 통째 제거
  · 1 row + 3 plain dropdown swap:
    - <div className="hidden md:flex"> wrapper
    - 카테고리 dropdown (REAGENT/TOOL/EQUIPMENT 3 option)
    - 가격대 dropdown (~5만/5~20만/20만~ 3 option)
    - 제조사 dropdown (vendorFacets > 0 시만, top 20 노출)
  · 각 dropdown:
    - <button> (selected 시 bg-blue-50 text-blue-700
      border-blue-300 + ✕ 해제, 미선택 시 회색 + ChevronDown)
    - 조건부 backdrop (fixed inset-0 외부 click close)
    - <div role="menu"> option list
  · ChevronDown lucide-react import 추가
  · §11.283b plain button + useState pattern 정합 (Radix 의존성 0)

- apps/web/src/__tests__/regression/sourcing-filter-row-dropdown-294.test.ts
  (NEW, 11 it):
  · §11.294 trace + filterDropdownOpen state
  · 3 dropdown testid (category/price/vendor)
  · 기존 3 chip testid 잔존 0
  · "전체/전체 가격/전체 제조사" label 잔존 0
  · dropdown 기본 label 분기
  · ✕ 해제 button aria-label
  · backdrop close
  · 색상 분기 (선택 = 파란, 미선택 = 회색)
  · hidden md:flex 데스크탑 한정
  · state setter 보존
  · ChevronDown import

canonical truth 보존 (회귀 0):
- setSearchCategory / setMinPrice / setMaxPrice / setSearchBrand
  state setter — useQuery key 정합 변경 0 (server fetch 보존)
- searchCategory / minPrice / maxPrice / searchBrand state 변경 0
- PRODUCT_CATEGORIES constant 사용 보존
- vendorFacets server facets 보존 (top 20 노출 확장, 기존 top 5)
- activeFilterCount 정합 보존
- 모바일 §11.263b unified row 영향 0 (hidden md:flex 데스크탑 한정)
- 상단 toolbar (정렬/필터/AI분석/재고) 영향 0
- §11.283b 햄버거 plain button 보존

호영님 production effect (Vercel READY 후):
1. 데스크탑 검색 결과 → 필터 3 row → 1 row + 3 dropdown
   (~80px 화면 회수)
2. 미선택 시 dropdown label = "카테고리/가격대/제조사" (회색)
3. dropdown click → option list → 선택 → label 변경 + 파란색 +
   ✕ 해제 button
4. ✕ click → 즉시 reset → 회색 + 기본 label
5. 외부 click → dropdown close
6. 모바일 (md 미만) 기존 §11.263b unified row 그대로

Out of Scope (호영님 spec 2단계 별도 batch):
- 모바일 필터 시트 (바텀시트 + 적용 필터 수 배지)
- 다중 선택 ("시약 외 2 ✕")
- 가격대 사용자 정의 범위 입력
- 제조사 search filter (dropdown 안)

Rollback path: git revert <SHA>
- 1 file ~165 line 제거 + 156 line 복원 + sentinel test 삭제
- 3 row 회귀

Lessons:
1. filter UI "전체" label 제거 가치 — 미선택 = 전체, 별도
   버튼 불필요. UX cleanliness ↑
2. 선택 시만 파란색 원칙 — 미선택 회색 outline 으로 혼란 회피
3. §11.283b plain dropdown pattern 재사용 — Radix 의존성 0,
   호영님 환경 silent fail 위험 0
4. filterDropdownOpen 단일 state — 3 dropdown mutually exclusive,
   discriminated union 으로 type-safe
5. vendorFacets 노출 확장 (top 5 → top 20) — dropdown scroll
   area max-h-80 으로 공간 활용
6. Karpathy minimum-diff — 1 file 156 line swap + 1 NEW test (11).
   server contract / state setter 변경 0
```

## Files to stage

```
apps/web/src/app/_workbench/search/page.tsx
apps/web/src/__tests__/regression/sourcing-filter-row-dropdown-294.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.294-sourcing-filter-row-dropdown.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

pnpm vitest run apps/web/src/__tests__/regression/sourcing-filter-row-dropdown-294.test.ts

git add apps/web/src/app/_workbench/search/page.tsx \
        apps/web/src/__tests__/regression/sourcing-filter-row-dropdown-294.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.294-sourcing-filter-row-dropdown.md

git commit -F docs/commit-drafts/COMMIT_11.294-sourcing-filter-row-dropdown.md
git push origin main
```

## Production smoke (Vercel READY 후, 데스크탑)

1. labaxis.co.kr/app/search Cmd+Shift+R (검색어 입력)
2. **필터 영역 1 row** 확인 — `[카테고리 ▾] [가격대 ▾] [제조사 ▾]`
3. 미선택 시 회색 outline + ChevronDown 화살표
4. [카테고리] click → option dropdown (시약/기구/장비) 표시
5. [시약] 선택 → button label "시약" + 파란색 (bg-blue-50 text-blue-700) + ✕ 해제
6. ✕ click → 즉시 회색 + "카테고리" 복귀
7. 외부 click → dropdown close
8. 가격대 / 제조사 dropdown 동일 동작
9. 모바일 (md 미만) 영향 0 — 기존 §11.263b unified row 그대로

## 2단계 후보 (별도 batch, 호영님 결정)

- 모바일 필터 시트 (바텀시트 + 적용 필터 수 배지)
- 다중 선택 ("시약 외 2 ✕")
- 가격대 사용자 정의 범위
- 제조사 search filter (dropdown 안)
