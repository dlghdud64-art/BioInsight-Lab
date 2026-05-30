feat(inventory): §11.326 Phase 3 — 라벨 packSize vs 입고수량 분리 데스크톱 UI (호영님 P0, 2026-05-30)

- LabelScannerModal: 품목 정보/입고 정보 섹션 분리, 규격(통 1개 함량) + 받은 통 개수(기본1) + 총함량 표시(mapLabelToReceiving).
- inventory-content onDirectReceive: currentQuantity=받은 통 개수(라벨값 제거), packSize/packUnit Product 마스터 영속화.
- /api/inventory: body packSize/packUnit + product.create 영속화.
- RED sentinel(7cb3aac9) GREEN 전환. 모바일=Phase B.
