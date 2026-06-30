/**
 * §scan-mobile-align-merge B (호영님 2026-06-30) — 모바일 다장 캡처 필드 병합(fill-empty).
 *
 * 같은 품목을 여러 각도로 추가 촬영("다른 각도 재촬영")할 때, 각 스캔 결과를
 *   **빈 필드만 채워 누적**한다(곡면 병 catalogNo 가 한 각도에서만 읽히는 케이스 보완).
 *   - 채워진 값(이전 스캔 또는 사용자 수정/dirty)은 **보존**(좋은 값을 덮지 않음).
 *   - received*(기본 "1"/"통")는 비어있지 않아 항상 보존(사용자 입력 보호).
 *
 * 순수 함수 — RN/VisionCamera/React 무의존(vitest 단위검증). canonical 무접촉(draft 병합).
 *
 * ⚠️ 웹 apps/web/src/lib/inventory/scan-form-merge.ts(mergeFormData) 와 동일 로직.
 *   타입 상이(LabelForm vs SmartReceiveFormData)로 1:1 재사용 불가 → 병렬 구현.
 *   변경 시 양쪽 동기화 권장(capture-quality.ts 와 동일 중복 상황).
 */

/**
 * 모바일 라벨 스캔 편집 폼. apps/mobile/app/scan.tsx 의 LabelForm 과 동일 형.
 *   (Phase 3 에서 scan.tsx 가 이 타입을 import 하여 drift 방지.)
 */
export interface LabelForm {
  productName: string;
  catalogNumber: string;
  lotNumber: string;
  expirationDate: string;
  /** 라벨 규격(통 1개 함량). 입고 수량 아님(§11.326). */
  packSize: string;
  packUnit: string;
  /** 입고 정보(사용자 입력). 받은 통/박스 개수(§11.326). */
  receivedQuantity: string;
  receivedUnit: string;
  brand: string;
  casNumber: string;
}

/**
 * prev(누적 draft)에 incoming(새 스캔 매핑)을 fill-empty 병합.
 * 각 필드: prev 값이 비어있으면(공백 trim 후 "") incoming 으로 채움, 아니면 prev 유지.
 * prev 원본은 변경하지 않는다(새 객체 반환).
 */
export function mergeLabelForm(prev: LabelForm, incoming: LabelForm): LabelForm {
  const out: LabelForm = { ...prev };
  (Object.keys(incoming) as (keyof LabelForm)[]).forEach((k) => {
    const cur = String(prev[k] ?? "").trim();
    if (cur === "") out[k] = incoming[k];
  });
  return out;
}
