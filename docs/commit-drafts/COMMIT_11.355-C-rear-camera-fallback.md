# COMMIT — §11.355-C: 후면 카메라 4단계 fallback (LabelScannerModal)

```
feat(inventory) §11.355-C #rear-camera-fallback — 라벨 스캐너 후면 카메라 획득을 단일 시도→4단계 fallback(공통 getRearCameraStream)으로 강화
```

## 무엇 (§11.355-C — plan f69e9bd 구현, §11.349 묶음)
- `LabelScannerModal` 카메라 획득(L441) = `getUserMedia({ video: { facingMode: "environment" } })` **단일 시도, fallback 0**.
  - 일부 기기/브라우저에서 후면 미획득 또는 전면 강등 → 실패 시 즉시 "파일 업로드" 안내로 강등.
- scan/page(@zxing)는 이미 enumerate 후면 탐색 보유, QRScanner(html5-qrcode)는 자체 exact→loose 2단계 보유 → **이번 범위는 fallback 최빈약한 LabelScannerModal**.

## Fix
- 신규 공통 util `lib/utils/get-rear-camera-stream.ts` — `getRearCameraStream()`:
  1. exact environment (후면 강제)
  2. environment loose (구형 호환)
  3. enumerateDevices → 후면 label(`back|rear|environment|후면`) deviceId exact
  4. video:true 최후 (완전 실패보다 나음)
- `LabelScannerModal`: 직접 단일 getUserMedia → `getRearCameraStream()` 호출로 교체.
- 권한 거부 시 catch → 기존 "파일 업로드로 진행" 안내 **보존**. `capture="environment"` 파일 input fallback 보존.

## canonical truth
- 카메라 백엔드/스캔 파이프라인 변경 0. 스트림 획득 성공률만 향상(후면 우선 단계화).

## 검증
- sentinel `rear-camera-fallback-355c.test.ts`: util 4단계 + videoinput 한정 + modal import/호출/단일제거/파일fallback 보존. ⚠️ sandbox node_modules 소실 → Claude Code `npm run test`.
- 배포 후 모바일 실기: 라벨 스캔 후면 카메라 기동 확인(iOS Safari / Android Chrome).

## Out of Scope
- QRScanner(html5-qrcode)·scan/page(@zxing)는 이미 fallback 보유 → 미변경.
- SmartReceivingScannerModal: 라이브 카메라 직접 획득 없음(파일 capture만) → 해당 없음.

## Rollback
- LabelScannerModal 호출부를 단일 getUserMedia 로 원복 + util/sentinel 삭제. 독립.
```
footer 없음
```
