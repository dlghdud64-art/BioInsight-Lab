# COMMIT — §11.348-A-5: 확정 입고안 → 현장 QR 라벨 접합 (폐루프 종결)

```
feat(receiving) §11.348-A-5 #field-qr-label — 입고안 승인 시 확정 품목(inventoryId)을 라벨 모달로 연결 (QR→스캔→차감, §11.355 폐루프 접합)
```

## 무엇 (§11.348-A 폐루프 종결)
- A-4 승인으로 생성된 InventoryRestock 의 **inventoryId** 를 §11.355-B LabelPrintModal 로 전달 → 현장 QR 라벨 출력 → 스캔(§11.349) → 차감(§11.355-D)으로 입고~소비 폐루프 종결.

## Fix (file별)
- `api/receiving-drafts/[id]/approve/route.ts`:
  - 트랜잭션에서 품목별 restock 생성 시 `restockedItems`(inventoryId/name/lotNumber/expiryDate) 수집.
  - 응답에 `restockedItems`(id=inventoryId 매핑 — QR 인코딩 대상, expiryDate ISO date) 추가.
- `components/receiving/receiving-review-panel.tsx`:
  - LabelPrintModal import + `labelOpen`/`labelItems` state.
  - **승인 분기에서만** `data.restockedItems` → `setLabelItems` + 모달 오픈(반려는 라벨 없음).
  - `<LabelPrintModal selectedItems={labelItems} />` 렌더.

## 폐루프 (완결)
```
발주 발송(A-1) → 회신 링크 → 공급사 폼(A-2) → 검증 대기(PENDING_REVIEW)
  → 연구소 승인(A-4: ProductInventory 증분 + InventoryRestock) → 검토 UI(A-4b)
  → 현장 QR 라벨(A-5, inventoryId) → 스캔(§11.349) → 차감(§11.355-D)
```

## 재사용
- LabelPrintModal(§11.355-B, QR=item.id 인코딩) 그대로. id 에 inventoryId 전달 → 스캔 페이지가 inventory 조회·차감과 정합.

## migration
- **없음.** A-3 모델 + 기존 §11.355 라벨/스캔 위에서 동작.

## 검증 (vitest)
- `receiving-field-label-348a5.test.ts` → **3/3** (승인 라우트 restockedItems / 패널 라벨 오픈 / 승인분기 한정).
- 회귀: `receiving-approve-348a4` 5/5, `receiving-review-panel-348a4b` 5/5 (패널 수정 무영향).

## Out of Scope
- 라벨 재출력(과거 입고안) 진입점 — 현재는 승인 직후 자동 오픈만. 후속 가능.
- 회신 도착 알림(A-4b Out of Scope 유지).

## Rollback
- approve 라우트 restockedItems 반환 + 패널 라벨 wiring revert. 독립.
```
footer 없음
```
