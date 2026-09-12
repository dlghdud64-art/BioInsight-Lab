/**
 * §inventory-notes-erase P1-b (2026-09-11 prod 실측) — 재고 폼 → 요청 본문 조립.
 *
 * 비고 지우기가 서버 수정(30083c3c) 뒤에도 prod 에서 안 됐다. 원인은 클라이언트였다:
 *   AddInventoryModal handleSubmit  `notes: notes || undefined`
 * 빈 문자열이 undefined 가 되고 JSON.stringify 가 키를 통째로 뺀다. 서버는 "안 넘김" 을
 * 올바르게 판정했다 — 같은 `||` 결함이 클라이언트에 한 벌 더 있었다.
 * 그래서 조립을 여기로 뽑아 **요청 본문을 직접 검사**한다(순수 함수 테스트만으로는 이 결함이 안 잡힌다).
 *
 * 계약(1단계): 사용자가 비울 수 있는 텍스트 필드(notes · location · lotNumber)는 **항상 싣는다.**
 *   빈 문자열이 곧 "비움" 이고, 서버(PATCH·POST)는 이미 빈 문자열을 null 로 저장한다.
 *   (RED-first: 옛 `|| undefined` 상태에서 연쇄 테스트 4건 RED 를 먼저 확인했다.)
 */

export interface InventoryFormState {
  productId: string | undefined;
  isManual: boolean;
  selectedProduct: { name?: string | null; brand?: string | null; catalogNumber?: string | null } | null;
  currentQuantity: string;
  unit: string;
  safetyStock: string;
  minOrderQty: string;
  location: string;
  expiryDate: Date | undefined;
  notes: string;
  lotNumber: string;
  trackingMode: string;
  isEdit: boolean;
  editableCatNo: string;
}

/** 모달 상태 → onSubmit 값 (1단계). */
export function buildInventoryFormPayload(s: InventoryFormState) {
  return {
    // 수기 입력이면 productId 대신 제품 메타 정보를 전달 (API에서 Find-or-Create 처리)
    productId: s.isManual ? undefined : s.productId,
    ...(s.isManual && {
      productName: s.selectedProduct?.name ?? undefined,
      brand: s.selectedProduct?.brand ?? undefined,
      catalogNumber: s.selectedProduct?.catalogNumber ?? undefined,
    }),
    currentQuantity: parseFloat(s.currentQuantity) || 0,
    unit: s.unit,
    /* §inventory-edit-blank-fields — 비움을 **null 로 명시 전송**한다. 옛 `? : undefined` 는
     *   키를 통째로 떨궈 "안 넘김" 이 됐고, 서버는 기존 값을 유지했다(비울 방법이 없었다). */
    safetyStock: s.safetyStock.trim() === "" ? null : parseFloat(s.safetyStock),
    minOrderQty: s.minOrderQty.trim() === "" ? null : parseFloat(s.minOrderQty),
    location: s.location, // 비움 = "" 를 그대로 싣는다(서버가 null 로 저장)
    // §inventory-edit-blank-fields — 유효기간도 같은 형태였다(비우면 키 소실 → 유지).
    expiryDate: s.expiryDate ? s.expiryDate.toISOString().split("T")[0] : null,
    notes: s.notes, // 옛 `|| undefined` 가 비움을 키째 떨궜다(prod 94eb07ce 실측)
    lotNumber: s.lotNumber.trim(),
    trackingMode: s.trackingMode, // §inventory-phaseB P3-UI-b — 추적 모드 저장(QUANTITY 기본).
    // §11.336 — 편집모드: 사용자가 입력/수정한 Cat.No (빈 값이면 null 로 명시 전송).
    ...(s.isEdit ? { catalogNumber: s.editableCatNo.trim() || null } : {}),
  };
}

export interface InventoryPatchSource {
  currentQuantity: number;
  location?: string;
  notes?: string;
  expiryDate?: string | null;
  minOrderQty?: number | null;
  safetyStock?: number | null;
  lotNumber?: string;
  trackingMode?: string;
  catalogNumber?: string | null;
}

/** onSubmit 값 → 편집 PATCH 본문 (2단계). inventory-content.tsx 의 mutationFn 에서 옮겨 왔다. */
export function buildInventoryPatchBody(p: InventoryPatchSource) {
  return {
    quantity: p.currentQuantity,
    location: p.location ?? undefined,
    notes: p.notes ?? undefined,
    // §inventory-edit-blank-fields — `?? undefined` 는 null(비움)을 undefined(유지)로 되돌린다. 그대로 싣는다.
    expiryDate: p.expiryDate,
    minOrderQty: p.minOrderQty,
    safetyStock: p.safetyStock,
    lotNumber: p.lotNumber ?? undefined,
    trackingMode: p.trackingMode ?? undefined, // §inventory-phaseB P3-UI-b
    // §11.336 — 편집모드 Cat.No 수동 입력 → PATCH 로 Product 마스터 반영.
    catalogNumber: p.catalogNumber,
  };
}
