feat(inventory): §11.319 Phase 3 #web-live-frame — LabelScannerModal 라이브 프레임 + 휴리스틱 게이트 (호영님 P1 A안, 2026-05-29)

호영님 spec (A안): 카메라/파일 토글(default 카메라, 파일 fallback 보존). 게이트 —
good=자동+수동+OCR / warn=수동+OCR(경고) / poor=차단+OCR 미호출("그래도 시도" 우회).
자동 캡처 default 수동.

Fix:
- apps/web/src/components/inventory/LabelScannerModal.tsx — (1) 카메라/파일 모드 토글(uploadMode)
  (2) getUserMedia 라이브 video + 가이드 오버레이 + hidden canvas 캡처 (3) 64x64 다운샘플 ->
  luminance -> assessFrameQuality 400ms 분석 -> good/warn/poor 배지(reasons) (4) poor 촬영
  disabled + "그래도 시도(OCR 강제)" (5) autoCapture 토글 default off, good 연속 3프레임 트리거
  (6) mapOcrConfidence review 배지 연결 (7) 스트림 cleanup.
  파일피커·드래그드롭·텍스트·503 보정·재처리·badge 보존.
- apps/web/src/__tests__/regression/reagent-label-scan-web-319.test.ts (신규) — sentinel(32 단언, 회귀 포함).
- apps/web/src/__tests__/regression/reagent-label-scan-mobile-319.test.ts (신규) — 모바일 sentinel(39 단언).

canonical truth 보존: scan-label 재사용. 보정 저장/재처리 503-정직 유지(§11.290 Phase 5 미배선, 위장 0).
production effect: 웹 라벨 스캔에 라이브 카메라 + 품질 게이트 추가. 기존 업로드/텍스트 경로 무변경.
Out of Scope: OcrResult 영속화 / retry provider-swap 실제 wiring(= §11.290 Phase 5).
Rollback: 웹 라이브 프레임 옵션 revert(파일피커 그대로).
