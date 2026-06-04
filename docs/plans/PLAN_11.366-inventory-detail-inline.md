# Implementation Plan: §11.366 재고 품목 상세 인라인 조회 (D-8)

- **Status:** ⏳ Pending
- **Started:** 2026-06-04
- **호영님 P1 (D-8, 2026-06-04). 선결 진단 완료 → 계획서.**

**CRITICAL**: phase 완료마다 체크박스·Last Updated 갱신 / quality gate(Claude Code tsc·lint·test) / dead button·no-op·placeholder success 금지 / 미해소 충돌로 진행 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 현 배포 `0f0345d1` + §11.364 미푸시 3건(독립).

**선결 진단 결과 (코드 확정, 2026-06-04):**
- 행/카드 button onClick(`inventory-main` L1709-1717) = `setSelectedItem(inv)` + `setIsSheetOpen(true)` → **상세 Sheet 오픈 존재 = no-op 아님.**
- ⇒ **D-8 지시 2번 = "필드 보강"** (신규 wire 아님).
- **상세 Sheet(drawerMode "view", L2247-2371)가 이미 다수 필드 보유**: 품명·브랜드·카탈로그·Lot번호·유효기간·vendor·납기·사용여부·평균유효기간·시험용도·보관조건·특이사항·단위.
- **상세 표면 2개 공존**: ① `selectedItem` Sheet(`isSheetOpen`) ② `InventoryContextPanel`(dynamic, `contextPanelItem`, right drawer). → **정본 확정 필요(Phase 0).**

**Chosen Source of Truth:** ProductInventory + product 마스터(Prisma). UI Sheet = 표시 projection.

**Conflicts:** 상세 표면 2개 → 어느 것이 D-8 정본인지 Phase 0에서 확정(트리거 L1711은 Sheet).

**Environment:** 코드 편집·grep 가능 / ⚠️ tsc·vitest·build = Claude Code 전용 / page 큰 파일(3817줄) = Read 정밀.

## 1. Priority Fit
- [x] P1 (호영님 D-8). §11.364와 독립 batch. release-prep 비충돌.

## 2. Work Type
- [x] Feature(상세 필드 보강) [x] Design Consistency(모바일 bottom sheet) [x] Mobile [x] Web
- same-canvas: 기존 Sheet/drawer 보강, **신규 페이지/시트 생성 0.**

## 3. Overview

**Feature:** 재고 품목 마스터 12필드 전체 + 현재고/안전재고 + Lot 목록을 다운로드 없이 in-app 상세에서 조회. 내보내기는 공유·대량·오프라인용으로 역할 분리.

**Success Criteria:**
- [ ] 모바일·데스크탑 모두 다운로드 없이 마스터 12필드 전체 in-app 조회.
- [ ] 행/카드 탭 no-op 0 (반드시 상세 오픈 — 이미 충족, 회귀 가드).
- [ ] 가로 스크롤로 전 컬럼 보게 하는 패턴 0 (모바일 세로 스택).
- [ ] "Lot N개 보기" → 상세 Lot 목록으로 흡수.
- [ ] G-3: export·상세 모두 `inv-pilot-*` 내부키 누출 0.

**마스터 12필드:** 시약명 · 영문명 · CAS · 카탈로그번호 · 제조사/브랜드 · Lot번호 · 고유바코드 · 현재고 · 단위 · 유효기간 · 보관온도 · 보관위치. (+ 현재고/안전재고 + Lot 목록)

**누락 필드 후보(Phase 0 확정):** 영문명·CAS·고유바코드·보관위치 + Lot 복수 목록. (품명·브랜드·카탈로그·Lot번호·유효기간·단위·보관조건은 기존 보유.)

**Out of Scope (⚠️):**
- [ ] 테이블을 모바일에 가로로 욱여넣기 (현행 카드 reflow 유지).
- [ ] 빠른작업(재주문·입고)·상태 dot 변경 (회귀 0).
- [ ] §11.364·D-7·§0 batch.

## 4. Product Constraints
- Must Preserve: [ ] same-canvas [ ] 기존 트리거(L1711) [ ] 카드 reflow [ ] canonical truth(Sheet=projection)
- Must Not: [ ] 신규 page/시트 [ ] no-op [ ] 가로 스크롤 전컬럼 [ ] 내부키 누출
- **Canonical Truth Boundary:** Source=ProductInventory+product. Projection=상세 Sheet/drawer 필드. Persistence 변경 0(조회 전용).
- **UI Surface:** [ ] 데스크탑=행 인라인 확장 또는 우측 drawer(기존 Sheet/ContextPanel 중 정본) [ ] 모바일=bottom sheet 세로 스택.

## 5. Architecture
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| 기존 Sheet 보강(신규 0) | same-canvas·트리거 재사용 | 표면 2개 정본 확정 선행 |
| 정본 = `selectedItem` Sheet | 트리거 L1711이 이미 연결 | ContextPanel 역할 재정의 필요 |
| Lot 목록 흡수 | "Lot N개 보기" 단편화 해소 | lot 데이터 fetch 경로 확인 |

**Touched:** `inventory-main.tsx`(Sheet 필드), `inventory-context-panel.tsx`(정본 아니면 역할 정리), export 핸들러(L1177 라벨 데이터 내보내기 + G-3 내부키), lot fetch(`/api/inventory/[id]/restock` 또는 lot endpoint).

## 6. Test Strategy
- sentinel(readFileSync+regex): ① 행/카드 트리거 존재(no-op 0 회귀), ② 상세 12필드 라벨 존재, ③ 모바일 세로 스택(가로 스크롤 클래스 0), ④ export·상세 내부키(`inv-pilot-`) 부재.
- ⚠️ 실행 = Claude Code `npm run test`. sandbox = grep 사전검증.

## 7. Phases

### Phase 0: 정본·필드갭 확정
- [ ] 상세 표면 2개(Sheet vs ContextPanel) 중 D-8 정본 확정(트리거 L1711=Sheet 기준).
- [ ] 현 Sheet 필드 vs 마스터 12 갭 정밀(누락: 영문명·CAS·바코드·보관위치 추정 → 확정).
- [ ] 모바일 상세 표면 = 동일 Sheet 반응형인지/별도인지 확인.
- [ ] product 마스터 필드명(englishName/casNumber/barcode/storageLocation) Prisma 스키마 확인.
- [ ] Lot 데이터 소스(복수 lot) 경로 확인.
- ✋ Gate: 정본 1개 확정, 누락 필드 목록 확정, 데이터 소스 확정. **Rollback:** planning-only.

### Phase 1: 상세 필드 보강 (Web)
- [ ] 🔴 sentinel: 12필드 라벨 + Lot 목록 존재.
- [ ] 🟢 정본 Sheet에 누락 필드(영문명·CAS·바코드·보관위치) + 현재고/안전재고 + Lot 목록 추가. 값 없으면 "-"(fake 0 금지).
- [ ] 🔵 필드 그룹핑 정리(식별/재고/보관).
- ✋ Gate: 12필드 전부 조회, dead 필드 0, canonical projection(mutation 0). **Rollback:** Sheet 필드 블록 revert.

### Phase 2: 모바일 bottom sheet 세로 스택
- [ ] 🔴 sentinel: 모바일 세로 스택 + 가로 스크롤 클래스(overflow-x-auto 등) 0.
- [ ] 🟢 모바일 상세 = bottom sheet 전 필드 세로 스택. 테이블 가로 reflow 금지.
- ✋ Gate: 375px 가로 스크롤 0, 전 필드 세로 도달. **Rollback:** 모바일 분기 revert.

### Phase 3: G-3 내부키 정리 + 내보내기 역할 분리
- [ ] 🔴 sentinel: export·상세 `inv-pilot-` 부재.
- [ ] 🟢 export 바코드열 내부키(`inv-pilot-dmem/fbs/trypsin`) → 실 바코드/품명 매핑. 상세 시트 동시 정리. 내보내기 = 공유·대량·오프라인 용도 라벨 명확화(단건 조회 fallback 아님).
- ✋ Gate: 내부키 누출 0(export+상세), 조회 동선 in-app 종결. **Rollback:** export 매핑 revert.

### Phase 4: Smoke / Rollback
- [ ] 🟢 Claude Code tsc/lint/test/build → push → Chrome 재검증(375px + 데스크탑): 다운로드 없이 12필드 조회, 행/카드 탭 오픈, 가로 스크롤 0.
- ✋ Gate: 회귀 0, rollback 문서.

## 9. Risk
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| 상세 표면 2개 혼선 | Med | Med | Phase 0 정본 1개 확정 |
| 누락 필드 = Prisma 미존재 | Med | Med | Phase 0 스키마 확인(없으면 "-" 또는 범위 제외) |
| 모바일 가로 reflow 회귀 | Low | High | 세로 스택 강제 + 375px sentinel |
| 내부키 export 누출 잔존 | Med | Med | export+상세 동시 sentinel |

## 10. Rollback
- Phase 1 Sheet 필드 / Phase 2 모바일 분기 / Phase 3 export 매핑 — 각 독립 revert.

## 11. Progress
- Overall 85% · Current: Phase 3 완료 (G-3 pilot 내부키 일괄 정리, 코드) · Next: Phase 4 (재시드 apply + Chrome 검증)
- Checklist: [x] P0 [x] P1 [x] P2 [x] P3 [ ] P4

**Phase 3 완료 (G-3 — 옵션 A, dry-run→진행 게이트 통과):**
- 환경 soft launch 확정 → 전체 클린 재시드. G-3을 pilot 내부키 일괄 정리로 재정의.
- 옵션 A: upsert 키 자연키 이전(inv org+productId, order quoteId) → id cuid 자동(스키마 0, idempotent 보존).
- pilot.ts: 조직명/워크스페이스명 데모명, inv/order id 제거, orderNumber ORD-2026-0001, IDS export 폐기. product/vendor/quote PK 보존(미노출).
- pilot-seed.ts: inv/order upsert 자연키. 테스트 갱신. sentinel `pilot-internal-key-removed-366g3`.
- ⚠️ **재시드 apply(cleanup→seed)는 호영님 Claude Code(DB)** — commit-draft에 절차. Phase 4 = apply + Chrome 검증.

**Phase 2 완료 (모바일 세로 스택) — §11.364 패턴(수용기준 우선·과적용 금지):**
- 기본/관리 정보 grid 2곳 `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`(모바일 세로, 데스크탑 2칸). 값 잘림·가로 욱여넣기 0.
- side="bottom" 반응형 미적용(과적용 회피): isMobile 훅+Sheet 변경 회귀 표면, right drawer 90vw로 기능 충분. bottom 형태는 별도 결정.
- 현재고/Lot 카드는 짧은값 2칸 유지. sentinel Phase 2 describe 추가.

**Phase 1 완료 (Web 필드 보강):**
- 정본 = `selectedItem` Sheet(drawerMode "view") 확정. 보강: 영문명(nameEn)·현재고·안전재고·보관위치(location)·고유식별자(inv.id).
- product `include`(select 아님) → nameEn 데이터 채워짐(route.ts L128).
- Lot 목록 = 기존 입고 이력 토글(restock-history) 활용. CAS 제외/바코드=inv.id(Phase 0 결정).
- sentinel `inventory-detail-fields-366`(트리거 no-op 0 + 5필드 + 회귀). 전 정규식 OK.

**Phase 0 결론 (2026-06-04):**
- Prisma 매핑: 10/12 존재(name·nameEn·catalogNumber·brand/manufacturer·lotNumber·currentQuantity·unit·expiryDate·storageCondition·location) + safetyStock.
- **CAS**: Prisma 전용 컬럼 없음 → 호영님 결정 **이번 범위 제외**(스키마 그대로, migration 0). 추후 별도 batch.
- **고유바코드**: 전용 컬럼 없음 → 호영님 결정 **inv.id(cuid) 표시**(§11.355-B QR 인코딩과 정합, 신규 컬럼 0).
- **표시 필드 = 11(CAS 제외) + inv.id(고유 식별자) + 현재고/안전재고 + Lot 목록.**
- **Lot 목록 소스**: `InventoryRestock`(입고 이력별 lotNumber), `/api/inventory/[id]/restock`(L563 기존 fetch).
- **정본 표면**: 트리거 L1711=`selectedItem` Sheet → Sheet 유력. Phase 1 착수 시 모바일/데스크탑 공용 여부 + ContextPanel 역할 최종 확정.

## 12. Notes
- [2026-06-04] 선결 진단: onClick=상세 Sheet 오픈(no-op 아님)→필드 보강 확정. 상세 표면 2개 공존 발견 → Phase 0 정본 확정.
- G-3(내부키 누출)은 D-8 export 정리와 동일 batch(호영님 지시).
