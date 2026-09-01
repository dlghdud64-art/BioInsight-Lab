# Implementation Plan: 스캔·문서 인식 고도화 (§scan-recognition-upgrade)

- **Status:** 🚧 In Progress (P0·P1 코드 완료 `997443cc` · P1 prod DDL 적용 대기)
- **Started:** 2026-08-31
- **Last Updated:** 2026-08-31 (P1 land)
- **핸드오프:** 입고 관리 리스트 핸드오프.md §3 (스캔·문서 인식 파이프라인) · 시각 truth 1a 하단 "스캔·문서 인식 구현 스펙"
- **선행:** §receiving-list-redesign (5d9fcbb7) — 리스트 canonical 전환 완료, COA 드롭존은 업로드만 배선됨
- **분담:** operator 세션 = 구현·게이트·push / sandbox 세션 = 계획서·프로브 검토

**CRITICAL:** phase 완료마다 체크박스 갱신 → quality gate 전부 통과 → Last Updated 갱신 → 다음 phase.
⛔ gate 실패 상태 진행 금지 · dead button/no-op/placeholder success 금지 · **인식값 자동 확정 금지**(핸드오프 §3 확인 규칙 = label-commit-gate 5규칙).

## 0. Truth Reconciliation

**Latest Truth Source:** 핸드오프 §3 + 레포 실측(2026-08-31).
**재사용 인프라 (실측):**
- OCR 3-tier 오케스트레이터 `src/lib/ocr/orchestrator.ts` — Gemini → Vision+Claude → regex, 임계 0.85(SUCCESS=prefill 가능)/0.70(NEEDS_REVIEW), cross-validate agreement 0.8
- 파이프라인 진입점: `runOcrPipeline`(라벨) · `runQuoteOcrPipeline`(명세서) · API `POST /api/quotes/parse-image` {imageBase64} → {parsed: ParsedQuoteDocument, confidence high|medium|low, jobId}
- 감사·캐시: `OcrJob`(imageHash 캐시) / `OcrResult`(provider·confidence·costUsd·rawText) / `OcrCacheHit` · 보정 저장 `POST /api/ocr/correct/[jobId]`(provider=manual, confidence 1.0)
- 앵커 regex tier3 `src/lib/ocr/label-parser.ts` — LOT_PATTERNS/EXPIRY_PATTERNS(Exp·Expiry·Use by·유효기한·사용기한·만료일)·CATALOG·CAS → **핸드오프 "앵커 키워드+값 패턴" 원형 이미 존재**
- 확정 게이트 `src/lib/ocr/label-commit-gate.ts` — Lot·유효기간은 신뢰도 무관 명시 확인 후 commit(호영님 5규칙, 3 surface 공용) → **핸드오프 §3 "자동 확정 금지" 규칙의 정본. COA 확인 화면도 이 게이트를 쓴다**
- 촬영 품질 `capture-quality.ts`(good/warn/poor) + `ScanGuideFrame` · 스캔 허브 3경로 `ScanHubModal`(§11.371-3/379)
- 매칭: 라벨↔미입고 발주 후보 `po-candidates-for-label`(§11.326 v3) · `smart-receiving` 분기 A(기존 inventoryId)/B(신규 Product+Inventory+Restock)
- 문서 저장: `POST /api/receiving/documents/[orderId]`(FormData file+docType) → ReceivingDocument(order 단위)
- 판정 저장: `PATCH /api/receiving-drafts/[id]/inspect` — inspectedQuantity·decision·discrepancy 만. **lotNumber/expiryDate 쓰기 경로 없음**(restockedAt 라인 수정 거부 409 가드 있음)

**갭 (핸드오프 §3 ↔ 실측):**
| # | 핸드오프 요구 | 실측 | 처리 |
| :--- | :--- | :--- | :--- |
| G1 | COA 첨부 → Lot·유효·Cat.No 추출 → 라인 대조 → 채움 + `COA 인식` 배지 | COA는 업로드만, OCR 0 | **P1** |
| G2 | 명세서 다품목 일괄 초안 · 근사 매칭(공급사+품목+수량) · PO 없음=신규 | 단품만(§11.309e 후속 미구현) · 후보는 라벨 기반 | **P2** |
| G3 | 필드별 신뢰도(확신/불확실) + 원본 영역 하이라이트 | 문서 단위 confidence만 · bbox 0(Gemini) | **P3** — 필드별 마크는 label-commit-gate fieldMarks 확장, 하이라이트는 Vision bbox 있을 때만(없으면 원본 전체 병기 — 정직) |
| G4 | 공급사별 템플릿 학습 | 저장소 0(보정은 job 단위) | **P4** — `VendorParseTemplate` additive migration(승인 게이트) |
| G5 | 카메라 경계 감지·기울기 보정 | 품질 판정+가이드만 | **제외(별건)** — 웹 opencv급 의존 |
| G6 | 자동 확정 금지 | 오케스트레이터 SUCCESS=prefill 의미 | P0에서 UI 확정 게이트 = label-commit-gate 로 고정 |

**Conflicts:** 없음. 배치 모달 §6 "COA 자동 인식은 이 모달이 하지 않는다"는 P1 완료 시 supersede(주석·sentinel 동반 갱신).
**Chosen Source of Truth:** 인식 결과는 `OcrJob/OcrResult`(derived) · canonical 은 `ReceivingDraftItem.lotNumber/expiryDate`·`ReceivingDocument`·`InventoryRestock` — **확정(사람 확인) 전 canonical 쓰기 0**.

## 1. Priority Fit
- [x] Post-release (blocker는 §receiving-list-redesign 에서 해소)

## 2. Work Type
- [x] Feature + [x] Workflow Wiring + [x] Migration(P4 한정) + [x] Web

## 3. Overview

**Success Criteria (핸드오프 QA §3 승계):**
- [ ] COA 첨부 → 인식 → 확인 → 확정 → 라인 lot/expiry 채움 + `COA 인식` 배지 (수량 불변)
- [ ] 품목/Cat.No 불일치 경고 노출(차단 아님 · 사람 판단)
- [ ] 명세서: PO 있으면 연결(번호는 있을 때만 대조) · 없으면 근사 매칭 후보 제시 · 발주 없음 = 신규 입고 바로 등록(연결 강제 0)
- [ ] 다품목 초안 라인별 수량 확인 후 일괄 등록(트랜잭션)
- [ ] 인식값 필드별 신뢰도 표시 · 자동 확정 0 · 인식 실패 필드 빈 채로 수동 입력 폴백
- [ ] 촬영 원본 = OcrJob.imageUrl + 입고 건 첨부 문서로 저장
- [ ] 보정 필드가 공급사별 템플릿으로 저장되고 다음 파싱에 힌트로 주입(P4)

**Out of Scope (⚠️ 구현 금지):**
- [ ] 카메라 경계 감지·기울기 보정(G5) · 모바일 앱 변경 · QR 재고 사용 경로 변경(현행 유지) · 새 스캔 진입 페이지

## 4. Product Constraints
- Source of Truth: 위 §0. 인식 결과는 항상 derived. 확정 = 사람 클릭 1회 이상.
- UI Surface: 기존 스캔 허브 모달·배치 모달·리스트 인라인 드롭존 안에서만(same-canvas). 새 페이지 0.
- 색: 확신 = blue(bg-blue-50 text-blue-700) · 불확실 = **yellow**(§11.302, 시안 amber 치환) "확인 필요" · 불일치 경고 = red.
- 타이포: 구분자 가운뎃점 · em dash 0.
- 이중 반영: 인식·확정 경로는 재고 mutation 0. 재고 변화는 기존 `/approve`·`smart-receiving`만.

## 5. Architecture

| Decision | Rationale |
| :--- | :--- |
| COA 인식 = `runOcrPipeline`(라벨 파이프라인) 재사용, 문서 타입 힌트만 추가 | Lot/Exp 앵커·3-tier·캐시·감사 전부 상속. 신규 파서 0 |
| 인식 API는 저장 0(`POST /api/receiving-drafts/[id]/coa-recognize` → 추출+대조 결과만) · 확정은 `inspect` PATCH 확장(lotNumber·expiryDate 선택 필드, additive) | canonical 쓰기 경로 단일화 + 기존 restockedAt 409 가드 상속 |
| 다품목 등록 = `smart-receiving` 다품목 배열 수용(additive: `items[]` 있으면 트랜잭션 반복, 없으면 기존 단품) | 기존 호출부 무회귀 |
| 근사 매칭 = 서버 순수함수(공급사명 정규화 + 품목 토큰 + 수량 근사) → 후보 목록, 자동 선택 0 | 연결 강제 금지(핸드오프) |
| 템플릿 학습 = `VendorParseTemplate`(orgId·vendorKey·docType·fieldKey·anchorPattern·hits·lastUsedAt) additive 신규 테이블 | 기존 CHECK/테이블 무접촉(§receiving-doc-attach-canonical 선례) |

**Touched (예정):** `src/lib/ocr/*`(파서 힌트·필드 마크) · `src/app/api/receiving-drafts/[id]/{coa-recognize,inspect}` · `src/app/api/inventory/smart-receiving` · `src/components/receiving/{receiving-case-list,receiving-batch-modal}.tsx` · `src/components/inventory/SmartReceivingScannerModal.tsx` · 신규 `src/components/ocr/recognized-fields-review.tsx` · `prisma/schema.prisma`(P4만)

## 6. Test Strategy
- 순수함수(앵커 추출·대조·근사 매칭·필드 마크) → vitest unit, RED 먼저 + 주입 프로브
- API 계약(coa-recognize 저장 0 · inspect lot/expiry additive · smart-receiving 다품목 트랜잭션) → route 파일 sentinel + 가능하면 통합 테스트
- UI → readFileSync sentinel(정규식 4원칙 · 주입 프로브 필수 · stripComments 로 주석 축 분리)
- 러너 정본 = 프로젝트 러너(operator 세션). 격리 러너 결과는 반드시 기준 명시.

## 7. Phases

### Phase 0: Truth Lock — ✅ 완료 (2026-08-31)
- [x] 파서 출력 계약 고정(ParsedQuoteDocument·LabelParseResult) · 확정 게이트 = label-commit-gate 채택 명문화
- [x] 배치 모달 §6 "COA 자동 인식 안 함" 주석·sentinel 목록 grep → supersede 대상 표(호영님 승인 · #1 은 canonical lotSource 재앵커로 수정)
- ✋ Gate: 갭표·계약·supersede 대상 확정 · Rollback: 문서만

### Phase 1: COA 인식 → 확인 → 확정 (G1) — ✅ 코드 완료 `997443cc` (prod DDL 적용·smoke 대기)
- [x] Migration(additive, 호영님 승인): `ReceivingDraftItem.lotSource`·`coaOcrJobId` + index — 배지 truth canonical 화. ⚠️ prod 적용은 rollout 4스텝(operator migrate deploy) 별도.
- [x] 🔴 unit 8: COA 픽스처 3종(영문 Lot/Exp · 국문 유효기한 · 실패 필드) → 추출 + 라인 대조(ok/mismatch/unknown) — `lib/ocr/coa-recognize.ts`
- [x] 🔴 sentinel 14(`receiving-coa-recognize.test.ts`): (a) 인식 API 저장 0 (b) inspect additive + coa_ocr→jobId 필수 400 (c) PATCH 는 확정 핸들러에만 (d) 배지 = lotSource 리터럴 (e) label-commit-gate canCommit (f) 모달 itemId 회귀 핀 — 주입 프로브 4종 → 대응 단언 6+승계 1 RED 실측
- [x] 🟢 `POST /api/receiving-drafts/[id]/coa-recognize` {imageBase64} → runOcrPipeline → {jobId, fields, confidence, perLine} (저장 0 · jobId 없으면 클라이언트가 확정 경로 차단 = lineage 강제)
- [x] 🟢 inspect PATCH 확장: lotNumber·expiryDate·lotSource·coaOcrJobId (restockedAt 409 유지)
- [x] 🟢 리스트 드롭존·배치 모달 문서 스텝: 업로드 → 인식 → RecognizedFieldsReview(1차본) → 확정 → PATCH → refetch
- [x] 🔵 배치 모달 §6 주석 supersede + 구 sentinel 승계(detail-realdata·list-redesign)
- [x] (발견 결함 수정) 배치 모달 inspect payload `id:` → `itemId` — 계약 불일치로 판정 스텝 전량 422(상세·리스트 양 표면)
- ✋ Gate: 프로브 4/4 검출 ✅ · 수량 불변 ✅(확정 경로는 lot/expiry 만) · 실패 필드 빈값 폴백 ✅ · **잔여: prod migrate deploy(승인 게이트) + 수동 smoke(호영님)**
- Rollback: 라우트 삭제 + inspect 확장 revert(additive 라 구 호출부 무영향)

### Phase 2: 명세서 다품목 초안 + 근사 매칭 (G2) — ✅ 코드 완료 (2026-08-31)
- [x] 🔴 unit 6(`lib/receiving/receipt-match.ts`): 점수축(PO 정규화 일치 +3 · 존재+불일치 -3 · **부재 감점 0** · 공급사 법인접미 정규화 +2 · 토큰 Jaccard ≥0.5 비율 ×2 · 수량 ±20% 비율 ×1 · 임계 3) · 후보 0/전원 미달 = mode "new" · 자동 선택 축 없음(shape 고정)
- [x] 🔴 sentinel 10(`smart-receiving-multi.test.ts`): items[] $transaction 1회가 라인 루프 포함 · 루프 안 direct db.* 0 · 단품 분기 A/B 앵커 보존 · results/count 계약 · 라인 include/qty testid · 등록 disabled 에 후보 선택 요구 0(두 형태 `||` 모두 차단) · matchReceiptToOrders wiring 창에 setSelectedOrderId 0 · 카피 참 — 주입 프로브 3종(① disabled 선택 강제 ② tx 밖 create ③ 번호 부재 감점) → 3/3 RED 실측(①은 1차 창 이탈 → 형제 형태 보강 후 검출)
- [x] 🟢 smart-receiving items[] additive(전건 사전 검증 → 트랜잭션 1회 · confirmedData 는 단품 전용으로 optional 화, 단품 검증 무회귀) · 모달 라인 테이블(포함 체크·수량 편집) · 후보 패널 = 다품목 모드만 근사 매칭 재랭킹(단일 모드 무회귀) · 발주 선택 = 옵션
- [x] 🔵 §11.309e 후속 주석 마감 · "다품목도 자동 인식됩니다" 카피 참이 됨(§8 리스크 해소)
- ✋ Gate: 등록 라인 수 = results 배열 계약 ✅ · 부분 실패 롤백(단일 트랜잭션) ✅ · 후보 자동 선택 0 ✅ · amber 0 · em dash 0(신규 문구 2건 자체 교정) · **잔여: 수동 smoke(다품목 명세서 1장, 호영님)**
- Rollback: smart-receiving 분기 revert(단품 경로 무접촉) — DDL 없음, 배포 순서 제약 없음

### Phase 3: 필드별 신뢰도 확인 화면 공통화 (G3) — ✅ 코드 완료 (2026-08-31)
- [x] 🔴 unit 6(`lib/ocr/recognized-field-marks.ts`): deriveFieldMarks — label-commit-gate **내부 호출**(중복 구현 0), 마크 verified|needs-confirm|ok|empty, critical 확장(quantity·catalogNo), 빈값 = 차단 아님, datamatrix verified 우회 승계
- [x] 🔴 sentinel 8(`recognized-fields-review.test.ts`): 마크 단일 소스 · blue/yellow·amber 0 · `bbox == null` = 원본 전체(하이라이트 지어내기 0, data-surface 2종) · 마운트 자동 확정 0 · canCommit 게이트 · 3 surface import · LabelScannerModal 무접촉 — 프로브 4종(①yellow→amber ②bbox 분기 제거 ③disabled 게이트 제거 ④마운트 confirm 주입) → 4/4 검출(대응 단언 5 RED)
- [x] 🟢 RecognizedFieldInput 공용 셀 신설 → 3 surface: COA 확인(REVIEW 내부)·배치 모달 COA 스텝(기존 P1 배선 유지)·SmartReceiving 단품 Lot·유효기한 + 다품목 수량 셀. coa-recognize 응답에 imageUrl 추가(원본 병기, bbox 는 null 유지 — 정직)
- [x] 🔵 구 UI 은퇴 표: SMART 인라인 lot/expiry Input·raw qty input 대체(별도 파일 아님 → importer 0 확인 대상 없음). sentinel 처분 — 309d `id="srm-*"`·exp-qc fieldMarks 리터럴 = **prop 리터럴로 보존(승계 불요, GREEN 실측)** · wiring `확인 필요` = 공용 셀 이관 승계 · P1(e) = deriveFieldMarks 재앵커 · P2 qty testid = testId prop 승계
- ✋ Gate: 3 surface 동일 컴포넌트 ✅ · 자동 확정 0 프로브 ✅ · em dash 0 ✅ · SmartReceiving 게이트 호출은 표면 잔존(wiring SMART 앵커 재앵커 최소화)
- Rollback: surface 별 revert

### Phase 4: 공급사별 템플릿 학습 (G4) — ✅ 완료 (2026-08-31 · DDL 선행 순서 준수)
- [x] §9 순서: SQL 상신 → 호영님 "진행" → **CLI `migrate deploy` 수 초 성공(directUrl 복구 실증) → status up to date(60)** → 그 뒤 GREEN 구현. push 는 적용 후.
- [x] 🔴 unit 5(`vendor-template.ts`): 보정 필드만 학습(ocr≠확정) · 앵커 ≤40자 · 원문에 없는 값 = 후보 0(지어내기 0) · 회차 정확도(1회차 학습→2회차 hit) · 힌트 shape 고정(source:"template" 후보일 뿐)
- [x] 🔴 sentinel 7(`vendor-template-learning.test.ts`): migration CREATE 3문·DROP/ALTER 0 · 학습은 확정 경로(inspect coa_ocr)에만 + 인식 라우트 쓰기 0 · templateHints 기본 on/off 무회귀 · 캐시 템플릿 버전 — 프로브 3종(①인식 라우트 학습 주입 ②플래그 가드 제거 ③source 위장) → 3/3 검출(대응 단언 4 RED)
- [x] 🟢 `VendorParseTemplate` + store(전부 best-effort 비차단) · inspect 확정 경로 학습 · runOcrPipeline 힌트 주입(놓친 필드만 채움 — 게이트가 확인 강제) · hits/lastUsedAt 통계
- [x] 🔵 캐시: templateVersion(max updatedAt) > 캐시 생성시각 → miss 취급(구캐시 오염 방지)
- [x] **실측 정정**: `/api/ocr/correct` 는 저장 placeholder(503) — §0 의 "보정 저장" 기술은 과대(정찰 오류). 학습 배선은 라이브 확정 경로만, correct 는 활성화 배치 예약 핀(sentinel)으로 잠금.
- ✋ Gate: 회차 정확도 실측 = unit 픽스처 2회차 hit ✅
- **P4-fix (2026-08-31 · 호영님 실측 지적)** — 유효 범위 정정:
  - 결함: 학습 입력을 `OcrResult.rawText` 로만 받았는데 Tier 1(Gemini)은 그 값이 **모델 JSON**이다(§8 리스크 신설). 앵커가 출력 스키마로 굳는 오학습 + 무효 힌트 경로였음.
  - 봉쇄(a): `inspect` 학습 게이트를 `finalResult.provider === "CLOUD_VISION_CLAUDE"` 로 한정 + 순수함수에서 JSON 형태·JSON 토큰 앵커 폐기. unit 2 · sentinel 1 추가, 프로브 3/3 검출.
  - **유효 범위 명시**: P4 는 **Tier 2(저신뢰 → Cloud Vision 폴백) 경로 한정**. Tier 1 high-confidence 주경로는 원문이 없어 학습·힌트 모두 skip — 정직하게 배우지 않는다.
  - 잔여: smoke 3(템플릿) 은 **Tier 2 를 태우는 저신뢰 스캔**에서만 의미 → (b) 채택 전까지 판정 보류.
- Rollback: 힌트 주입 플래그 off + 테이블 DROP(additive 라 기존 데이터 손실 0)

### Phase 5: Smoke / Rollback
- [ ] 프로젝트 러너 전체 GREEN + build
- [ ] 수동 smoke(호영님, prod 쓰기): COA 첨부→인식→확정→배지 · 명세서 다품목→등록→재고 라인 수 · 발주 없음=신규
- ✋ Gate: 회귀 0 · 자동 확정 0 · 이중 반영 0

## 8. Risks
| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| Gemini bbox 부재 → 하이라이트 불가 | High | Low | 조건부 하이라이트 + 원본 전체 병기(정직 표기) |
| OCR 비용·지연 증가 | Med | Med | imageHash 캐시 상속 · COA는 1회 인식 |
| P4 migration(prod DDL) | Med | High | 승인 게이트 · additive only · 실패 시 플래그 off |
| 라인 대조 오탐(품목명 표기 차이) | Med | Med | 경고만(차단 0) · 사람 확정 |
| 구 sentinel(배치 모달 §6 "인식 안 함") 충돌 | High | Low | P0 supersede 표 → 승계 재앵커 |
| P2 지연 시 `SmartReceivingScannerModal:457` "다품목도 자동 인식됩니다" 카피가 거짓으로 잔존 | Med | Low | P2 착수로 해소(카피 참) |
| **Tier 1(Gemini) `rawText` = 모델 JSON(문서 원문 아님)** — `gemini-label-parser.ts:183`·`gemini-quote-parser.ts:196` `rawText: jsonStr`. 그대로 학습하면 앵커가 `"lotNumber": "` 출력 스키마로 굳어 전 공급사 오학습 + 2회차 힌트는 파서가 이미 뽑은 값 반환(정확도 상승 0) | High | Med | **P4-fix(2026-08-31 호영님 실측)**: (a) 원문 축 분리로 봉쇄 — 학습은 `provider=CLOUD_VISION_CLAUDE`(실원문 `fullTextAnnotation.text`)에서만, JSON 형태·JSON 토큰 앵커는 순수함수에서도 폐기(defense-in-depth). prod 오염 0행 실측(smoke 전). **(b) Gemini 응답에 `documentText` 확보는 별건**(프롬프트·비용 변경) — 채택 시 P4 가치가 Tier 1 주경로까지 확장 |

## 9. Rollback
- P1~P3: 라우트/컴포넌트 revert(additive 계약) · P4: 플래그 off → DROP TABLE
- push 는 operator 세션 게이트 GREEN 후
- 🛑 **rollout 순서 규칙(2026-08-31 사고 신설)**: DDL 의존 코드는 **prod migrate deploy 완료 후 push**
  (또는 컬럼 미존재 내성 select). Prisma `include`는 전 컬럼 SELECT라 신 컬럼 코드가 먼저 배포되면
  해당 모델을 읽는 모든 표면이 즉시 500. P4 템플릿 테이블도 동일 순서.

## 10. Progress
- Overall ~90% · P0~P4 코드 ✅ (P1 `997443cc` · P2 `e3a84965`+`ce0ee4e4` · P3 `14ac1a9d` · P4 이번 커밋) · DDL 2건 전부 prod 적용·이력 정합 완료
- Next: **P5 = 수동 smoke(호영님)** — ① COA 첨부→인식→확인(원본 병기)→확정→배지 ② 다품목 명세서→라인 확인→일괄 등록→재고 라인 수 ③ COA 보정 1회 후 같은 서식 재인식(템플릿 hit) · 결과 회신로 배치 종결

## 11. Notes
- 2026-08-31: 계획 승인(G5 별건 제외). sandbox 정찰 기반 — operator 세션 P0에서 실측 재확인 후 착수.
- 2026-08-31 **P1 장애 창 기록**: `997443cc` push 17:50:35 KST → Vercel 자동 배포로 prod 입고
  표면(리스트·상세·검토 패널)이 `lotSource` 컬럼 부재 SELECT 실패 위험 창 개시. DDL 선행 순서
  결함(operator·검토 양쪽 놓침, §9 규칙 신설). **종료 19:34 KST** (창 ~1h44m · 호영님 "진행" 후
  DDL 3문 직접 적용). 완화 요인: 창 동안 대상 status 의 draft 행 0 (health 실측) — 실사용 노출 제한적.
  - 행 원인: `migrate deploy`·`migrate resolve` 등 **Prisma CLI 만 연결 행**(무출력 300s+,
    pg_stat_activity 에 세션 자체가 없음 = lock 아님). node PrismaClient(Session Pooler 5432)는
    즉시 연결 → DDL·이력 INSERT·health 전부 클라이언트 우회로 수행. CLI 연결 경로 결함은 별건 조사.
  - 이력 정합: `_prisma_migrations` 수동 INSERT(checksum `0ac9e7a6…`, applied_steps_count 1) —
    다음 deploy 가 재적용하지 않음. health: 동일 형태 findMany(include items) OK · API 401(정상 인증벽) · 랜딩 200.
