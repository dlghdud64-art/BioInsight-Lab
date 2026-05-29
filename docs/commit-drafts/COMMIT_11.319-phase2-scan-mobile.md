feat(mobile): §11.319 Phase 2 #scan-ocr-label-mode — scan.tsx OCR 라벨 촬영 모드 + 신뢰도 재촬영 (호영님 P1 A안, 2026-05-29)

호영님 spec (A안): 모바일 = OCR 라벨 촬영 + OCR 추출 신뢰도 기반 재촬영(수동 캡처).
신규 dep 0. 가이드 프레임은 카메라 위 View 오버레이.

Fix:
- apps/mobile/app/scan.tsx — 바코드/라벨 모드 토글 추가. 라벨 모드: 가이드 프레임 +
  takePictureAsync -> scanLabel -> mapOcrConfidence 신뢰도 badge + 편집 폼 -> 저신뢰 시
  재촬영 권유(비차단) -> 매칭 재고 lot-receive / 미매칭 purchases/register prefill.
  기존 바코드 wiring·5 액션 보존.
- apps/mobile/hooks/useApi.ts — scanLabel(imageBase64) helper + 타입(web /api/inventory/scan-label 재사용).
- apps/mobile/lib/ocr/capture-quality.ts (신규) — 웹 복제(+동기화 주석). mapOcrConfidence 사용.
- apps/mobile/app/purchases/register.tsx — catalogNumber/quantity/category prefill 수신(additive).
- apps/mobile/lib/analytics.ts — label_scan_* 이벤트 추가.

canonical truth 보존: scan-label(web) 재사용, 신규 store 0. lot/expiry 는 입고 단계 소관.
production effect: 모바일 스캔 화면에 라벨 OCR 경로 추가. 바코드 경로 무변경.
Out of Scope: 모바일 실시간 흐림/조명 휴리스틱 + 자동캡처(후속 batch).
Rollback: scan.tsx OCR 모드 revert(바코드 그대로) + 4파일 additive revert.
