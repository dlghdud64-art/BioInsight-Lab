/**
 * Request Assembly Logic — 공급사별 그룹화 + 조립 준비 상태 판정.
 *
 * 4가지 overall 상태:
 * - ready_to_write_request: 요청 단위 정리 완료
 * - review_first: compare 미반영 / ambiguous 후보
 * - blocked: candidate 없음 / invalid quantity
 * - split_required: 공급사별 다건 요청 필요 (분리 인지 필요)
 */

// ── Vendor Group ──

export interface VendorGroup {
  vendorName: string;
  vendorId: string;
  items: AssemblyItem[];
  subtotal: number;
  itemCount: number;
}

export interface AssemblyItem {
  id: string;
  productId: string;
  productName: string;
  vendorName: string;
  vendorId: string;
  catalogNumber: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  hasPrice: boolean;
  isInCompare: boolean;
}

// ── Readiness ──

export type AssemblyReadinessLevel =
  | "ready_to_write_request"
  | "review_first"
  | "blocked"
  | "split_required";

export interface AssemblyReadiness {
  level: AssemblyReadinessLevel;
  label: string;
  detail: string;
  vendorGroups: VendorGroup[];
  summary: {
    totalItems: number;
    totalAmount: number;
    vendorCount: number;
    requestCount: number;
    noPriceCount: number;
    inCompareCount: number;
  };
  blockers: string[];
  warnings: string[];
}

// ── Calculation ──

export function calculateAssembly(
  quoteItems: any[],
  compareIds: string[],
  products: any[],
): AssemblyReadiness {
  // Build assembly items
  const items: AssemblyItem[] = quoteItems.map((item) => {
    const product = products.find((p: any) => p.id === item.productId);
    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName || product?.name || "제품",
      vendorName: item.vendorName || "벤더 미지정",
      vendorId: item.vendorId || "",
      catalogNumber: product?.catalogNumber || null,
      unitPrice: item.unitPrice || 0,
      quantity: item.quantity || 1,
      lineTotal: item.lineTotal || 0,
      hasPrice: (item.unitPrice || 0) > 0,
      isInCompare: compareIds.includes(item.productId),
    };
  });

  // Group by vendor
  const groupMap: Record<string, AssemblyItem[]> = {};
  items.forEach((item) => {
    const key = item.vendorName;
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(item);
  });

  const vendorGroups: VendorGroup[] = Object.entries(groupMap)
    .map(([vendorName, groupItems]) => ({
      vendorName,
      vendorId: groupItems[0]?.vendorId || "",
      items: groupItems,
      subtotal: groupItems.reduce((sum, i) => sum + i.lineTotal, 0),
      itemCount: groupItems.length,
    }))
    .sort((a, b) => b.subtotal - a.subtotal);

  const totalAmount = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const noPriceCount = items.filter((i) => !i.hasPrice).length;
  const inCompareCount = items.filter((i) => i.isInCompare).length;

  const summary = {
    totalItems: items.length,
    totalAmount,
    vendorCount: vendorGroups.length,
    requestCount: vendorGroups.length,
    noPriceCount,
    inCompareCount,
  };

  // Blockers & warnings
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (items.length === 0) {
    blockers.push("견적 요청 후보가 없습니다");
  }
  if (noPriceCount > 0) {
    warnings.push(`${noPriceCount}건 가격 미확인 — 공급사에 문의 필요`);
  }
  if (inCompareCount > 0) {
    warnings.push(`${inCompareCount}건 비교 진행 중 — 최적 후보 확정 권장`);
  }
  items.forEach((item) => {
    if (item.quantity <= 0) {
      blockers.push(`${item.productName}: 수량이 0 이하`);
    }
  });

  // Overall level
  let level: AssemblyReadinessLevel;
  let label: string;
  let detail: string;

  if (items.length === 0 || blockers.length > 0) {
    level = "blocked";
    label = "요청 불가";
    detail = blockers[0] || "필수 정보가 부족합니다";
  } else if (vendorGroups.length > 1) {
    level = "split_required";
    label = `${vendorGroups.length}건 분리 요청`;
    detail = `공급사 ${vendorGroups.length}곳 → 요청서 ${vendorGroups.length}건 생성`;
  } else if (inCompareCount > 0 || noPriceCount > 0) {
    level = "review_first";
    label = "검토 필요";
    detail = warnings[0] || "일부 항목 확인 필요";
  } else {
    level = "ready_to_write_request";
    label = "요청 가능";
    detail = `${summary.totalItems}건, ₩${totalAmount.toLocaleString("ko-KR")}`;
  }

  return { level, label, detail, vendorGroups, summary, blockers, warnings };
}
