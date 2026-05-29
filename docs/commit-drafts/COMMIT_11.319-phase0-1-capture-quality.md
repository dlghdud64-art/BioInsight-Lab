docs+test(plan): §11.319 Phase 0+1 #capture-quality — Truth Lock + 캡처 품질 휴리스틱 (호영님 P1, 2026-05-29)

호영님 spec (Boundary A 확정): 라벨 인식 실패율을 가이드 프레임 + 입력 품질로 낮춘다.
capture 품질과 OCR 추출 신뢰도를 분리(디버깅/로깅 의미 충돌 차단).

Fix:
- apps/web/src/lib/ocr/capture-quality.ts (신규) — assessFrameQuality(흐림=variance-of-Laplacian,
  조명=평균 휘도+클리핑 gating, alignment 비차단) + captureConfidence(0-1) + overall(good/warn/poor)
  + 한국어 reasons[] + mapOcrConfidence(OCR 신뢰도 별도, >=0.85 high/>=0.6 medium). 플랫폼 무의존 순수 모듈.
- apps/web/src/lib/ocr/__tests__/capture-quality.test.ts (신규) — RED->GREEN 단위 테스트(22 단언).
- docs/plans/PLAN_11.319-reagent-label-scan-guide-frame.md (신규) — Truth Lock + Boundary A + phase 계획.

canonical truth 보존: capture 품질은 derived projection. OCR/입고 truth 미변경.
production effect: 없음(신규 유틸 + 테스트, 미배선).
Out of Scope: OcrResult 영속화(§11.290 Phase 5), tilt 휴리스틱.
Rollback: 신규 파일 2개 revert.
