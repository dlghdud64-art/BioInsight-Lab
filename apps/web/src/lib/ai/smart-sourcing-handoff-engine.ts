/**
 * Smart Sourcing Handoff Engine
 *
 * AI 견적 분석(다중 견적 비교 / BOM 자동 발주) 결과를
 * 온톨로지 파이프라인으로 넘기는 Handoff 객체 + builder + guard.
 *
 * 고정 규칙:
 * 1. 비교 결과를 그대로 PO로 직행하는 shortcut 금지 — 반드시 RequestAssembly 단계를 거친다.
 * 2. BOM 파싱 결과는 발주 대기열(OrderQueue)에 등록만 하고, 승인 없이 발주 생성 금지.
 * 3. Handoff snapshot은 canonical source — UI preview가 truth를 덮지 않는다.
 * 4. 비교 결과에서 공급사 미선정 상태로 handoff 금지 (blocker).
 * 5. BOM에서 수량 0 이하 품목은 handoff에서 제외.
 */

// ══════════════════════════════════════════════════════════════════════════════
// 1. Quote Comparison Handoff (다중 견적 비교 → 견적 요청 조립)
// ══════════════════════════════════════════════════════════════════════════════

export type QuoteComparisonHandoffStatus =
  | "comparison_complete"        // 비교 완료, 선정 전
  | "vendor_selected"            // 추천 공급사 선정됨
  | "handed_off_to_request";     // 견적 요청 조립으로 전달됨

export interface ComparisonVendorSnapshot {
  vendor: string;
  price: number | null;
  leadTime: string;
  shippingFee: number | null;
  isRecommended: boolean;
  isCheapest: boolean;
  isFastest: boolean;
}

export interface QuoteComparisonHandoff {
  /** 핸드오프 고유 ID */
  readonly id: string;
  /** 상태 */
  status: QuoteComparisonHandoffStatus;
  /** 비교 대상 제품명 */
  productName: string;
  /** 요청 수량 */
  quantity: number | null;
  /** 비교 공급사 스냅샷 */
  vendorSnapshots: ComparisonVendorSnapshot[];
  /** AI 추천 요약 */
  recommendation: string;
  /** 네고 포인트 */
  negotiationGuide: string;
  /** 선정된 공급사 이름 (null = 미선정) */
  selectedVendorName: string | null;
  /** 선정 사유 */
  selectionRationale: string | null;
  /** 생성 시각 */
  createdAt: string;
  /** handoff 시각 (null = 아직 안 넘김) */
  handedOffAt: string | null;
  /** 출처 */
  sourceType: "smart_sourcing_multi_vendor";
}

export function buildQuoteComparisonHandoff(
  productName: string,
  quantity: number | null,
  comparison: Array<{ vendor: string; price: number | string; leadTime: string; shippingFee: number | string }>,
  recommendation: string,
  negotiationGuide: string,
): QuoteComparisonHandoff {
  const numericVendors = comparison.map((v) => ({
    vendor: v.vendor,
    price: typeof v.price === "number" ? v.price : null,
    leadTime: v.leadTime,
    shippingFee: typeof v.shippingFee === "number" ? v.shippingFee : null,
    isRecommended: false,
    isCheapest: false,
    isFastest: false,
  }));

  // 최저가 / 최단납기 식별
  const withPrice = numericVendors.filter((v) => v.price !== null);
  if (withPrice.length > 0) {
    const cheapest = withPrice.reduce((a, b) => ((a.price ?? Infinity) < (b.price ?? Infinity) ? a : b));
    cheapest.isCheapest = true;
  }

  const parseDays = (s: string): number => {
    const n = parseInt(String(s).replace(/[^0-9]/g, ""));
    if (s.includes("주")) return n * 7;
    if (s.includes("개월") || s.includes("월")) return n * 30;
    return isNaN(n) ? 9999 : n;
  };
  const fastest = [...numericVendors].sort((a, b) => parseDays(a.leadTime) - parseDays(b.leadTime))[0];
  if (fastest) fastest.isFastest = true;

  return {
    id: `qch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    status: "comparison_complete",
    productName,
    quantity,
    vendorSnapshots: numericVendors,
    recommendation,
    negotiationGuide,
    selectedVendorName: null,
    selectionRationale: null,
    createdAt: new Date().toISOString(),
    handedOffAt: null,
    sourceType: "smart_sourcing_multi_vendor",
  };
}

/** 공급사 선정 */
export function selectVendorInHandoff(
  handoff: QuoteComparisonHandoff,
  vendorName: string,
  rationale: string,
): QuoteComparisonHandoff {
  const vendor = handoff.vendorSnapshots.find((v) => v.vendor === vendorName);
  if (!vendor) throw new Error(`공급사 "${vendorName}"가 비교 결과에 없습니다.`);

  return {
    ...handoff,
    status: "vendor_selected",
    selectedVendorName: vendorName,
    selectionRationale: rationale,
    vendorSnapshots: handoff.vendorSnapshots.map((v) => ({
      ...v,
      isRecommended: v.vendor === vendorName,
    })),
  };
}

/** 견적 요청으로 handoff 가능 여부 체크 */
export function canHandoffToRequestAssembly(handoff: QuoteComparisonHandoff): {
  canHandoff: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];

  if (!handoff.selectedVendorName) {
    blockers.push("공급사를 먼저 선정해야 합니다.");
  }
  if (handoff.vendorSnapshots.length < 2) {
    blockers.push("최소 2개 공급사 비교 결과가 필요합니다.");
  }
  if (handoff.status === "handed_off_to_request") {
    blockers.push("이미 견적 요청으로 전달되었습니다.");
  }

  return { canHandoff: blockers.length === 0, blockers };
}

/** handoff 실행 (상태 전이) */
export function executeHandoffToRequest(
  handoff: QuoteComparisonHandoff,
): QuoteComparisonHandoff {
  const check = canHandoffToRequestAssembly(handoff);
  if (!check.canHandoff) {
    throw new Error(`Handoff 불가: ${check.blockers.join(", ")}`);
  }

  return {
    ...handoff,
    status: "handed_off_to_request",
    handedOffAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1.x  Adapter: QuoteComparisonHandoff → RequestCandidateHandoff
// ──────────────────────────────────────────────────────────────────────────────
// 이유:
// - smart-sourcing MultiVendor flow는 product table 없이 freeform 공급사 비교 행으로
//   구성되므로 RequestAssemblyWorkWindow가 기대하는 RequestCandidateHandoff(item-id 중심)
//   shape으로 직접 매핑되지 않음.
// - canonical truth(QuoteComparisonHandoff)를 mutate 하지 않고 derived 합성만 수행한다.
// - work window는 productId 기반 lookup을 하므로 synthetic product id를 동일 키로 발급한다.
// ══════════════════════════════════════════════════════════════════════════════
export interface MultiVendorRequestSeed {
  requestHandoff: import("./compare-review-engine").RequestCandidateHandoff;
  syntheticProducts: Array<{
    id: string;
    name: string;
    brand: string;
    catalogNumber: string;
    specification: string;
    packSize: string;
    vendors: Array<{
      priceInKRW: number;
      leadTimeDays: number;
      vendor: { id: string; name: string };
    }>;
  }>;
  syntheticQuoteItems: Array<{ productId: string; quantity: number | null }>;
}

export function adaptComparisonHandoffToRequestSeed(
  handoff: QuoteComparisonHandoff,
): MultiVendorRequestSeed {
  // 단일 product 합성 — multi-vendor 비교는 product 1건이 본질
  const syntheticProductId = `mv_${handoff.id}`;
  const selected = handoff.vendorSnapshots.find((v) => v.isRecommended) ?? handoff.vendorSnapshots[0];

  const syntheticProducts = [
    {
      id: syntheticProductId,
      name: handoff.productName,
      brand: "",
      catalogNumber: "",
      specification: "",
      packSize: "",
      vendors: handoff.vendorSnapshots
        .filter((v) => v.price !== null)
        .map((v, idx) => ({
          priceInKRW: v.price ?? 0,
          leadTimeDays: parseLeadDays(v.leadTime),
          // 선택된 공급사를 [0]번에 두어 work window candidate resolver 와 정합
          vendor: { id: `mv_${handoff.id}_${idx}`, name: v.vendor },
        }))
        .sort((a, b) => (a.vendor.name === selected?.vendor ? -1 : b.vendor.name === selected?.vendor ? 1 : 0)),
    },
  ];

  const requestHandoff = {
    compareDecisionSnapshotId: handoff.id,
    shortlistedItemIds: [syntheticProductId],
    excludedItemIds: [],
    requestCandidateIds: [syntheticProductId],
    compareRationaleSummary: handoff.selectionRationale ?? handoff.recommendation,
    unresolvedInfoItems: [],
    nextRequestActionSeed: "다중 견적 비교 결과를 견적 요청으로 조립",
  } satisfies import("./compare-review-engine").RequestCandidateHandoff;

  const syntheticQuoteItems = [{ productId: syntheticProductId, quantity: handoff.quantity }];

  return { requestHandoff, syntheticProducts, syntheticQuoteItems };
}

function parseLeadDays(s: string): number {
  const n = parseInt(String(s).replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n)) return 0;
  if (s.includes("주")) return n * 7;
  if (s.includes("개월") || s.includes("월")) return n * 30;
  return n;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. BOM Parse Handoff (BOM 자동 발주 → 발주 대기열)
// ══════════════════════════════════════════════════════════════════════════════

export type BomParseHandoffStatus =
  | "parsed"                    // 파싱 완료
  | "items_confirmed"           // 품목 확인/수정 완료
  | "registered_to_queue";      // 발주 대기열 등록 완료

export interface BomParsedItem {
  /** 순번 */
  index: number;
  /** 품목명 */
  name: string;
  /** 카탈로그 번호 */
  catalogNumber: string | null;
  /** 수량 */
  quantity: number;
  /** 단위 */
  unit: string;
  /** 카테고리 */
  category: "REAGENT" | "CONSUMABLE" | "EQUIPMENT";
  /** 브랜드 */
  brand: string | null;
  /** 추정 용도 */
  estimatedUse: string | null;
  /** 운영자가 선택함 */
  isSelected: boolean;
  /** 매칭된 제품 ID (있으면) */
  matchedProductId: string | null;
}

export interface BomParseHandoff {
  /** 핸드오프 고유 ID */
  readonly id: string;
  /** 상태 */
  status: BomParseHandoffStatus;
  /** 원본 텍스트 (truncated) */
  originalText: string;
  /** 파싱된 품목 리스트 */
  items: BomParsedItem[];
  /** AI 요약 */
  summary: string;
  /** 생성 시각 */
  createdAt: string;
  /** 등록 시각 */
  registeredAt: string | null;
  /** 등록된 대기열 항목 수 */
  registeredCount: number | null;
  /** 출처 */
  sourceType: "smart_sourcing_bom_parse";
}

export function buildBomParseHandoff(
  originalText: string,
  items: Array<{
    name: string;
    catalogNumber: string | null;
    quantity: number;
    unit: string;
    category: string;
    brand: string | null;
    estimatedUse: string | null;
  }>,
  summary: string,
): BomParseHandoff {
  return {
    id: `bph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    status: "parsed",
    originalText: originalText.slice(0, 2000),
    items: items.map((item, idx) => ({
      index: idx,
      name: item.name,
      catalogNumber: item.catalogNumber,
      quantity: item.quantity,
      unit: item.unit,
      category: (item.category === "CONSUMABLE" || item.category === "EQUIPMENT"
        ? item.category
        : "REAGENT") as BomParsedItem["category"],
      brand: item.brand,
      estimatedUse: item.estimatedUse,
      isSelected: item.quantity > 0,
      matchedProductId: null,
    })),
    summary,
    createdAt: new Date().toISOString(),
    registeredAt: null,
    registeredCount: null,
    sourceType: "smart_sourcing_bom_parse",
  };
}

/** 품목 확인 완료 */
export function confirmBomItems(
  handoff: BomParseHandoff,
  selectedIndices: number[],
): BomParseHandoff {
  return {
    ...handoff,
    status: "items_confirmed",
    items: handoff.items.map((item) => ({
      ...item,
      isSelected: selectedIndices.includes(item.index),
    })),
  };
}

/** 발주 대기열 등록 가능 여부 */
export function canRegisterToQueue(handoff: BomParseHandoff): {
  canRegister: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  const selected = handoff.items.filter((i) => i.isSelected);

  if (selected.length === 0) {
    blockers.push("등록할 품목을 하나 이상 선택해야 합니다.");
  }

  const invalidQty = selected.filter((i) => i.quantity <= 0);
  if (invalidQty.length > 0) {
    blockers.push(`수량이 0 이하인 품목이 ${invalidQty.length}개 있습니다.`);
  }

  if (handoff.status === "registered_to_queue") {
    blockers.push("이미 발주 대기열에 등록되었습니다.");
  }

  return { canRegister: blockers.length === 0, blockers };
}

/** 등록 실행 (상태 전이) */
export function executeRegisterToQueue(
  handoff: BomParseHandoff,
): BomParseHandoff {
  const check = canRegisterToQueue(handoff);
  if (!check.canRegister) {
    throw new Error(`등록 불가: ${check.blockers.join(", ")}`);
  }

  const registeredCount = handoff.items.filter((i) => i.isSelected).length;

  return {
    ...handoff,
    status: "registered_to_queue",
    registeredAt: new Date().toISOString(),
    registeredCount,
  };
}
