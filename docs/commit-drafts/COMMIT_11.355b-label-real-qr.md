# COMMIT — §11.355-B 라벨 인쇄 실 QR (inv.id 인코딩) — 폐루프 물리적 완성

```
fix(inventory) §11.355-B #label-real-qr — 라벨 인쇄 가짜 바코드 → inv.id 인코딩 실 QR (스캔 가능), 미리보기=인쇄 일치 (호영님 보고: 라벨 QR 미출력)
```

## 호영님 보고 통증
- 라벨 QR 미출력 — 미리보기엔 QR 아이콘이 보이는데 실제 인쇄물엔 안 나옴 → 스캔 불가.

## 진단 (Phase 0)
- 폐루프(라벨→스캔→차감)의 서버/스캔/차감은 이미 작동: A(payload=inv.id), C(zxing+OCR 스캔), D(`/api/inventory/[id]/use` 차감)는 production-ready. **유일한 물리적 끊김 = 라벨 인쇄.**
- `LabelPrintModal.handlePrint` 가 인쇄 HTML에 QR 미삽입(`includeQR` dead toggle) + 바코드는 `||||||||` 가짜 파이프(inv.id 미인코딩 → 스캔 불가). `qrcode` lib(^1.5.4 설치됨)·`InventoryQRCode.tsx` 패턴 미사용.

## Fix (file 별, 의존성 0)
- `components/inventory/LabelPrintModal.tsx`:
  - `import QRCode from "qrcode"` + `escapeHtml` 헬퍼 + 공용 데모 시드 hoist.
  - **handlePrint async 化**: `QRCode.toDataURL(item.id)` 로 실 QR dataURL 생성 → 인쇄 HTML에 `<img class="qr">` 삽입. 가짜 `||||` 제거. `includeBarcode` 는 inv.id 텍스트(monospace, 수기/스캔 입력용)로 정직 대체. 모든 주입값 `escapeHtml`. QR 렌더 시간 확보 후 `print()`.
  - **미리보기 실 QR**: `qrPreviewMap` state + useEffect(`QRCode.toDataURL`)로 미리보기에도 실 QR img → **미리보기 = 인쇄 일치(dead toggle 해소)**.
- 신규 `__tests__/regression/label-print-real-qr-355b.test.ts`: sentinel(7).

## 검증 (vitest)
- label-print-real-qr-355b → **7 tests passed**. esbuild transform OK.

## ⚠️ 작업 중 (truncation 버그 재발)
- 미리보기 블록 편집이 파일 끝을 멀티바이트 경계에서 truncate → bash로 head -319 + HEAD 꼬리 복원 후 transform 재검증. **푸시 전 호영님 환경에서 파일 끝(LabelPrintContent export) 정상 확인 권장.**

## payload 정합 (폐루프)
- QR 인코딩값 = `inv.id`(cuid). `GET /api/inventory/scan?id=` 가 받는 바로 그 값 → 인쇄된 QR을 zxing 스캐너(scan/page.tsx)가 읽으면 재고로 귀결. **라벨↔스캔 물리적 연결 성립.**

## Canonical truth 보존
- DB/상태 변경 0(인쇄는 클라이언트 렌더). 규격·토글·인쇄 트리거 wiring 보존.

## Out of Scope (후속 슬라이스)
- 규격(폼텍/DYMO) 하드코딩 → 데이터화 + 연구소 기본값.
- 스캔 페이지(§11.349)에 "사용/차감" CTA 추가(GlobalQRScannerModal 패턴 재사용) — D 루프 UI 단편화 해소.
- 1D 바코드 실 렌더(jsbarcode 의존성 필요 — 보류, 현재 QR로 스캔 충족).

## Rollback path
- import/헬퍼/handlePrint/미리보기 4블록 revert. 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
