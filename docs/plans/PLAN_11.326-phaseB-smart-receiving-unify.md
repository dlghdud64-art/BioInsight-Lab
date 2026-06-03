# Implementation Plan: §11.326 Phase B 보강 — 모바일 + 스마트 입고 통합

- **Status:** ⏳ Pending (audit 완료, 사전조건 3건 회신 후 GREEN 진입)
- **Started:** 2026-05-30 · **Last Updated:** 2026-05-30
- **Priority:** P0(데이터 일관성) + UX 통합(명칭/진입점은 P1 성격 — 호영님 우선순위 조정 가능)
- **모델:** Opus 4.8

**CRITICAL:** 큰 파일(inventory-content 4600줄+) Python 원자 치환 + 매 편집 brace/eof 확인. "회귀 0"은 정규식 단언 후 선언. 완료 마킹은 sentinel PASS 후.

## 0. Truth Reconciliation (audit 2026-05-30, read-only)

### 명칭 현황 (산재 — 통일 대상)
| 위치 | 현재 | → |
| :-- | :-- | :-- |
| `smart-receiving-modal.tsx:178` (메인 대시보드) | **"스마트 입고"** (canonical) | 유지 |
| `LabelScannerModal.tsx:413` (h3) | "스마트 재고 등록 (AI 라벨 스캔)" | **스마트 입고** |
| `global-modal.tsx:48` (defaultTitle) | "스마트 재고 등록 (AI 라벨 스캔)" | **스마트 입고** |
| `inventory-content.tsx:1378` (kebab) | "스마트 재고 등록" | **제거**(메인버튼 1526 존재) |
| `inventory-content.tsx:1526` (메인버튼) | "스마트 재고 등록" | **스마트 입고** |
| `scan.tsx:466` (모바일 헤더, 라벨 모드) | "라벨 스캔" | **스마트 입고** |

### 이미 구현됨 (보강 불필요, push 대기)
- **모바일 §11.326 섹션 분리**: `scan.tsx` 570 "규격 (통 1개의 함량)" / 588 "받은 통 개수" / 599 "총 함량" — **task #26 Phase B GREEN 에서 이미 적용**. IMG_5719(미적용)는 push 전 화면.
- **메인 대시보드 통합 동선**: `smart-receiving-modal.tsx:179` "거래명세서나 시약 라벨을 촬영하세요" — 거래명세서+라벨 분기 이미 존재.
- **데이터 매핑(Phase B 본작업)**: ⚠️ 정정(2026-05-30) — task #26 완료 마킹은 검증 누락이었음. scan.tsx 는 §11.319 라벨모드만 있고 packSize/receivedQuantity 분리 **미적용**이었음(HEAD=WORK 905줄). **재작업 GREEN 완료**: LabelForm packSize/packUnit/receivedQuantity/receivedUnit 분리, mapLabelToForm 라벨 quantity→packSize·입고수량 기본1, prefillQty/register quantity=receivedQuantity, UI "수량"→"규격(통 1개)". 907줄 무결, sentinel ✓(packSize 매핑/받은수량 기본1/prefillQty=received/버그 0). 모바일 lib(82줄) 기존 복제 유지. register·lot-receive 수신부 정합 ✓.

### 보강 실질 신규분 (audit로 scope 축소)
1. 명칭 통일 (웹 4곳 + 모바일 헤더 → "스마트 입고")
2. kebab 항목 제거 (inventory-content:1378)
3. 모바일 거래명세서 추가촬영 동선 (scan.tsx — 현재 라벨만)
4. scan.tsx 카피 정리 (오타/문구)

### ⚠️ 호영님 production 검증 추가 정정 (2026-05-30) — 3건
- **(P0) 통합 동선 핵심 동작 = 라벨→거래명세서/PO 매핑**: 라벨 스캔으로 품목 식별 → 그 품목으로 **기존 거래명세서/PO 자동 검색 + 사용자 선택/매핑** → 매핑된 PO에서 **입고 수량 자동 채움** → 매핑 없으면 수동 입력. (현재는 라벨→폼→끝, 매핑 동선 부재.) = §11.326 데이터 모델 최종 의도.
- **(P1) 개발자 용어 → 사용자 친화 문구**: "JPG/PNG/WebP 이미지 선택" / "OCR" / "ocrJobId" 등 → 일반 문구. (예: "사진을 선택하거나 촬영하세요".)
- **(P1) 에러 메시지 정정 + root cause**: "ocrJobId가 없어 입고 등록할 수 없습니다" → "이미지 분석 결과를 찾을 수 없습니다. 다시 스캔해 주세요." + **왜 jobId 없는지 root cause 조사**(매핑 미적용·STORAGE_PROVIDER 미설정 맥락 가능 = §11.290 Phase 5 연관).
- ⚠️ **grep 정합 경고**: 현재 sandbox 코드에 `ocrJobId`/`JPG`/`WebP`/"이미지를 선택" **0건**(grep). 호영님 화면은 이전 배포본일 수 있음 → GREEN 진입 시 **실제 문구·에러 위치 재확인 필수**(추정 금지). production-sandbox drift 확인 선행.

### 자기정정
- 직전 "스마트 입고로 통일됐다"는 부정확. 정확히는 "Phase B 보강 사양에 통일이 포함" + **실제 land 안 됨**. 호영님 검증이 잡음.

### ⚠️ 표면 재audit 결과 (2026-05-30, §11.318 학습 적용) — 두 모달 별개 확정
| 컴포넌트 | 진입점 | OCR API | §11.326 데이터모델 |
| :-- | :-- | :-- | :-- |
| **SmartReceivingScannerModal**(558줄) | 메인 대시보드(inventory-main:?, Header) = "스마트 입고" | `/api/quotes/parse-image` → `/api/inventory/smart-receiving` | **quantity 단일 — packSize 분리 미적용(§11.326 버그 존재)** |
| **LabelScannerModal** | 재고 kebab/scan page/워크벤치/global-modal = "스마트 재고 등록" | `/api/inventory/scan-label` | packSize/receivedQuantity 분리 **적용됨(Phase 3)** |
- **가설 A 확정**: 두 모달은 중복 아니라 **목적 다름**(Smart=거래명세서 파싱, Label=라벨 OCR). 단 §11.326 데이터모델이 Smart엔 미적용.
- **ocrJobId 에러 root cause = SmartReceivingScannerModal:253** — `scanResult.ocrMetadata.jobId` 없으면 입고 차단(dead-end). 거래명세서 파싱이 jobId 없이 반환(STORAGE_PROVIDER 미설정 시 §11.290처럼 jobId=null) → 입고 불가. = §11.290 Phase 5 연관(호영님 통찰 정확).
- **친화문구 위치 = Smart:315/323** ("거래명세서 또는 라벨 촬영" + "JPG/PNG/WebP").
- **진입점 정정**: 호영님 화면(메인 대시보드 "스마트 입고" + ocrJobId 에러) = **SmartReceivingScannerModal**. sandbox §11.319/§11.326 Phase 3 작업 = **LabelScannerModal**(다른 컴포넌트). §11.318 표면 불일치와 동일 구조.

### Phase B v2 scope 확정 (audit 후)
1. **SmartReceivingScannerModal에 §11.326 데이터모델 적용** — quantity 단일 → packSize/receivedQuantity 분리(Label과 동일 패턴). **P0(데이터 무결성, Smart에도 같은 버그)**.
2. **ocrJobId dead-end fix** — 친화 메시지 + jobId 없을 때 우회(수동 입고) 경로. root cause(STORAGE_PROVIDER) = §11.290 Phase 5 별도.
3. 명칭 통일(웹 4곳 + 모바일) + 친화문구(JPG/PNG/WebP, OCR 제거).
4. 라벨→거래명세서/PO 매핑 동선(P0, 통합 핵심).
5. 두 모달 정합: 통합 vs 병존 = 호영님 결정(목적 다르므로 **병존 + 데이터모델 통일** 권장).

### Chosen Source of Truth
- canonical 명칭 = **"스마트 입고"** (smart-receiving-modal 기준, 가장 포괄적).
- 데이터: §11.326 본 모델(packSize=품목, receivedQuantity=입고) 불변.

### Environment
- [ ] 사전조건 3건(migrate deploy ✓ / vitest GREEN / 라벨 스캔 검증) 회신 → GREEN 진입.

## 1. Priority Fit
- 데이터 일관성(Phase B 본작업)=P0(완료). 명칭/진입점/거래명세서 동선=UX 통합(P1 성격). 같은 batch 묶음이 충돌 방지·효율적이라 함께 처리하되, 호영님이 P0/P1 분리 원하면 명칭통일만 우선 가능.

## 2. Work Type — Mobile + Web + Design Consistency(명칭/진입점) + Bugfix(데이터, 완료분).

## 3. Success Criteria
**명칭 통일**
- [ ] 웹 4곳 + 모바일 헤더 "스마트 입고"로 통일
- [ ] "스마트 재고 등록" 0건(grep, 단 redirect 안내 텍스트 제외)
**진입점**
- [ ] inventory-content kebab "스마트 재고 등록" 제거 (메인버튼 유지)
- [ ] 데스크톱/모바일 메인 액션에 스마트 입고 노출
**모바일 동선**
- [ ] scan.tsx 섹션 분리 유지(이미 적용) + 거래명세서 추가촬영 동선
- [ ] scan.tsx 카피 정리
**데이터 정합(완료분 보존)**
- [ ] packSize=Product / receivedQuantity=InventoryRestock 불변
**표면 일관성**
- [ ] 데스크톱 LabelScannerModal ↔ 모바일 scan.tsx UI 패턴 일관
- [ ] §11.310 1-flow 충돌 0

**Out of Scope:** 외부 데이터 / 하단 nav FAB(선택, 별도) / 거래명세서 OCR 신규 파이프라인(기존 재사용).

## 4. Product Constraints
- Preserve: workbench/queue/rail/dock, same-canvas, §11.326 데이터 모델, smart-receiving-modal 기존 동선.
- Must not: dead button(kebab 제거 시 메인버튼 보장), 데이터 매핑 회귀, 명칭 누락(redirect/학습 안내), 큰 파일 truncation.

## 5. Architecture
- 명칭은 상수화 가능하면 단일 소스(`SMART_RECEIVING_LABEL = "스마트 입고"`) 검토 — 단 4곳이 JSX 리터럴/registry라 minimal-diff로 직접 치환이 더 안전할 수 있음(진입 시 결정).
- 모바일 거래명세서 추가촬영 = scan.tsx에 모드 추가 or smart-receiving-modal 패턴 참조.

## 6. Test Strategy
- sentinel: 명칭 "스마트 입고" 4곳 + "스마트 재고 등록" 0 / kebab 제거 / scan.tsx 섹션 분리 보존 / 데이터 매핑 보존(mapLabelToReceiving) / §11.310 충돌 0.
- 시각/실기기 = 호영님 env.

## 7. Phases (사전조건 회신 후)
- **B0** Truth Lock — ✅ audit 완료(본 문서).
- **B1 RED** — 통합 sentinel(명칭/kebab/섹션/데이터/거래명세서 동선).
- **B2 GREEN 명칭통일** — 웹 4곳 + 모바일 헤더 치환 + kebab 제거. (작은 diff, 먼저)
- **B3 GREEN 모바일 거래명세서 동선** — scan.tsx 추가촬영 + 카피 정리.
- **B4 Smoke/Closeout** — 표면 일관성 + §11.310 충돌 점검 + 사용자 안내 배너(Phase 4 패턴) + COMMIT draft.

## 9. Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| 명칭 치환 누락(진입로 깨짐) | Med | Med | grep "스마트 재고 등록" 0 검증 + redirect 안내 |
| kebab 제거 시 진입 dead-end | Low | Med | 메인버튼(1526) 존재 확인 후 제거 |
| 큰 파일 truncation | Med | High | Python 원자 치환 + 무결성 확인 |
| 모바일 변경이 데스크톱/§11.310 영향 | Med | Med | surface별 분리, sentinel 회귀 |
| 데이터 매핑(완료분) 회귀 | Low | High | mapLabelToReceiving 단언 보존 |

## 10. Rollback — B2: 명칭 revert / B3: scan.tsx 동선 revert / 각 phase 독립.

## 11. Progress
- Overall: ~15% (audit 완료, 사전조건 대기)
- Current: B0 완료 → 사전조건 3건 회신 대기 → B1 RED
- Blocker: 사전조건 회신(migrate deploy ✓ / vitest / 라벨 스캔)

## 12. Notes
- [2026-05-30] audit: 모바일 섹션 분리·메인 대시보드 통합 동선 **이미 존재** → 보강 scope 축소(명칭통일/kebab/거래명세서 동선/카피).
- 명칭 canonical = "스마트 입고"(smart-receiving-modal).
- Phase B 데이터 매핑은 완료·push 대기(task #26).
