# COMMIT — §11.361-2: 재고 필터 빈상태 fake empty 정합 (Critical)

```
fix(inventory) §11.361-2 #filter-empty-state — 필터/검색 결과 0건을 "전역 재고 없음"으로 위장하던 fake empty 제거 (조건 빈상태 + 필터 초기화 분기)
```

## 무엇 (§11.361 Critical 2 — canonical truth 위반/fake empty)
- Phase 0 확정: 재고 리스트 빈상태가 **검색어만 분기, 필터(status/category) 미분기** → filter=lot_issue 등 결과 0건인데 "등록된 재고가 없습니다/첫 재고 추가" 전역 빈상태로 표기 = **품목이 있는데 "아예 없다" 거짓.**

## Fix (file별)
- **RN `apps/mobile/app/(tabs)/inventory.tsx`** (CEO 화면): `ListEmptyComponent` 분기 — `search || statusFilter!=="ALL"` 시 "조건에 맞는 재고가 없습니다" + **[필터 초기화]**(setSearch("")+setStatusFilter("ALL")). 진짜 0건일 때만 "재고 품목이 없습니다 · 웹에서 등록".
- **RN `components/EmptyState.tsx`**: `actionLabel?`/`onAction?` 추가(ErrorState.onRetry 패턴) — 필터 초기화 CTA 재사용 가능.
- **웹 `apps/web/.../inventory-main.tsx`** DataTable emptyMessage: **검색 > 필터(activeFilterCount>0) > 진짜0건** 3분기. 필터 활성 시 "이 조건에 맞는 재고가 없습니다" + "필터 초기화"(location/status/category 모두 reset). 기존 검색·첫재고 분기 보존.

## 제약 준수
- canonical truth: 필터 결과 0 ≠ 데이터 없음 — 정직 표기. fake empty 제거.
- 외부영향 0(UI state). 도메인 결정 불요.

## 검증
- 웹 sentinel `inventory-filter-empty-state-361.test.ts` 작성(검색/필터/진짜0건 3분기 + 필터초기화 reset). ⚠️ **sandbox node_modules 재활용 소실로 vitest 실행 불가 → Claude Code 에서 `npm run test` 실행 필요.**
- RN: test 러너 없음 → grep 검증(분기 4매치 + EmptyState actionLabel).

## Out of Scope
- §11.361-1(대시보드 truth 충돌): 하드코딩 0 아님 — scope/session 디스앰비그 필요(별도). §11.361-3(0-state CTA weight)·4(raw label)·5(FAB §11.359)·6(랜딩 reveal): 정합/무해 묶음.

## Rollback
- 3파일(RN inventory/EmptyState, web inventory-main) + sentinel revert. 독립.
```
footer 없음
```
