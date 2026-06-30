/**
 * §scan-multi-capture-merge (호영님 2026-06-30) — 다장 캡처 필드 병합(fill-empty).
 *
 * 같은 품목을 여러 각도로 추가 촬영할 때, 각 스캔 결과를 **빈 필드만 채워 누적**한다.
 *   - 곡면 병 catalogNo 가 한 각도에서만 읽히는 케이스 보완.
 *   - 채워진 값(이전 스캔 또는 사용자 수정/dirty)은 **보존**(좋은 값을 덮지 않음).
 *
 * 순수 함수 — DOM/React 무의존(단위테스트 용이). canonical 무접촉(draft 병합).
 */
import type { SmartReceiveFormData } from "@/components/inventory/LabelScannerModal";

/**
 * prev(누적 draft)에 incoming(새 스캔 매핑)을 fill-empty 병합.
 * 각 필드: prev 값이 비어있으면(공백 trim 후 "") incoming 으로 채움, 아니면 prev 유지.
 * received*(기본 "1"/"통")는 비어있지 않아 항상 보존(사용자 입력 보호).
 */
export function mergeFormData(
  prev: SmartReceiveFormData,
  incoming: SmartReceiveFormData,
): SmartReceiveFormData {
  const out: SmartReceiveFormData = { ...prev };
  (Object.keys(incoming) as (keyof SmartReceiveFormData)[]).forEach((k) => {
    const cur = String(prev[k] ?? "").trim();
    if (cur === "") out[k] = incoming[k];
  });
  return out;
}
