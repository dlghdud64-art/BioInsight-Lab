# Implementation Plan: §11.319 시약 라벨 스캔 + 가이드 프레임

- **Status:** ✅ Complete (Phase 0~4 GREEN, 호영님 env vitest/build 최종 확인 잔여)
- **Started:** 2026-05-29
- **Last Updated:** 2026-05-29
- **Estimated Completion:** 10~12h (Opus 4.8 권장)
- **구 번호:** §11.314 Part B
- **선행조건:** §11.317 / §11.320 / §11.321 종결 (✅ 충족)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 후:
1. ✅ 체크박스 갱신
2. 🧪 quality gate 명령 실행 (vitest sentinel + 회귀)
3. ⚠️ quality gate 전 항목 통과 확인
4. 📅 Last Updated 갱신
5. 📝 Notes 섹션 learnings 기록
6. ➡️ 통과 후에만 다음 phase

⛔ quality gate 실패 / source-of-truth conflict 미해소 상태로 진행 금지
⛔ dead button / no-op / placeholder success 도입 금지

---

## 0. Truth Reconciliation

### Latest Truth Source (repo 실증, 2026-05-29)
- `apps/mobile/app/scan.tsx` — **바코드/QR 전용** 스캐너. `lookupInventory(catalogNumber, productName)` 호출. 상태머신 scanning→looking→matched/unmatched/manual/error. **정적 가이드 프레임 존재**(흐림/조명 휴리스틱 없음). **OCR 라벨 촬영 경로 없음** (grep: mobile 에 `scan-label` 호출 0건).
- `apps/web/src/components/inventory/LabelScannerModal.tsx` — **OCR 라벨 스캔 플로우 존재**. `<input capture="environment">` OS 파일피커 사용(라이브 프레임 카메라 아님). 이미 보유: `ConfidenceBadge`(high/medium/low), `ProviderBadge`, `CacheHitIndicator`, `재처리`(retry) button, `보정 저장`(correct) button, 편집 가능 폼.
- `apps/web/src/app/api/inventory/scan-label/route.ts` — image→`runOcrPipeline`(Gemini), text→`parseReagentLabel`(regex fallback). `ocrMetadata{ jobId, providerUsed, cached }` 반환.
- `apps/web/src/lib/ocr/run-ocr-pipeline.ts` — confidence(numeric) + providerUsed + jobId 반환. **`STORAGE_PROVIDER` 미설정 시 `jobId=null`** (audit/cache 미생성, graceful fallback).
- `apps/web/src/app/api/ocr/correct/[jobId]/route.ts` — **503 게이트**: ① `STORAGE_PROVIDER` 미설정 503, ② env 설정돼도 step(5) placeholder 503 ("Phase 5 SDK install 후 별도 batch 에서 활성").

### Secondary References
- ADR-002-pilot-tenant-seed.md — "다음 트랙 §11.319 시약 라벨 스캔(구 §11.314)"
- `docs/plans/PLAN_11.290*` / `PLAN_smart-receiving-ai-phase-1.md` — OCR 멀티프로바이더 lineage
- `docs/plans/PLAN_11.308a-smart-receiving-entry.md` — 모바일 스캔 진입점

### Conflicts Found
- **[Conflict-1] 수동 보정 영속화 미작동:** §11.319 ⓐ 의 "수동 보정"이 `보정 저장`(OcrResult INSERT)을 의미하면 `/api/ocr/correct` 가 현재 503 placeholder → **no-op**. 이는 §11.290 Phase 5(STORAGE_PROVIDER env + 실제 INSERT wiring) 영역이며 §11.319 단독으로 닫히지 않음. ⚠️ §11.319 가 가이드 프레임을 붙여 입력 품질을 올린 뒤 `보정 저장` 으로 이어지면 dead button 노출 위험.
- **[Conflict-2] 모바일 OCR 경로 부재:** 모바일 "라벨 스캔"은 기존 바코드 스캐너(scan.tsx) 와 별개 — OCR 촬영 모드/화면이 없음. "모바일 먼저"는 곧 **신규 표면 추가**(오버레이 tweak 아님).

### Chosen Source of Truth (권장 — 호영님 확정 필요)
**Boundary A (권장):** §11.319 = 촬영 품질 레이어 + 신뢰도 노출 + 입고 prefill 로 흐르는 수동 보정. 즉
- IN: 라이브 프레임 카메라 + 가이드 오버레이 + 흐림/조명 휴리스틱 + 자동/수동 캡처 토글 + confidence badge 표면화 + 편집 폼이 **기존 작동 경로**(`onDirectReceive`/`onScanComplete` → 입고 prefill)로 연결.
- OUT(= §11.290 Phase 5): `OcrResult` INSERT 영속화, retry provider-swap 실제 wiring, `STORAGE_PROVIDER` env. 기존 `보정 저장`/`재처리` button 은 **503-정직 메시지 유지**, §11.319 는 이를 작동하는 것처럼 위장하지 않음.

> **Boundary B(대안):** §11.319 가 §11.290 Phase 5(env + SDK + INSERT)까지 흡수 → 12h 초과, env/SDK 의존. 권장하지 않음(별도 batch).

### Environment Reality Check
- [x] repo / branch context 이해 (monorepo: `apps/web` Next.js + `apps/mobile` Expo 55)
- [x] runnable: web `vitest` (sentinel readFileSync+regex), mobile 은 sentinel 위주(e2e 수동)
- [ ] **실행 blocker:** sandbox bash mount 불안정 — sentinel 은 호영님 환경/클코 환경에서 실행 확인 필요

---

## 1. Priority Fit

- [x] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why:** 호영님이 실제로 막혔던 사용자 가치 직결 기능(라벨 인식 품질). 선행 §11.317/§11.320/§11.321 종결. release-prep P1 잔여(vitest/prisma/MutationAuditEvent)는 인프라 정리라 §11.319 land 후 별도 batch(호영님 2026-05-29 결정).

---

## 2. Work Type
- [x] Feature
- [x] Mobile
- [x] Web
- [x] Design Consistency
- [ ] (그 외 해당 없음)

---

## 3. Overview

**Feature Description:** 시약 라벨 촬영 시 라이브 카메라에 사각형 가이드 프레임 오버레이를 띄우고, 흐림/조명 실시간 휴리스틱으로 입력 품질을 끌어올린 뒤, 추출 신뢰도 badge 와 필드별 수동 보정 UI 를 제공. 기존 Gemini OCR 파이프라인 재사용. 모바일(scan.tsx) 먼저 → 웹(LabelScannerModal) 이식.

**Success Criteria (A안 2026-05-29 확정 반영):**
- [x] 가이드 프레임 오버레이 (모바일: 카메라 위 View 오버레이 — 프레임 픽셀 접근 불필요)
- [x] 신뢰도 badge (OCR 추출 confidence 표면화, `mapOcrConfidence`)
- [x] 수동 보정 UI (AI 결과 필드별 수정 → 입고 prefill 로 전달)
- [x] 라이브 흐림/조명 실시간 휴리스틱 — **웹(Phase 3)** `capture-quality` getUserMedia 프레임 분석. good/warn/poor 게이트.
- [x] 자동 캡처 + 수동 캡처 토글 — **웹(Phase 3)** default 수동, 자동은 good 연속 3프레임 트리거.
- 모바일 재촬영 권유: OCR 추출 신뢰도(`mapOcrConfidence` low) 기반 비차단 안내 [x]

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] `OcrResult` INSERT 영속화 / `보정 저장` 실제 wiring (= §11.290 Phase 5)
- [ ] retry provider-swap 실제 동작 (= §11.290 Phase 5)
- [ ] 바코드 결정적 인식 강화 (= ⓑ, §11.310 입고 스캔과 후속 batch)
- [ ] 기울기(tilt) 휴리스틱 (후속 후보)
- [ ] **모바일 실시간 흐림/조명 휴리스틱 + 자동캡처** (= §11.319 후속 batch, 트리거: OCR 재촬영율 데이터 확인 후 / expo-camera 프레임 접근 dep 확보 시)
- [ ] `STORAGE_PROVIDER` env / SDK install

**User-Facing Outcome:** 시약 병 라벨을 흔들림/어두움 없이 프레임 안에 맞춰 촬영 → 인식률 상승 + 낮은 신뢰도 시 재촬영 권유 → 틀린 필드만 빠르게 보정 → 입고 등록.

---

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock
- [ ] same-canvas (모바일은 scan.tsx 내 모드 전환, 웹은 LabelScannerModal 내 step — 신규 페이지 0)
- [ ] canonical truth (OCR 결과/보정은 입고 커밋 시점에만 truth 반영)
- [ ] invalidation discipline

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] chatbot/assistant 재해석
- [ ] **dead button / no-op / placeholder success** (← Conflict-1: 보정 저장 위장 금지)
- [ ] preview 가 actual truth 덮기

**Canonical Truth Boundary:**
- Source of Truth: `Inventory`/`Product`(입고 커밋 결과) + (Phase 5 이후) `OcrJob`/`OcrResult`
- Derived Projection: confidence badge, 가이드 프레임 품질 점수, 추출 폼 값
- Snapshot / Preview: 촬영 이미지 미리보기, AI 추출 결과(커밋 전)
- Persistence Path: 편집 폼 → `onDirectReceive`/`onScanComplete` → 입고 prefill → 입고 API (기존 작동 경로). OcrResult 영속화는 OUT.

**UI Surface Plan:**
- [x] Existing route section — 모바일 `scan.tsx` 내 OCR 라벨 모드, 웹 `LabelScannerModal` 내 capture step
- [x] Bottom sheet — 웹 모바일뷰 기존 Sheet 유지
- [ ] New page (⚠️ 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 가이드 프레임 + 휴리스틱을 프레임워크 공유 로직(순수 함수)으로 추출 | 모바일/웹 중복 방지, 호영님 "한 번에" 요구 | RN/Web 카메라 API 차이로 어댑터 2개 필요 |
| 모바일: scan.tsx 에 "라벨 촬영" 모드 추가(별도 화면 아님) | same-canvas, page sprawl 방지 | 바코드 모드와 상태머신 분기 증가 |
| 웹: `capture` 파일피커 유지 + 라이브 프레임 옵션 추가 | 기존 경로 회귀 0, 점진 적용 | getUserMedia 권한 분기 추가 |
| 수동 보정은 입고 prefill 로만 흐름 | Conflict-1 회피(no-op 금지) | OcrResult audit 은 Phase 5 까지 미적용 |

**Dependencies:**
- Required Before Starting: 호영님 Boundary A/B 확정
- External Packages: 모바일 `expo-camera`(설치됨), 웹 `getUserMedia`(브라우저 내장). 신규 패키지 0 목표
- Touched: `apps/mobile/app/scan.tsx`, `apps/web/src/components/inventory/LabelScannerModal.tsx`, 신규 공유 `lib/ocr/capture-quality.ts`(휴리스틱 순수 함수)

**Integration Points:**
- `/api/inventory/scan-label` (기존, 변경 0 목표)
- `lookupInventory` hook (모바일 기존)
- 입고 prefill: `onDirectReceive` / `onScanComplete`

---

## 6. Global Test Strategy
- 휴리스틱(흐림/조명 점수, confidence 매핑) → **unit test 필수** (Red-Green-Refactor)
- UI(가이드 프레임/캡처 토글/badge/보정 폼) → **sentinel test**(readFileSync+regex, CLAUDE.md 패턴) + 회귀 0 블록
- 모바일 e2e 는 수동 QA(스펙 상 자동 미포함) — "실행 불가" 명시
- API 변경 없음 → 기존 `scan-label`/`ocr/correct` 회귀 테스트 그대로 PASS 유지

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete (단, **Conflict-1/2 해소 = Boundary 확정 대기**)
- 🔴 RED: 기존 스캔/OCR 계약·conflict 식별 → 완료
- 🟢 GREEN: source of truth + runnable 확인 → 완료(bash mount 불안정만 잔여)
- 🔵 REFACTOR: 스코프를 Boundary A 로 축소 제안
- ✋ Quality Gate: **Boundary A/B 호영님 확정 시 통과**
- Rollback: planning-only

### Phase 1: Capture Quality 휴리스틱 + Contract (RED→GREEN, 2~3h)
- Status: [x] GREEN 완료 (호영님 env vitest 최종 확인 대기)
- 🔴 RED: [x] `apps/web/src/lib/ocr/__tests__/capture-quality.test.ts` — 흐림(Laplacian 분산), 조명(평균 휘도+클리핑), captureConfidence, mapOcrConfidence 실패 테스트. RED 확정(MODULE_NOT_FOUND).
- 🟢 GREEN: [x] `apps/web/src/lib/ocr/capture-quality.ts` 순수 함수 구현(흐림/조명 gating + alignment 비차단 + captureConfidence + mapOcrConfidence 분리). node strip-types 하네스 22/22 통과.
- 🔵 REFACTOR: [x] 임계값 상수화(DEFAULTS/GOOD_BLUR_VARIANCE/IDEAL_LUMINANCE), naming 정리, 복제 동기화 주석.
- ✋ Quality Gate: 단위 테스트 GREEN(하네스 22/22 ✓) / 기존 테스트 PASS — **실행 불가(sandbox rollup native binary 불일치)** → 호영님 env `npx vitest run` 확인 / lint·typecheck — 호영님 env 확인 권장. DOM·RN import 0(순수 모듈) ✓
- Rollback: 신규 lib 파일 + 테스트 revert

### Phase 2: 모바일 라벨 촬영 모드 (RED→GREEN, 3~4h)
- Status: [x] GREEN 완료 (호영님 env 빌드/QA 확인 대기)
- 🔴 RED: [x] `apps/web/src/__tests__/regression/reagent-label-scan-mobile-319.test.ts` — scan.tsx OCR 모드/토글/촬영/신뢰도/재촬영/편집폼/prefill + capture-quality 복제 + scanLabel + register prefill + 회귀(바코드 보존). 논리적 RED 확정.
- 🟢 GREEN: [x] (1) `apps/mobile/lib/ocr/capture-quality.ts` 복제(+sync 주석) (2) `useApi.ts` scanLabel helper + 타입 (3) `scan.tsx` 바코드/라벨 모드 토글 + takePictureAsync → scanLabel → 신뢰도 badge + 편집 폼 + 저신뢰 재촬영 권유 + 입고 prefill(register/lot-receive) (4) `register.tsx` catalogNumber/quantity/category prefill(additive) + 카탈로그 입력 (5) `analytics.ts` label_scan_* 이벤트. sentinel 하네스 39/39 통과.
- 🔵 REFACTOR: [x] 바코드/라벨 상태머신 분기 정리, 불필요 `as never` 제거, same-canvas(신규 화면 0) 유지.
- ✋ Quality Gate: sentinel 39/39 ✓ / 바코드 경로 회귀 0(handleBarCodeScanned·lookupInventory·barcodeScannerSettings·5 액션 보존) ✓ / 권한 거부 fallback 존재 ✓ / dead button·no-op 0(실 라우팅+실 mutation) ✓ / 빌드·typecheck·QA — **호영님 env 확인 권장**(sandbox Expo build 불가)
- Rollback: scan.tsx OCR 모드 revert(바코드 모드 그대로), 4파일 additive revert
- Touched: `apps/mobile/app/scan.tsx`, `apps/mobile/hooks/useApi.ts`, `apps/mobile/lib/ocr/capture-quality.ts`(신규), `apps/mobile/app/purchases/register.tsx`, `apps/mobile/lib/analytics.ts`, `apps/web/src/__tests__/regression/reagent-label-scan-mobile-319.test.ts`(신규)

### Phase 3: 웹 라이브 프레임 이식 + 공유 (RED→GREEN, 2~3h)
- Status: [x] GREEN 완료 (호영님 env vitest/build 확인 대기)
- 🔴 RED: [x] `apps/web/src/__tests__/regression/reagent-label-scan-web-319.test.ts` — getUserMedia/가이드/휴리스틱 게이트/모드 토글/자동캡처 + 회귀(파일피커·드래그드롭·텍스트·503 보정·badge) sentinel. 논리적 RED.
- 🟢 GREEN: [x] `LabelScannerModal` — (1) 카메라/파일 모드 토글(default 카메라) (2) getUserMedia 라이브 `<video>` + 가이드 오버레이 + hidden canvas 캡처 (3) 64×64 다운샘플 → luminance → `assessFrameQuality` 400ms 분석 → good/warn/poor 배지 (4) 게이트: poor 시 촬영 disabled + "그래도 시도(OCR 강제)" 우회 (5) 자동 캡처 토글 default off, good 연속 3프레임 트리거 (6) `mapOcrConfidence` review badge 연결 (7) 스트림 cleanup(getTracks().stop). 파일피커/드래그드롭/텍스트/503 보정 보존. sentinel 32/32.
- 🔵 REFACTOR: [x] `processFile` → 공유 `runScan(base64)` 추출(파일/카메라 공통), 휴리스틱 단일 소스.
- ✋ Quality Gate: sentinel 32/32 ✓ / 기존 업로드·텍스트 경로 회귀 0 ✓ / dead button 0(poor 우회 링크·자동 default off·카메라 오류 시 파일 fallback) ✓ / loading·error·empty·cameraError·저신뢰 상태 존재 ✓ / build·typecheck — 호영님 env 확인 권장
- Rollback: 웹 라이브 프레임 옵션 revert(파일피커 그대로)
- Touched: `apps/web/src/components/inventory/LabelScannerModal.tsx`, `apps/web/src/__tests__/regression/reagent-label-scan-web-319.test.ts`(신규)

### Phase 4: Smoke / Rollback / Closeout (1~2h)
- Status: [x] 완료 (호영님 env vitest/build 최종 확인 잔여)
- 🔴 RED: [x] rollout 실패 모드(카메라 권한 거부·미지원·저조도·저신뢰) + smoke path 정의
- 🟢 GREEN: [x] 기존 §11.290/315 cluster sentinel 회귀 0 확인(ConfidenceBadge·ProviderBadge·ocr-correct/retry testid·naming·"직접 등록" 주석 잔존) / 모바일·웹 smoke path 정의 / COMMIT draft 4건
- 🔵 REFACTOR: [x] 임시 계측 0, plan closeout
- ✋ Quality Gate: 회귀 0 ✓ / rollback 문서화 ✓ / 잔여 blocker(=§11.290 Phase 5) 격리 ✓ / sandbox vitest·build 실행 불가 → 호영님 env 확인
- Rollback: 카메라/라벨 모드 feature 비활성 → 기존 바코드(모바일)·파일피커(웹) 경로 복귀

### Smoke Path (호영님 env QA)
- 모바일: scan.tsx → "라벨 촬영" 토글 → 촬영 → 신뢰도 badge → (저신뢰 시 재촬영 권유) → 편집 → 매칭 재고면 lot-receive, 아니면 register prefill
- 웹: 재고 → AI 라벨 스캔 → 카메라 모드 → good/warn/poor 배지 → (poor면 촬영 disabled + "그래도 시도") → 촬영 → review 폼 → 입고 prefill. 파일 업로드/텍스트 경로 정상.
- 권한 거부: 모바일 수동 검색 / 웹 "파일 업로드로 전환" fallback.

### 검증 명령 (호영님 env)
```
cd apps/web
npx vitest run src/lib/ocr/__tests__/capture-quality.test.ts \
  src/__tests__/regression/reagent-label-scan-mobile-319.test.ts \
  src/__tests__/regression/reagent-label-scan-web-319.test.ts
npx vitest run src/__tests__/regression   # 290/308a/309/315 회귀 그린
```
sandbox: capture-quality 하네스 22/22, 모바일 sentinel 39/39, 웹 sentinel 32/32 (정규식 직접 실행). vitest 풀 실행은 sandbox rollup 네이티브 바이너리 불일치로 실행 불가.

### 변경 매니페스트
- M `apps/mobile/app/scan.tsx`, `hooks/useApi.ts`, `lib/analytics.ts`, `app/purchases/register.tsx`, `apps/web/.../LabelScannerModal.tsx`
- A `apps/mobile/lib/ocr/capture-quality.ts`, `apps/web/src/lib/ocr/capture-quality.ts`(+__tests__), `apps/web/.../regression/reagent-label-scan-{mobile,web}-319.test.ts`, `docs/plans/PLAN_11.319-*.md`, `docs/commit-drafts/COMMIT_11.319-*.md`

---

## 8. Optional Addenda

### D. Mobile Addendum
- route/stack: `apps/mobile/app/scan.tsx` 내 모드(신규 화면 아님)
- permission: `useCameraPermissions` 기존 분기 재사용 + 거부 시 수동 입력 fallback(기존 존재)
- offline/sync: 촬영 이미지 업로드 실패 시 regex/텍스트 fallback + 재시도
- iOS/Android: NSCameraUsageDescription 기설정("시약 및 장비 사진 촬영")
- Validation:
  - [ ] 권한 거부 dead end 없음(수동 검색 경로 유지)
  - [ ] 카메라 미지원/실패 시 blank screen 없음
  - [ ] 저신뢰 시 재촬영 권유 노출
  - [ ] 입고 prefill destination 정확 동작

---

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 보정 저장 no-op 노출(Conflict-1) | Med | High | Boundary A 고정, 503-정직 유지, 입고 prefill 로만 보정 흐름 |
| 모바일/웹 카메라 API 차이로 휴리스틱 분기 | High | Med | 순수 함수 공유 + 플랫폼 어댑터 2개 |
| 흐림/조명 휴리스틱 오탐(정상인데 재촬영 권유) | Med | Med | 임계값 보수적, 경고는 비차단(촬영 강행 허용) |
| 12h 초과(양쪽 동시) | Med | Med | 모바일 우선 land 후 웹 이식, Phase 분리 |
| Gemini confidence 의미 불일치(regex vs Gemini) | Low | Med | Phase 1 에서 numeric→badge 매핑 단일화 |

---

## 10. Rollback Strategy
- Phase 1 실패: 신규 lib + 테스트 revert
- Phase 2 실패: scan.tsx OCR 모드 revert(바코드 보존)
- Phase 3 실패: 웹 라이브 프레임 옵션 revert(파일피커 보존)
- Phase 4 실패: 가이드 프레임/라이브 캡처 feature 비활성 → 기존 경로 복귀

---

## 11. Progress Tracking
- Overall completion: 100% (Phase 0~4 GREEN, 호영님 env vitest/build 최종 확인 잔여)
- Current phase: closeout — 호영님 env vitest/build + 실기기 QA
- Current blocker: 없음 (참고: §11.290 Phase 5 = OcrResult 영속화는 OUT, 후속 batch)
- Next validation step: 호영님 env `npx vitest run`(capture-quality + mobile-319 + web-319 + 회귀 cluster) + Next/Expo 빌드 → push

**확정 사항(2026-05-29):**
- Boundary A 확정 (캡처 품질 IN / OcrResult 영속화 OUT)
- 공유 방식 1 확정 (apps/web 구현 + 모바일 복제 + 동기화 주석)
- 시그니처 확정 (captureConfidence ↔ mapOcrConfidence 분리, overall 3단계)
- A안 확정 (모바일=OCR 신뢰도 기반 재촬영+수동캡처 / 라이브 흐림·조명+자동캡처=웹 우선 / 모바일 실시간 휴리스틱=후속 batch)

**Phase Checklist:**
- [x] Phase 0 complete (conflict 해소 = Boundary A)
- [x] Phase 1 complete (GREEN, env vitest 확인 잔여)
- [x] Phase 2 complete (GREEN, env 빌드/QA 확인 잔여)
- [x] Phase 3 complete (GREEN, env vitest/build 확인 잔여)
- [x] Phase 4 complete (회귀 0, closeout, env 확인 잔여)

---

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-05-29] sandbox bash mount 불안정(oneshot RPC 충돌) → sentinel 은 호영님/클코 환경 실행 권장
- [2026-05-29] Conflict-1: `보정 저장` 503 placeholder → §11.290 Phase 5 의존 → Boundary A 로 회피

**Implementation Notes:**
- 웹은 confidence badge / provider badge / 보정 폼 이미 보유 → §11.319 의 웹 신규분은 주로 "라이브 프레임 캡처 + 휴리스틱"
- 모바일은 OCR 라벨 경로 자체가 신규 → 공수 무게중심은 모바일(Phase 2)
- 가이드 프레임은 모바일 바코드용이 이미 존재(정적) → 휴리스틱 점수/안내가 신규 부가가치
