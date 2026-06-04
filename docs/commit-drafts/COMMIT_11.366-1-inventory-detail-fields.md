# COMMIT — §11.366 Phase 1 (D-8): 재고 상세 마스터 필드 보강 (Web)

```
feat(inventory) §11.366 D-8 #detail-fields — 재고 상세 Sheet에 영문명·현재고·안전재고·보관위치·고유식별자(inv.id) 보강 (다운로드 없이 in-app 마스터 조회)
```

## 무엇 (§11.366 D-8 Phase 1 — 호영님 P1)
- 선결 진단: 행/카드 onClick = `setSelectedItem` + `setIsSheetOpen(true)` → 상세 Sheet 오픈(no-op 아님) → **"필드 보강"**.
- 현 상세 Sheet 보유: 품명·브랜드·Cat.No·Lot번호·유효기간·구매처·배송기간·보관조건·특이사항·단위.
- **누락(조회에 다운로드 강요 원인)**: 영문명·현재고·안전재고·보관위치·고유식별자.

## Phase 0 도메인 결정 (호영님)
- **CAS**: Prisma 전용 컬럼 부재 → **이번 범위 제외**(스키마 그대로, migration 0).
- **고유바코드**: 전용 컬럼 부재 → **inv.id(cuid) 표시**(§11.355-B 라벨 QR 인코딩과 정합, 신규 컬럼 0).

## Fix (`inventory-main.tsx` 상세 Sheet, drawerMode "view")
- 헤더: 품명 아래 **영문명(nameEn)** 보강(값 있을 때만, `product` include라 데이터 존재).
- 상단 강조 grid: **현재고(currentQuantity)** + **안전재고(safetyStock)** — 기존 표시 부재였던 조회 핵심.
- 기본 정보 grid: **보관위치(location)** + **고유 식별자(inv.id)** 추가.
- Lot 목록: 기존 **입고 이력 토글**(restock-history query) 활용(기존 "Lot N개 보기" 흡수).
- 값 없으면 "-"(fake 0 금지). 현재고/위치/id = selectedItem 읽기(mutation 0). 안전재고 입력은 기존 mutation 보존.

## canonical truth
- ProductInventory + product(include) projection 표시만. 조회 필드 persistence 변경 0.

## 검증
- sentinel `inventory-detail-fields-366`: 트리거(no-op 0)·영문명·현재고/안전재고·보관위치·inv.id + 회귀(기존 필드·입고이력 Lot). 전 정규식 OK. ⚠️ vitest = Claude Code.
- product `include`(select 아님) → nameEn 등 스칼라 데이터 채워짐(API route.ts L128 확인).
- 배포 후 Chrome: 행/카드 탭 → 상세에 다운로드 없이 마스터 필드 조회.

## Out of Scope (후속 phase)
- Phase 2: 모바일 bottom sheet 세로 스택(가로 스크롤 0). Phase 3: G-3 내부키(`inv-pilot-*`) export+상세 정리. Phase 4: smoke.
- CAS 컬럼 추가 = 별도 batch.

## Rollback
- 보강 5필드(영문명/현재고/안전재고/보관위치/inv.id) Edit 3곳 revert + sentinel 삭제. 독립.
```
footer 없음
```
