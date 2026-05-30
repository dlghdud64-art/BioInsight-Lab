# Implementation Plan: §11.326 스마트 입고 데이터 모델 분리 (라벨 용량 vs 입고 수량)

- **Status:** ⏳ Pending (Phase 0 확정, Phase 1 RED 진입)
- **Started:** 2026-05-30 · **Last Updated:** 2026-05-30
- **Priority:** P0 데이터 무결성 · **Effort:** 4~6h+α · **모델:** 마이그레이션 포함 → Opus 4.8
- **순서:** §11.326(A 데스크톱) → §11.326(B 모바일) → §11.327 P2 → §11.318 1d-2. PDF 폰트는 별개 병행.

**CRITICAL**: phase 완료마다 체크박스/Last Updated/Notes 갱신, gate 통과 후 진행.
⛔ dead button·no-op·근거 없는 추천 금지 / 큰 파일은 Python·heredoc(Edit 툴 truncation 사고 이력) / **production 마이그레이션 = dry-run→평이한 보고→"진행" 후 apply**.

## 0. Truth Reconciliation
- **버그 root cause:** `LabelScannerModal.tsx:282` `quantity: data.parsed.quantity || "1"` + 모바일 `scan.tsx mapLabelToForm` — OCR 라벨 "100 CAPSULES"(통 1개 함량=규격)가 **입고 수량**으로 매핑 → 1통이 100개로 기록.
- **스키마:** `Product`에 `packSize`/`packUnit` **없음**(grep 0). `specification String?`만 존재. `_workbench`가 이미 `p.packSize` 읽음(undefined fallback) → 도입은 **선반영된 누락 보충**.
- **입고 수량 canonical:** `InventoryRestock.quantity Float`("입고 수량") + `unit String?`.
- **live 표면:** 데스크톱 = `LabelScannerModal`(global-modal `label_scanner` → `LabelScannerContent`, `inventory-content.tsx:1485 onDirectReceive` 영속화). **워크벤치 별도 입고 surface 없음**(scan-label 직접참조 0) → 표면 함정 없음.
- 모바일 = `scan.tsx`/`register.tsx`/`lot-receive.tsx`(§11.319 최근 push).

### Chosen Source of Truth
- 라벨 스캔 = 품목 식별(packSize 포함). 입고 수량 = 사용자/거래명세서. **둘 분리.**
- packSize/packUnit 우선, 없으면 specification fallback. **specification→packSize 자동 파싱 금지**(불완전 데이터 부풀림 = §1 재발).

## 1. Priority Fit — P0 (데이터 무결성, 누적성). §11.318 1d-2보다 선행.

## 2. Work Type — Bugfix + Migration + Web(then Mobile) + Data Model.

## 3. Overview
**Success Criteria:**
- [ ] OCR `quantity`/`unit` → `packSize`/`packUnit`(품목 정보)로 매핑. **입고 수량 ≠ 라벨 값.**
- [ ] 입고 수량 = 사용자 입력 "받은 통 개수", 기본값 1. 단위 "통/박스".
- [ ] 총 함량(received × packSize)은 **표시만**(영속화 X).
- [ ] `LabelScannerModal` UI: "품목 정보"/"입고 정보" 섹션 분리, "수량"→"규격(통 1개 함량)" + ⓘ, "받은 통 개수" 신규 + ⓘ.
- [ ] `Product.packSize Float? + packUnit String?` 신규 컬럼(NULL 허용). specification 유지(fallback).
- [ ] 기존 데이터: 자동 마이그레이션 X, 사용자 검증 알림(옵션 C) + 의심 데이터 탐지 보조.

**Out of Scope:** specification→packSize 자동 파싱(별도 batch 2-c) / 모바일(Phase B) / §11.310 1-flow(Phase B) / 총함량 영속화.

## 4. Product Constraints
- Preserve: workbench/queue/rail/dock, same-canvas(모달 내 섹션 분리, 신규 페이지 0), canonical truth(입고수량=InventoryRestock.quantity).
- Must not: 라벨 값을 입고 수량으로(=버그), 총함량 영속화(data drift), 자동 파싱 부풀림, dead button.

**Canonical Truth Boundary:**
- Source of Truth: `Product.packSize/packUnit`(품목), `InventoryRestock.quantity`(받은 통 개수).
- Derived(표시만): totalContent = received × packSize.
- Persistence: 품목 → Product, 입고 → InventoryRestock(quantity=통 개수, unit="통").

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| `mapLabelToReceiving` surface-agnostic 순수 함수 | 데스크톱/모바일 공유(§11.319 capture-quality 패턴, web 구현+모바일 복제+DUPLICATED 주석) | 어댑터 2 |
| packSize/packUnit 신규 컬럼(NULL) | 코드 선반영 + 구조화 총함량 계산 | 1회 마이그레이션 |
| 총함량 표시만 | data drift 방지 | 집계 시 계산 |
| 마이그레이션 2-a(컬럼만)/2-b(신규입고 채움)/2-c(파싱=별도, 안 함) 분리 | production 안전 | 기존 row NULL |

**Touched:** `prisma/schema.prisma`(Product +2컬럼), 신규 `lib/inventory/map-label-to-receiving.ts`, `LabelScannerModal.tsx`, `inventory-content.tsx`(onDirectReceive), (Phase B) mobile.

## 6. Test Strategy — 순수 함수 단위테스트(RED-Green) + 마이그레이션 dry-run + smoke. sandbox vitest 풀실행 불가 → 호영님 env.

## 7. Implementation Phases

### Phase 0: 표면/스키마 확정 — ✅ 완료
- [x] live 표면 = LabelScannerModal(데스크톱), 워크벤치 입고 surface 없음.
- [x] 스키마: packSize/packUnit 부재 확인 → ⓐ 신규 컬럼.
- [x] 받은수량 = InventoryRestock.quantity.

### Phase 1: 매핑 계약 (RED→GREEN, 2h) — surface-agnostic 순수 함수
- Status: [ ] Pending
- 🔴 RED: `lib/inventory/map-label-to-receiving.test.ts` — packSize=OCR quantity, packUnit=OCR unit, **receivedQuantity 기본 1(절대 라벨값 아님)**, receivedUnit "통", totalContent=received×packSize(packSize null이면 null), received 0/음수 입력→1 보정.
- 🟢 GREEN: `lib/inventory/map-label-to-receiving.ts` 구현.
- ✋ Gate: 단위테스트 GREEN, 라벨값→입고수량 매핑 0(버그 차단), 총함량 표시 계산만.
- Rollback: 신규 파일 revert.

### Phase 2: 스키마 마이그레이션 (production 승인 필요)
- Status: [x] 2-a 초안 생성 완료(sandbox). apply = 호영님 커밋·푸시 → Vercel 자동 migrate.
- 2-a: [x] `prisma/schema.prisma` Product에 `packSize Float?` + `packUnit String?` 추가(specification 아래, Python 원자적 삽입, 중괄호 658/658·2736줄·모델 110 무결) + `prisma/migrations/20260530120000_add_product_packsize_packunit/migration.sql`(ADD COLUMN NULL ×2). dry-run 보고 + 호영님 "진행" 승인 완료. **실제 apply는 Vercel prebuild(vercel-migrate.js) 자동.**
- 2-b: 신규 입고가 packSize/packUnit 채움(매핑 함수 경유). 기존 row NULL 유지.
- 2-c: specification→packSize 자동 파싱 **안 함**(별도 batch, 수동 보정 UI 의향 시).
- ✋ Gate: prisma generate, 마이그레이션 dry-run 보고, 기존 row 영향 0.

### Phase 3: 데스크톱 UI + 영속화 분리 (2~3h)
- Status: [ ] Pending
- 🔴 RED: `LabelScannerModal` sentinel — "품목 정보"/"입고 정보" 섹션, "규격(통 1개 함량)" + ⓘ, "받은 통 개수" 기본1 + ⓘ, 총함량 표시.
- 🟢 GREEN: 모달 폼 분리(packSize/packUnit vs receivedQuantity/receivedUnit) + `mapLabelToReceiving` 사용. `inventory-content.tsx onDirectReceive`가 **receivedQuantity를 InventoryRestock.quantity로**(라벨값 아님), packSize→Product. 큰 파일 Python/heredoc.
- ✋ Gate: 입고 수량=사용자 입력만, 라벨값 영속화 0, dead button 0, 회귀 0(기존 smart-receiving 테스트).
- Rollback: 모달/onDirectReceive revert.

### Phase 4: 기존 데이터 알림 + smoke (1~2h)
- Status: [ ] Pending
- 옵션 C: 재고/대시보드 상단 1회성 배너 "입고 방식 개선 + [재고 검토하기]"(닫기 가능). 의심 데이터 탐지 보조(receivedQuantity 비정상 라운드값+라벨 일치 → 검토 우선, 자동 수정 X). smoke + closeout.

### Phase B (후속 batch): 모바일 동일 적용
- mobile `lib/inventory/map-label-to-receiving.ts` 복제(+DUPLICATED 주석) + `scan.tsx`/`register.tsx`/`lot-receive.tsx` + §11.310 1-flow.

## 9. Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| production 마이그레이션 사고 | Low | High | ADD COLUMN NULL only, dry-run+승인, 자동 파싱 0 |
| 큰 파일(LabelScannerModal/inventory-content) truncation | Med | High | Python/heredoc, 매 편집 EOF·줄수 확인 |
| 데스크톱/모바일 매핑 불일치 | Med | Med | surface-agnostic 순수 함수 공유 |
| 기존 부풀린 데이터 식별 난이도 | High | Med | 옵션 C(수동 검증)+의심 탐지 보조, 자동 X |

## 10. Rollback — 1: 신규파일 revert / 2: 컬럼 drop(또는 NULL 무시) / 3: 모달·onDirectReceive revert / 4: 배너 제거.

## 11. Progress
- Overall: ~10% (Phase 0 완료)
- Current: Phase 1 RED
- Blocker: 없음 (Phase 2 마이그레이션은 호영님 production 승인 대기)

**확정(2026-05-30):** ⓐ 신규 컬럼+specification fallback+자동파싱X / 총함량 표시만 / 데스크톱(A) 먼저→모바일(B) / 옵션 C / §11.326>§11.327>§11.318 1d-2.

**Checklist:** [x] P0 / [ ] P1(RED) / [ ] P2(migration) / [ ] P3(UI) / [ ] P4(알림) / [ ] Phase B

## 12. Notes
- [2026-05-30] root cause = LabelScannerModal:282 + mobile mapLabelToForm 한 줄. 표면=LabelScannerModal(워크벤치 함정 없음).
- 마이그레이션 2-a/2-b/2-c 분리로 production 안전. 자동 파싱 금지(§1 재발 방지).
