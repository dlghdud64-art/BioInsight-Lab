# COMMIT drafts — §11.319 시약 라벨 스캔 + 가이드 프레임 (구 §11.314)

호영님 P1 (2026-05-29). Boundary A 확정. 클로드코드 환경에서 push.
아래 4개 커밋으로 분할 권장(phase 경계). 모두 footer 없음(Co-Authored-By 금지).

---

## 1) docs+test(plan): §11.319 Phase 0+1 #capture-quality — Truth Lock + 캡처 품질 휴리스틱 (호영님 P1, 2026-05-29)

**호영님 spec:** 라벨 인식 실패율을 가이드 프레임 + 입력 품질로 낮춘다. capture 품질과
OCR 추출 신뢰도를 분리(디버깅/로깅 의미 충돌 차단).

**Fix:**
- `apps/web/src/lib/ocr/capture-quality.ts` (신규) — `assessFrameQuality`(흐림=variance-of-Laplacian,
  조명=평균 휘도+클리핑 gating, alignment 비차단) + `captureConfidence`(0–1) + `overall`(good/warn/poor)
  + 한국어 `reasons[]` + `mapOcrConfidence`(OCR 신뢰도 별도, ≥0.85 high/≥0.6 medium). 플랫폼 무의존 순수 모듈.
- `apps/web/src/lib/ocr/__tests__/capture-quality.test.ts` (신규) — RED→GREEN 단위 테스트(22 단언).
- `docs/plans/PLAN_11.319-*.md` (신규) — Truth Lock + Boundary A + phase 계획.

**Canonical truth 보존:** capture 품질은 derived projection. OCR/입고 truth 미변경.
**Production effect:** 없음(신규 유틸 + 테스트, 미배선).
**Out of Scope:** OcrResult 영속화(§11.290 Phase 5), tilt 휴리스틱.
**Rollback:** 신규 파일 2개 revert.

---

## 2) feat(mobile): §11.319 Phase 2 #scan-ocr-label-mode — scan.tsx OCR 라벨 촬영 모드 + 신뢰도 재촬영 (호영님 P1 A안, 2026-05-29)

**호영님 spec (A안):** 모바일 = OCR 라벨 촬영 + OCR 추출 신뢰도 기반 재촬영(수동 캡처).
신규 dep 0. 가이드 프레임은 카메라 위 View 오버레이.

**Fix:**
- `apps/mobile/app/scan.tsx` — 바코드/라벨 모드 토글 추가. 라벨 모드: 가이드 프레임 + `takePictureAsync`
  → `scanLabel` → `mapOcrConfidence` 신뢰도 badge + 편집 폼 → 저신뢰 시 재촬영 권유(비차단) →
  매칭 재고 `lot-receive` / 미매칭 `purchases/register` prefill. 기존 바코드 wiring·5 액션 보존.
- `apps/mobile/hooks/useApi.ts` — `scanLabel(imageBase64)` helper + 타입(web `/api/inventory/scan-label` 재사용).
- `apps/mobile/lib/ocr/capture-quality.ts` (신규) — 웹 복제(+동기화 주석). 모바일은 `mapOcrConfidence` 사용.
- `apps/mobile/app/purchases/register.tsx` — catalogNumber/quantity/category prefill 수신(additive) + 카탈로그 입력.
- `apps/mobile/lib/analytics.ts` — `label_scan_*` 이벤트 추가.

**Canonical truth 보존:** scan-label(web) 재사용, 신규 store 0. lot/expiry 는 입고 단계 소관.
**Production effect:** 모바일 스캔 화면에 라벨 OCR 경로 추가. 바코드 경로 무변경.
**Out of Scope:** 모바일 실시간 흐림/조명 휴리스틱 + 자동캡처(후속 batch, 프레임 접근 dep 확보 시).
**Rollback:** scan.tsx OCR 모드 revert(바코드 그대로) + 4파일 additive revert.

---

## 3) feat(inventory): §11.319 Phase 3 #web-live-frame — LabelScannerModal 라이브 프레임 + 휴리스틱 게이트 (호영님 P1 A안, 2026-05-29)

**호영님 spec (A안):** 카메라/파일 토글(default 카메라, 파일 fallback 보존). 게이트 —
good=자동+수동+OCR / warn=수동+OCR(경고) / poor=차단+OCR 미호출("그래도 시도" 우회).
자동 캡처 default 수동.

**Fix:**
- `apps/web/src/components/inventory/LabelScannerModal.tsx` — (1) 카메라/파일 모드 토글 (2) getUserMedia
  라이브 `<video>` + 가이드 오버레이 + hidden canvas 캡처 (3) 64×64 다운샘플→luminance→`assessFrameQuality`
  400ms 분석→good/warn/poor 배지(reasons) (4) poor 촬영 disabled + "그래도 시도(OCR 강제)" (5) 자동 캡처
  토글 default off, good 연속 3프레임 트리거 (6) `mapOcrConfidence` review 배지 연결 (7) 스트림 cleanup.
  `processFile`→공유 `runScan(base64)` 추출. 파일피커·드래그드롭·텍스트·503 보정·재처리·badge 보존.
- `apps/web/src/__tests__/regression/reagent-label-scan-web-319.test.ts` (신규) — sentinel(32 단언, 회귀 포함).
- `apps/web/src/__tests__/regression/reagent-label-scan-mobile-319.test.ts` (신규) — 모바일 sentinel(39 단언).

**Canonical truth 보존:** scan-label 재사용. `보정 저장`/`재처리` 503-정직 유지(§11.290 Phase 5 미배선, 위장 0).
**Production effect:** 웹 라벨 스캔에 라이브 카메라 + 품질 게이트 추가. 기존 업로드/텍스트 경로 무변경.
**Out of Scope:** OcrResult 영속화 / retry provider-swap 실제 wiring(= §11.290 Phase 5).
**Rollback:** 웹 라이브 프레임 옵션 revert(파일피커 그대로).

---

## 4) test+docs(plan): §11.319 Phase 4 #closeout — 회귀 점검 + plan closeout (호영님 P1, 2026-05-29)

**Fix:**
- §11.290/315 cluster sentinel 회귀 0 확인(ConfidenceBadge·ProviderBadge·ocr-correct/retry testid·
  naming·"직접 등록" 주석 잔존). `PLAN_11.319-*.md` closeout 마킹.

**검증(호영님 env 필수):**
- `cd apps/web && npx vitest run src/lib/ocr/__tests__/capture-quality.test.ts \
  src/__tests__/regression/reagent-label-scan-mobile-319.test.ts \
  src/__tests__/regression/reagent-label-scan-web-319.test.ts`
- 기존 OCR cluster 회귀: `npx vitest run src/__tests__/regression`(290/308a/309/315 그린 확인)
- Next 빌드 + Expo 빌드(모바일 scan.tsx).

**Rollback (전체):** feature 단위 — 카메라/라벨 모드 비활성 시 기존 바코드(모바일)·파일피커(웹) 경로 복귀.
**Out of Scope (후속 batch):** §11.290 Phase 5(OcrResult 영속화), 모바일 실시간 휴리스틱, 바코드 결정적 인식 강화(ⓑ).
