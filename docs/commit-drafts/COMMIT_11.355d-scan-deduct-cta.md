# COMMIT — §11.355-D 스캔 페이지 사용/차감 CTA (단편화 해소, 폐루프 닫힘)

```
feat(inventory) §11.355-D #scan-deduct-cta — 전용 스캔 페이지에 사용/차감 CTA 추가 (글로벌 스캐너 /use 재사용, 폐루프 닫힘) (호영님 단편화 정정)
```

## 맥락 (폐루프 완성)
- §11.355-B(라벨 실 QR 인쇄, inv.id 인코딩) 완료 → 라벨→스캔까지 연결됨. 본 슬라이스가 **스캔→차감**을 연결해 폐루프(라벨→스캔→차감)를 닫음.

## 진단 (호영님 정정 반영)
- 차감 백지 아님: `POST /api/inventory/[id]/use`(수량 감소 트랜잭션 + InventoryUsage 이력 + 감사 + enforceAction) 존재, **GlobalQRScannerModal 엔 "사용/차감" 이미 구현**. 누락 = **전용 스캔 페이지(`/dashboard/inventory/scan`)** — 결과에 "입고/상세"만 있고 차감 CTA 없음 = page-per-feature 단편화.

## Fix (file 별, 신규 mutation 0)
- `app/dashboard/inventory/scan/page.tsx`:
  - react-query `useMutation`/`useQueryClient` + `csrfFetch` import 추가.
  - `deductMutation` — GlobalQRScannerModal 흐름 그대로 재사용: `/api/inventory/${inventory.id}/use` POST `{quantity, unit, notes}`. onSuccess 토스트(차감→잔여+warning) + `invalidateQueries(["inventory-item", inventoryId])`(잔여 즉시 갱신). onError 토스트.
  - 스캔 결과에 **"사용/차감" CTA** + **사용량 입력 폼**(수량 Input + 메모 + 차감 확인/취소 = 사람 확인 게이트). `showUseForm` 토글. **0 재고 시 "재고 없음 — 사용 불가" 가드**(dead button 방지).
- 신규 `__tests__/regression/scan-page-deduct-cta-355d.test.ts`: sentinel(6).

## 검증 (vitest)
- scan-page-deduct-cta-355d → **6 passed** (B 합산 13 passed). esbuild transform OK.

## ⚠️ 작업 중 (truncation 버그 재발)
- 스캔 페이지 편집 중 파일 끝(라벨 토글 버튼 이후 — 모달·Suspense export)이 멀티바이트 경계에서 truncate → bash로 head -500 + HEAD 꼬리(라벨 토글~EOF) 복원 후 transform+vitest 재검증. **푸시 전 호영님 환경에서 scan/page.tsx 끝(InventoryScanContent Suspense export) 정상 확인 권장.**

## Canonical truth 보존
- 차감 = 서버 `/use` mutation(트랜잭션+이력+감사)만이 truth. UI 는 사용량 입력+확인 게이트. front-only 차감 0. §11.349 카메라 lifecycle(controlsRef stop) + 입고/상세/라벨 스캐너 보존.

## Production effect
- 연구원이 시약 QR(§11.355-B 실 QR) 스캔 → 그 화면에서 바로 사용량 입력→차감(잔여 즉시 갱신). 라벨→스캔→차감 폐루프가 전용 스캔 경로에서도 닫힘.

## Out of Scope (후속)
- §11.355-B 잔여: 규격 데이터화(폼텍/DYMO 하드코딩 → 프리셋+커스텀+연구소 기본값).
- (별 트랙) §11.353 발주 관리 de-mock / §11.354 구매 리포트.

## Rollback path
- import 3개 + deductMutation 블록 + 사용/차감 JSX 블록 revert. 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
