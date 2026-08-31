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

### Phase 2: 명세서 다품목 초안 + 근사 매칭 (G2)
- [ ] 🔴 unit: 근사 매칭 순수함수(공급사명 정규화 · 품목 토큰 Jaccard · 수량 ±20%) → 후보 순위 · PO 번호 있을 때만 대조 · 후보 0 = 신규 입고 경로
- [ ] 🔴 sentinel: smart-receiving `items[]` 트랜잭션 · 단품 호출부 무회귀 · 모달 라인별 수량 확인 UI · 연결 강제 0(후보 선택 없이 등록 가능)
- [ ] 🟢 smart-receiving 다품목 additive · 모달 review 스텝 라인 테이블(수량 편집) · 후보 패널(선택 = 옵션)
- [ ] 🔵 §11.309e 후속 주석 정리
- ✋ Gate: 다품목 등록 시 InventoryRestock 라인 수 = 확인 라인 수 · 부분 실패 시 롤백(트랜잭션) · 후보 자동 선택 0
- Rollback: smart-receiving 분기 revert(단품 경로 무접촉)

### Phase 3: 필드별 신뢰도 확인 화면 공통화 (G3)
- [ ] 🔴 unit: 필드 마크 파생(confidence + present + critical) — label-commit-gate fieldMarks 확장(catalogNo·quantity)
- [ ] 🔴 sentinel: 확신 blue / 불확실 yellow "확인 필요" · amber 0 · 원본 병기(bbox 있으면 하이라이트, 없으면 전체) · 확정 버튼 = canCommit 게이트
- [ ] 🟢 `recognized-fields-review.tsx` 공통 컴포넌트 → P1(COA)·P2(명세서)·SmartReceivingScannerModal 3 surface 교체
- [ ] 🔵 중복 리뷰 UI 제거
- ✋ Gate: 3 surface 동일 컴포넌트 · 자동 확정 0 프로브 · em dash 0
- Rollback: surface 별 revert

### Phase 4: 공급사별 템플릿 학습 (G4) — ⚠️ prod DDL
- [ ] 🔴 unit: 보정 diff → 템플릿 후보(fieldKey·앵커 문맥 추출) · 힌트 주입 시 우선 매칭 · hits 증가
- [ ] 🔴 sentinel: migration additive(CREATE TABLE만 · 기존 테이블/CHECK 무접촉) · 학습 저장은 확정 시점에만
- [ ] 🟢 `VendorParseTemplate` 모델 + migration · `/api/ocr/correct` 및 P1 확정 경로에서 학습 저장 · 파서 힌트 주입(runOcrPipeline 옵션)
- [ ] 🔵 캐시 키에 템플릿 버전 반영
- ✋ Gate: **migration 승인(호영님) 전 코드 착수 금지** · 회차 정확도 상승 실측(픽스처 2회차 비교)
- Rollback: 힌트 주입 플래그 off + 테이블 DROP(additive 라 데이터 손실 0)

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
| P2 지연 시 `SmartReceivingScannerModal:457` "다품목도 자동 인식됩니다" 카피가 거짓으로 잔존 | Med | Low | P2 미착수 확정 시 카피 정정 별건 배치(호영님 검토 코멘트 2026-08-31) |

## 9. Rollback
- P1~P3: 라우트/컴포넌트 revert(additive 계약) · P4: 플래그 off → DROP TABLE
- push 는 operator 세션 게이트 GREEN 후
- 🛑 **rollout 순서 규칙(2026-08-31 사고 신설)**: DDL 의존 코드는 **prod migrate deploy 완료 후 push**
  (또는 컬럼 미존재 내성 select). Prisma `include`는 전 컬럼 SELECT라 신 컬럼 코드가 먼저 배포되면
  해당 모델을 읽는 모든 표면이 즉시 500. P4 템플릿 테이블도 동일 순서.

## 10. Progress
- Overall ~30% · P0 ✅ · P1 코드 ✅(`997443cc`) · Current: P1 rollout 대기(prod migrate deploy + smoke) · Next: P2(다품목 초안)
- P1 rollout 4스텝: push ✅ → Vercel 배포 → operator `prisma migrate deploy`(DIRECT_URL 5432 · 호영님 "진행" 게이트) → smoke.
  ⚠️ DDL 적용 전 prod 에서 inspect PATCH 가 lotSource 컬럼을 쓰면 P2022 — 단, 신 컬럼은 COA 확정 경로에서만 전송되므로 구 흐름 무영향.

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
