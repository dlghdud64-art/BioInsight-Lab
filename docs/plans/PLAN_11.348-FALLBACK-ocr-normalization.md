# Implementation Plan: §11.348-FALLBACK — 외부문서 OCR 정규화 (회신 안 하는 공급사)

- **Status:** 🗂️ Plan (Phase 0 진단 완료 — Large, 전용 세션 권장)
- **Last Updated:** 2026-06-03
- **성격:** A 폐루프 보조 — 공급사가 A-2 회신 링크로 응답 안 할 때 종이/외부 납품문서를 OCR → 동일 ReceivingDraft 스키마로 정규화.
- **Scope:** **Large** + 외부 의존(OCR provider, 실 이미지 검증). 한 세션 surgical 불가.

## Phase 0 — 코드 정독 결과 (2026-06-03, 추측 없음)

### 이미 존재 (대부분 재사용 — 중복 주의)
- ✅ **OCR 파이프라인 성숙**: `lib/ocr/` (orchestrator, gemini/cloud-vision/claude/regex 3-tier, run-ocr-pipeline). `OcrJob` 모델 + `OcrJobType {LABEL, QUOTE}`(QUOTE="견적서/**거래명세서**") + `OcrJobStatus {SUCCESS(≥0.85 auto), NEEDS_REVIEW(<0.7 수동보정), FAILED}` + `OcrProvider` 3단 + confidence/cache.
- ✅ **OCR → 입고 이미 작동(§11.309a)**: `OcrJob.restocks InventoryRestock[]` — "한 OCR job(거래명세서 다수 품목) → 여러 InventoryRestock". 즉 **OCR로 종이 납품문서를 읽어 입고하는 경로는 이미 구현됨.**
- ✅ 신뢰 등급도 이미 confidence 기반(SUCCESS/NEEDS_REVIEW).

### §11.348-FALLBACK 의 진짜 갭 (A 폐루프 정합)
- 현 §11.309a OCR 입고는 **InventoryRestock 직접 생성**(스마트 입고). 그러나 A 폐루프(§11.348-A)는 **ReceivingDraft(검증 대기 입고안) → 사람 승인(A-4) → InventoryRestock** 게이트.
- **갭 = OCR 결과를 InventoryRestock 직행이 아니라 ReceivingDraft(PENDING_REVIEW, source=ocr)로 보내 A-4 승인 게이트 + OCR 신뢰등급(낮으면 강한 검증)을 거치게 하는 분기.**
- 즉 신규 = "OCR finalResult → ReceivingDraftItem 매핑 + ReceivingDraft 생성(source/신뢰등급 표기)". A-4/A-4b/A-5 는 그대로 재사용.

## ✅ 이중경로 결정 (호영님 확정 2026-06-03) — **a. 유지+분기**
- **§11.309a OCR 직행 입고(스마트 입고) 존치** + FALLBACK 은 ReceivingDraft 게이트 경유. 일원화 아님.
- 근거: 직행 = 사용자 즉시 확인 현장 경로(빠름, 이미 작동, 제거 시 회귀). A게이트 = 신뢰등급 낮은 외부문서 → 사람 승인 필수. 둘은 신뢰도가 다름. 일원화 시 빠른 현장 경로까지 게이트 → 속도 저하.
- **분기 기준 = OCR confidence + 출처**(스마트입고 직행 vs FALLBACK 외부문서).
- ⇒ FB-2 설계 전제 확정. §11.309a 라우트는 **무변경**(회귀 0), FALLBACK 은 신규 분기로 추가.

## ⏸️ 우선순위 (호영님 2026-06-03)
- FALLBACK 은 roadmap상 "A 메인 닫히면 우선순위 낮음, 보조 상존". A 폐루프·B-1 완료라 즉시 가치 낮음.
- **FB 구현은 baseline · §11.312 · §11.358-1(견적 fetch 실패) 뒤로 큐잉.** 이중경로 결정만 지금 확정.
- migration 파일은 **착수 시점에 dry-run 생성**(지금 생성 시 timestamp 드리프트·미적용 clutter). 본 문서가 FB-0 지시문.

## 분할 (착수 시 phase 별 승인)
- **FB-0 (선행, migration) — 착수 지시문(큐잉)**:
  - schema: `ReceivingDraft.source String @default("reply")`(reply/ocr/qr) + `confidence Float?`(OCR 신뢰도) + `ocrJobId String?` + `ocrJob OcrJob? @relation(SetNull)` + `@@index([source])`. OcrJob 측 백릴레이션 `receivingDrafts ReceivingDraft[]`.
  - backward-compat: 기존 행 source="reply"(A-1/A-2 회신분), confidence=null.
  - 착수 절차: 위 schema 패치 → `prisma migrate diff`(offline dry-run) → 평이한 한국어 보고 → 호영님 "진행" → `migrate dev`+`generate`. (A-3/B1-0 동일 패턴.)
  - 이중입고 가드: ocrJobId 로 동일 OCR job 의 직행(§11.309a)/게이트 중복 입고 방지.
- **FB-1**: OCR finalResult(거래명세서 QUOTE 타입) → ReceivingDraftItem 매핑 어댑터(순수, 테스트 가능). 기존 OcrResult 구조 → {orderItemId? / name / receivedQuantity / lotNumber / expiryDate}.
- **FB-2**: 라우트 — 기존 OCR 입고 분기에 "A 폐루프로 보내기(ReceivingDraft)" 옵션 or 신규 엔드포인트. PO 매핑(어느 발주의 입고인지) 해소 — orderId 선택 or 미지정(승인 시 매핑).
- **FB-3**: A-4b 리뷰 UI 에 source/신뢰등급 배지(OCR=낮은 신뢰 강조) + NEEDS_REVIEW 강한 검증 표시.
- **FB-4**: 공급사별 매핑 규칙 축적(쓸수록 정확) — 별도 큰 트랙(후순위, roadmap).

## 재사용 (신규 최소)
- OCR: `lib/ocr/*` + OcrJob + confidence. 입고: ReceivingDraft(A-3) + A-4 승인 + delivery-sync. UI: A-4b 패널 + A-5 라벨.
- 신규 = source/confidence/ocrJobId 필드(migration) + OCR→draft 매핑 어댑터 + 분기 라우트 + UI 배지.

## Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| §11.309a(OCR→restock 직행)와 이중 경로 혼선 | High | High | FB-2에서 "직행 vs A-게이트" 분기 명확화. 같은 OcrJob 이중입고 가드(restockSyncedAt/ocrJobId) |
| OCR 매핑 정확도(거래명세서 다양) | High | Med | NEEDS_REVIEW → 무조건 사람 승인(A-4). 신뢰등급 표기 |
| migration(ReceivingDraft 필드) | Med | High | FB-0 dry-run→보고→진행 |
| 실 이미지 검증 불가(sandbox) | High | Med | 어댑터는 fixture 단위테스트, OCR 런타임은 ops 검증 |
| 한 세션 과욕 | High | High | FB-0~FB-3 phase 별 착수·승인 |

## Open Questions
- [ ] §11.309a OCR 입고(직행)를 **유지+A게이트 추가** vs **A게이트로 일원화**? (이중 경로 정책 — 호영님 결정)
- [ ] PO 매핑: OCR 거래명세서가 어느 Order(PO) 입고인지 식별 방법(발주번호 OCR? 사람 선택?)
- [ ] OcrResult 의 품목 구조(거래명세서 라인) → ReceivingDraftItem 필드 대응 정확도.

## 권장
- **전용 세션 트랙.** FB-0(migration)부터 dry-run→보고. 실 OCR 검증은 ops 이미지 필요.
- **선행 결정 필요(Open Q1)**: 이중 경로 정책 — 이게 정해져야 FB-2 설계 확정. (§11.309a 와의 관계가 핵심.)
- 현 시점 즉시 가치 < A 폐루프/B-1 (이미 완료) — FALLBACK 은 "회신 안 하는 공급사" 보조라 우선순위 낮음(roadmap 명시).

## Notes
- roadmap(§11.348 vision) §11.348-FALLBACK = "A의 메인 경로가 닫히면 우선순위 낮음 — 폐기 아님, 보조로 상존".
- OCR 인프라가 이미 있어 **신규 구현 부담은 매핑+분기+필드**로 제한적이나, §11.309a 와의 이중 경로 정책 결정이 선행돼야 안전.
