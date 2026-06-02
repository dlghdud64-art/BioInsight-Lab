# COMMIT — §11.349 재고 스캔 카메라 lifecycle 정정 ("중지" dead)

```
fix(inventory) §11.349 #camera-scan-lifecycle — 재고 스캔 "중지" dead 정정(controls.stop + track 종료 + cleanup) (호영님 P2)
```

## 호영님 spec (§11.349)
- 재고 스캔(QR/라벨) "중지" 버튼 dead. 모바일 웹뷰(브라우저 getUserMedia). 권한·init 정상.

## 진단 (가설 A 확정 — 코드 + 패키지 API 입증)
- 화면 = `app/dashboard/inventory/scan/page.tsx` (`@zxing/browser@0.1.5`).
- 범인: ① `decodeFromVideoDevice` 가 반환하는 **IScannerControls(.stop())를 버림**, ② 정지를 옛 `@zxing/library` API `reader.reset()` 로 호출 — `@zxing/browser` reader 엔 `reset` **없음** → TypeError/no-op → 스트림 미정지 + setScanning(false) 미실행 = **중지 dead**.
- "카메라 시작" 버튼은 이미 존재(플랜 가정보다 갭 좁음). 핵심 결함은 정지 경로뿐.

## Fix (file 별)
- `app/dashboard/inventory/scan/page.tsx`:
  - `controlsRef` 추가 → `controlsRef.current = await reader.decodeFromVideoDevice(...)` (정지 핸들 캡처).
  - `stopScanner` = `controlsRef.current?.stop()` + **video.srcObject MediaStream track 강제 종료**(LED 소등 보장) + ref 정리 + `setScanning(false)`. 구 `reader.reset()` 제거.
  - 언마운트 + `visibilitychange`(탭 숨김) 시 정리(웹뷰 카메라 점유·배터리·프라이버시 방지). 복귀 자동 재시작 X(사용자 "카메라 시작" 명시).
- `__tests__/regression/camera-scan-lifecycle-349.test.ts`: sentinel(6).

## 진단 refine (플랜 대비)
- 플랜은 "시작/재시도 경로 없음 + 상태머신 부재"로 가정했으나, 실제는 시작 버튼 + scanning/cameraError 상태가 이미 존재. **유일 결함 = 정지가 stream 을 안 멈춤.** → 4-state enum 신규 도입은 보류(over-rewrite 회피), 정지 lifecycle 만 정정.

## 검증
- vitest: camera-scan-lifecycle-349 **6 tests passed** (wiring/정지 핸들러 보장).
- ⚠️ getUserMedia 실동작은 자동화 불가 → **Phase 3 실기기 수동 검증 필수**:
  - [ ] 중지 → 카메라 실제 꺼짐(LED off)
  - [ ] 중지 후 "카메라 시작" → 재작동
  - [ ] 화면 이탈/재진입 정상
  - [ ] 탭 백그라운드 시 카메라 해제(복귀 후 시작 버튼으로 재개)
  - [ ] 권한 거부 시 사유 표시 / QR·라벨 토글 정상

## Canonical truth 보존
- 스캔 결과 라우팅·라벨 스캔 연동 무변경. 카메라 정지 경로만 정정.

## Out of Scope
- QRScanner.tsx(html5-qrcode, 정상)로의 통합 = 별도(스캔 엔진 교체, 큼).
- 4-state enum 명시화 = 보류(현 scanning/cameraError 로 작동중/중지됨/실패 커버).

## ⚠️ 배포 주의
- 2개 파일 한 커밋. push 전 `git status` + Vercel green. 배포 후 실기기 Phase 3 검증.

## Rollback path
- scan/page.tsx lifecycle hunk revert → 기존 화면(중지 dead 복귀). 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
