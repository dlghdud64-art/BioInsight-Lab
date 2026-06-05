/**
 * §11.371-3 #submit-label-receive — 라벨 OCR 직접 입고 영속화 단일점.
 *
 * inventory-content 인라인 핸들러와 글로벌 스캔 허브(label_scanner)의 기본
 * onDirectReceive 가 동일 로직을 공유하도록 추출. canonical truth = /api/inventory.
 * mapLabelToReceiving(§11.326) 으로 packSize(통 1개 함량=규격) vs 받은 통 개수(입고
 * 수량)를 분리 유지한다. 토스트 flavor 는 호출부가 처리(sonner vs shadcn 분리).
 */
import { csrfFetch } from "@/lib/api-client";
import { mapLabelToReceiving } from "@/lib/inventory/map-label-to-receiving";
import type { SmartReceiveFormData } from "@/components/inventory/LabelScannerModal";
import type { QueryClient } from "@tanstack/react-query";

export interface SubmitLabelReceiveResult {
  ok: boolean;
  productName: string;
  receivedQuantity: number;
  receivedUnit: string;
}

/** SmartReceiveFormData → /api/inventory POST body (§11.326 규격/입고수량 분리). */
export function buildLabelReceivingPayload(data: SmartReceiveFormData) {
  // §11.326 — 라벨 packSize(통 1개 함량) vs 받은 통 개수 분리. 입고 수량은
  //   사용자 입력(받은 통 개수)이며 라벨값(통 1개 함량)이 아니다.
  const m = mapLabelToReceiving(
    { quantity: data.packSize || null, unit: data.packUnit || null },
    {
      receivedQuantity: parseFloat(data.receivedQuantity) || 1,
      receivedUnit: data.receivedUnit,
    },
  );
  return {
    productName: data.productName,
    brand: data.brand || null,
    catalogNumber: data.catalogNumber || null,
    lotNumber: data.lotNumber || null,
    expiryDate: data.expirationDate || null,
    // 입고 수량 = 받은 통 개수 (라벨값 아님)
    currentQuantity: m.receivedQuantity,
    unit: m.receivedUnit,
    // 통 1개 함량(규격)은 품목 마스터로 분리 저장
    packSize: m.packSize,
    packUnit: m.packUnit,
  };
}

/**
 * 라벨 직접 입고 등록 + 재고 쿼리 무효화. 네트워크/HTTP 실패 모두 ok:false 반환
 * (throw 안 함 → 호출부가 ok 로 분기해 토스트). front-only success 금지: ok:true 는
 * /api/inventory 200 이후에만.
 */
export async function submitLabelReceive(
  data: SmartReceiveFormData,
  queryClient: QueryClient,
): Promise<SubmitLabelReceiveResult> {
  const receivedQuantity = parseFloat(data.receivedQuantity) || 1;
  const receivedUnit = data.receivedUnit || "통";
  try {
    const res = await csrfFetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildLabelReceivingPayload(data)),
    });
    if (!res.ok) {
      return { ok: false, productName: data.productName, receivedQuantity, receivedUnit };
    }
    queryClient.invalidateQueries({ queryKey: ["inventories"] });
    queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
    return { ok: true, productName: data.productName, receivedQuantity, receivedUnit };
  } catch {
    return { ok: false, productName: data.productName, receivedQuantity, receivedUnit };
  }
}
