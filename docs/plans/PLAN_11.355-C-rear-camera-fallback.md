# Implementation Plan: §11.355-C — 후면 카메라 enumerateDevices fallback (+§11.349 묶음)

- **Status:** 🗂️ Plan (Phase 0 확정 — 코드 draft 보류: baseline·§11.312·§11.358-1 뒤 착수)
- **Last Updated:** 2026-06-03
- **유형:** 방어 강화(라이브 결함 아님 — 후면 이미 고정, 단 특정 webview에서 2단 무시 케이스 확인됨) + §11.349 lifecycle 묶음.
- **Scope:** Small. 외부영향 0(카메라 권한 UI state). **실기기 검증 필수(sandbox 불가, ops).**

## Phase 0 — 코드 확정 (2026-06-03)
- 모든 실 스캔 경로가 **후면 이미 명시**:
  - `QRScanner.tsx`(web): `facingMode: { exact: "environment" }` → 실패 시 soft `"environment"` **2단 fallback**.
  - `LabelScannerModal.tsx`(web): `getUserMedia({ video: { facingMode: "environment" } })` + 파일 `capture="environment"`.
  - `scan.tsx`(mobile): `<CameraView facing="back">`.
  - `barcode-scan-fab.tsx`: 실 카메라 호출 없음(mock gate).
- **갭 = QRScanner/LabelScannerModal 에 enumerateDevices(deviceId) 3차 fallback 부재.** 스크린샷상 실기기에서 전면 작동 = exact·soft environment **둘 다 무시하는 webview** 존재 확인 → 최후 보루로 deviceId 직접 지정 필요.
- mobile(`CameraView facing="back"`)은 native라 별도(이 트랙은 web 한정).

## 분할 (착수 시 — 코드 draft 는 baseline 후)
- **C-1 공통 util `getRearCameraStream`** (`lib/camera/rear-camera.ts` 신규, 순수 로직):
  - 체인: ① `getUserMedia({ video: { facingMode: { exact: "environment" } } })`
    → 실패 ② `{ facingMode: "environment" }`
    → 실패 ③ `enumerateDevices()` → `kind==="videoinput"` 중 label 정규식 `/back|rear|environment|후면/i` 매칭 deviceId → `getUserMedia({ video: { deviceId: { exact: id } } })`
    → 그래도 실패 ④ 호출부에 신호 반환 → **수동 "카메라 전환" 버튼 노출.**
  - 반환: `{ stream, deviceId, tier }` 또는 throw. enumerate 는 label 권한 의존(권한 전엔 label 비어 있을 수 있음 → 권한 획득 후 재-enumerate 순서 주의).
- **C-2 QRScanner 적용**: html5-qrcode 는 `cameraId`(deviceId) 직접 start 지원 → C-1 util 결과 deviceId 로 start. 기존 2단 유지 + 3차 enumerate 추가.
- **C-3 LabelScannerModal 적용**: 직접 `getUserMedia` 라 C-1 util 로 교체(중복 제거).
- **C-4 §11.349 lifecycle 묶음**: 중지(track.stop + controls.stop)·재시도 상태머신 점검·정합(같은 모듈). 이미 §11.349 Phase 1·2 에서 중지 lifecycle 처리됨 → 재시도/전환 버튼 상태만 보강.

## 검증
- **C-1 util 단위테스트(web vitest)**: `navigator.mediaDevices.getUserMedia`/`enumerateDevices` mock → exact 실패→soft 실패→enumerate back deviceId 선택 경로 + label 매칭(back/rear/environment/후면) + 최종 실패 시 throw/신호. (sandbox 가능)
- **실기기(문제 기기)**: 후면 전환 확인 = 완료 게이트. (ops, sandbox 불가)

## Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| enumerate label 권한 전 비어있음 | High | Med | 권한 획득(1차 getUserMedia) 후 enumerate 재실행 순서 |
| html5-qrcode deviceId start 호환 | Med | Med | C-2 에서 cameraId API 확인 |
| 실기기 검증 sandbox 불가 | High | Med | util 단위테스트 + ops 실기기 |
| §11.349 상태머신 회귀 | Low | Med | 기존 중지 sentinel 보존 |

## 우선순위 (호영님)
- baseline·§11.312·§11.358-1 **뒤.** 라이브 결함이 아니라 방어 강화(후면 이미 고정) → 급하지 않음.
- 코드 draft 는 **baseline 후 결정.** 본 문서는 plan/지시문.

## Notes
- §11.349(카메라 lifecycle)와 같은 모듈 → 함께 수정 권장.
- mobile 은 native `facing="back"` 라 본 트랙 무관(web webview 한정).
