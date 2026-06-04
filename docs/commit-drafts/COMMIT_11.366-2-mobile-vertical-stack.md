# COMMIT — §11.366 Phase 2 (D-8): 재고 상세 모바일 세로 스택

```
fix(inventory) §11.366 D-8 #detail-vertical-stack — 재고 상세 기본/관리 정보 grid를 모바일 세로 스택(grid-cols-1 sm:grid-cols-2)으로 — 가로 욱여넣기·값 잘림 0
```

## 무엇 (§11.366 D-8 Phase 2 — 호영님 P1)
- 상세 Sheet 기본/관리 정보 grid가 `grid-cols-2` 고정 → 모바일(90vw drawer)에서 라벨+값 2칸 욱여넣기 = 값 truncate.
- D-8 수용기준: 가로 스크롤 0 + 전 필드 세로 도달.

## 결정 (§11.364 패턴 — 수용기준 우선, 과적용 금지)
- **수용기준 충족 = grid 세로 스택**(라벨+값 잘림 위험 grid 2곳: 기본 정보·관리 정보 → `grid-cols-1 sm:grid-cols-2`).
- **side="bottom" 반응형 분기는 미적용**(과적용 회피): isMobile 훅 신규 도입 + Sheet 동작 변경 = 회귀 표면. 현 right drawer `w-[90vw]`가 모바일 거의 전체 폭 + overflow-y-auto 세로 스크롤이라 기능 충분. bottom 형태는 형태 선호이지 수용기준 아님.
- 현재고/안전재고·Lot/유효기한 카드는 짧은 숫자값 → 2칸 유지(잘림 0, 가로 스크롤 0).

## Fix (`inventory-main.tsx`)
- 기본 정보·관리 정보 grid 2곳: `grid grid-cols-2 gap-x-3 ...` → `grid grid-cols-1 sm:grid-cols-2 gap-x-3 ...`.
- 모바일 = 필드 세로 1열(잘림 0), 데스크탑(sm+) = 2칸 유지.

## canonical truth
- 표시 레이아웃만. 데이터/필드 변경 0.

## 검증
- sentinel `inventory-detail-fields-366`(Phase 2 describe 추가): grid-cols-1 sm:grid-cols-2 2곳 + 고정 grid-cols-2 gap-x-3 부재. ⚠️ vitest = Claude Code.
- L3097 `overflow-x-auto` = "사용 이력" Table(별도 카드) — 마스터 필드 영역 아님(D-8 가로 스크롤 0 무관).
- 배포 후 Chrome 375px: 상세 필드 세로 도달, 가로 스크롤 0.

## Out of Scope
- Phase 3: G-3 내부키 export+상세 정리. Phase 4: smoke. side="bottom" 형태 전환은 별도(필요 시).

## Rollback
- grid className 2곳 revert. 독립.
```
footer 없음
```
