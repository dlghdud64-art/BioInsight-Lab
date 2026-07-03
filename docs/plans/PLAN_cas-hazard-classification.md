# Implementation Plan: CAS 기반 위험분류 (전량 "일반" 오도 해소)

- **Status:** 🔄 In Progress
- **Started:** 2026-07-04
- **Last Updated:** 2026-07-04 (P4)
- **Feature ID:** §cas-hazard-classification

**CRITICAL INSTRUCTIONS**: 각 phase 완료 시 (1) 체크박스 갱신 (2) quality gate 검증 (3) Last Updated 갱신 (4) Notes 기록 후에만 다음 phase.

⛔ quality gate 실패·source-of-truth 충돌·dead button/no-op/placeholder success 도입 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** repo 코드 실측 (2026-07-04 조사).

**조사 결과:**
- Product 스키마에 `cas` 필드 **없음**. OCR(claude-structurer·gemini-label-parser)은 `casNumber` 추출하나 저장할 필드 없어 폐기.
- `hazardCodes`(Json), `pictograms`(Json) 필드는 존재하나 seed·입고 어디서도 미채움 → 기존 100종 전량 빈 값.
- 안전페이지 어댑터(`lib/safety/product-to-safety-item.ts`)가 `hazardCodes.length>0 ? HIGH : pictograms.length>0 ? MEDIUM : LOW` 조잡 파생 + 입력 공백 → 전량 LOW="일반".
- **재사용 자산:** `lib/utils/safety-visualization.ts`의 `getSafetyLevelFromHazardCodes`(critical/highRisk H-code 셋) 존재·미사용. `lib/ai/safety-extractor.ts`가 MSDS 텍스트→H코드 추출(OpenAI) 존재.
- **빈 고리:** CAS→GHS(H코드) 매핑 전무.

**Chosen Source of Truth:** canonical = `Product.hazardCodes`. `level` = 파생(projection). `casNo` = 신규 저장 필드.

**Conflicts:** 호영님 초기 프레이밍("CAS→GHS 분류만")은 CAS 저장·기존분 입력 공백을 전제하지 않음 → 3층(저장·분류·backfill)으로 재정의. 승인 완료.

**Environment Reality Check:**
- [x] repo/branch 확인
- [x] sandbox: 순수함수·sentinel 검증 가능 / migration·build push는 클로드코드
- [x] prod DB migration = 호영님 dry-run→승인 게이트 (sandbox 실행불가)

## 1. Priority Fit
Post-release 데이터 정합 (P2 상단). 규제 착시가 화면에 상존 → defer 비권장. prod migration 포함.

## 2. Work Type
- [x] Feature (분류) + Migration (casNo) + Design Consistency (미분류 상태)

## 3. Overview

**결정 사항 (호영님 2026-07-04):**
- 분류 소스 = **정적 큐레이션 테이블** (외부 API 미사용, 결정적·감사가능).
- 기존 100종 backfill = **MSDS 업로드 시 자동추출** (기존 safety-extractor 배선, organic).

**Success Criteria:**
- [ ] 신규 입고: OCR CAS → casNo 저장 → 정적표 → hazardCodes → level 자동
- [ ] MSDS 업로드: safety-extractor → hazardCodes → level backfill
- [ ] 분류 안 된 물질 = "미분류(unknown)" 정직 표기 (LOW="일반" 오도 금지)
- [ ] 어댑터가 canonical `getSafetyLevelFromHazardCodes` 사용 + CAS 표시
- [ ] level = hazardCodes 파생 단일화 (조잡 파생 제거)

**Out of Scope (⚠️ 구현 금지):**
- [ ] PubChem 등 외부 API 조회
- [ ] 재-OCR 라벨 배치 재분석
- [ ] 수기 CAS 입력 큐
- [ ] pictogram UI 재디자인 / AI chatbot

**User-Facing Outcome:** 위험물질이 실제 등급(고위험/주의)으로 표시되고, 분류 안 된 건 "미분류"로 정직하게 구분됨.

## 4. Product Constraints

**Must Preserve:** same-canvas 안전페이지 · canonical(hazardCodes) · 단일 실 등록 경로(POST /api/products/[id]/sds) · workbench 구조.

**Must Not Introduce:** page-per-feature · chatbot · dead button/no-op · **LOW="일반"이 미분류를 덮는 착시** · preview가 truth 대체.

**Canonical Truth Boundary:**
- Source of Truth: `Product.hazardCodes` (+ `casNo`)
- Derived Projection: `level` (getSafetyLevelFromHazardCodes)
- Snapshot/Preview: 안전페이지 SafetyItem (adapter 출력)
- Persistence Path: 입고/생성 mutation · POST /api/products/[id]/sds

**UI Surface Plan:** [x] Existing route section (안전페이지·단일 등록 모달) — 신규 페이지 없음.

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| 정적 CAS→GHS 테이블 | 결정적·감사가능·오프라인, 규제 안전 | 커버리지 한정(미수록→미분류) |
| level = hazardCodes 파생 단일 | canonical 단일화, 두 피더 무충돌 | 어댑터 조잡 파생 제거 필요 |
| 미분류 상태 신설 | LOW="일반" 착시 제거(정직) | SafetyLevel 확장 파급 |
| MSDS 업로드 backfill | 기존 extractor 재사용, Track B와 결합 | OpenAI 키 의존(없으면 실행불가) |

**Touched:** prisma schema(Product) · lib/safety/product-to-safety-item.ts · lib/utils/safety-visualization.ts · lib/ai/safety-extractor.ts · api/products/[id]/sds route · 입고/생성 mutation · lib/ocr.

## 6. Global Test Strategy
- 순수함수(classifyByCas, level 파생) → 단위테스트 (sandbox Node strip-types 가능)
- adapter 교체 → sentinel(readFileSync+regex) + 단위
- migration/route → 통합은 sandbox "실행 불가" 표기, 클로드코드 build 게이트
- 미분류 정직표기 → sentinel(LOW≠미분류 강제)

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete
🔴 진실·충돌 식별 → 🟢 canonical 확정 → 🔵 스코프 축소(정적표+MSDS backfill)
✋ Gate: 충돌 해소·우선순위 기록 완료. Rollback: planning-only.

### Phase 1: 스키마 + 실패테스트
- Status: [x] Complete
🔴 casNo/미분류 부재 실패테스트 → 🟢 migration `Product.casNo String?` + SafetyLevel unknown 추가 → 🔵 네이밍 정리
✋ Gate: 기존테스트 GREEN, migration dry-run 보고, sandbox "실행불가" 표기. Rollback: migration down + 타입 revert.

### Phase 2: 정적 CAS→GHS 테이블 + classifyByCas
- Status: [x] Complete
🔴 classifyByCas 단위테스트(대표 CAS: 7647-14-5 등) → 🟢 cas-ghs-table.ts + classifyByCas + level 결합 → 🔵 DRY
✋ Gate: 단위 GREEN, 미수록 CAS→unknown 반환, truth 경계 무위반. Rollback: lib 파일 제거.

### Phase 3: 배선 (P3a 읽기 + P3b 입고쓰기 완료 / P3c MSDS backfill 별도 트랙)
- Status: [x] Complete (P3a+P3b) · P3c deferred
🔴 통합/센티넬 실패테스트 → 🟢 ①입고 casNo+CAS분류 ②MSDS업로드 extractor backfill ③어댑터 canonical level·CAS 표시 → 🔵 same-canvas 유지
✋ Gate: dead button/no-op 0, front-only success 0, loading/error/미분류 상태 존재. Rollback: 배선 revert.

### Phase 4: Smoke / Rollback
- Status: [x] Complete (delivered scope)
🔴 실패모드·smoke 경로 정의 → 🟢 신규분류 1 + backfill 1 + 미분류 정직표기 확인 → 🔵 정리
✋ Gate: build+sentinel GREEN, rollback 문서화. Rollback: migration/배선 단계별 revert.

## 8. Addenda
**Workflow/Ontology (안전):** resolver 입력=hazardCodes/casNo, 출력=level/미분류. dashboard 약한 신호, 안전route 강한 신호. chatbot 금지.

## 9. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 정적표 미수록 CAS | High | Med | "미분류" 정직표기, 일반 오도 금지, 표 점진 확장 |
| prod migration 사고 | Low | High | 클로드코드 dry-run→echo→"진행" 게이트, sandbox 미실행 |
| OpenAI 키 부재 | Med | Med | backfill "실행불가" 정직 처리, CAS 경로는 독립 작동 |
| 미분류 착시 잔존 | Med | High | sentinel로 LOW≠미분류 강제 |

## 10. Rollback Strategy
- P1 실패: migration down + casNo/unknown 타입 revert
- P2 실패: cas-ghs-table.ts·classifyByCas 제거
- P3 실패: 입고/route/어댑터 배선 revert (schema 유지 가능)
- P4 실패: 배선 비활성 fallback

## 11. Progress Tracking
- Overall: 90% (P1·P2·P3a·P3b·P4 완료 / P3c=MSDS backfill deferred)
- Current phase: 커밋 대기 (operator build+migration)
- Next: 커밋·push·migration apply → (선택) P3c

**Phase Checklist:**
- [x] Phase 0
- [x] Phase 1
- [x] Phase 2
- [x] Phase 3 (P3a+P3b; P3c deferred)
- [x] Phase 4

## 12. Notes & Learnings
- [2026-07-04] 근접원인 = 분류로직 부재가 아니라 **입력(CAS·hazardCodes) 공백 + 조잡 파생**. 재사용 자산(safety-visualization·safety-extractor) 확인.
- 결정: 정적표 + MSDS backfill (호영님 2026-07-04).

## P4 검증 결과 (2026-07-04)
- **무결성:** 변경 13파일 NUL 0, tail 정상.
- **회귀 grep 0:** HIGH_RISK_PICTOS 잔존 0 · adapter `cas:""` 0 · risk badge yellow 0 · safety "일괄 등록" 0(Track A 유지).
- **로직(Node strip-types):** classifier 21/21 · adapter 진리표 7/7 · helper 6/6 · 기존 adapter 테스트 호환 6/6.
- **sentinel(node fs+regex):** P1 6/6 · P3 13/13 · P3b 8/8. (vitest sandbox 미설치 → 클로드코드 build 게이트에서 실행.)

## Smoke Path (operator, migration apply 후)
1. `prisma migrate deploy`(casNo) → `prisma generate` → `pnpm --filter web build` EXIT 0.
2. 신규 입고(스캔): 라벨에 CAS 있는 위험시약(예 HCl) 입고 → 안전페이지 해당 품목 "고위험" 표시.
3. 기존 100종: 여전히 "미분류"(일반 아님) 표기 확인 — 착시 해소.
4. CAS 없는/미수록 신규 입고 → "미분류" 표기(오분류 없음).

## Rollback
- P3b/P3a: 배선 커밋 revert (schema/classifier 유지 가능).
- P2: cas-ghs-table.ts / product-hazard-fields.ts 제거.
- P1: `DROP COLUMN "casNo"` + migration 폴더 제거 + 타입 revert.

## Deferred — P3c (② MSDS backfill)
기존 100종을 MSDS 업로드 시 safety-extractor(PDF→텍스트→OpenAI)로 hazardCodes backfill. OPENAI_API_KEY 의존 → 별도 트랙. 현 딜리버로도 신규분류 + 정직한 미분류는 완결.
