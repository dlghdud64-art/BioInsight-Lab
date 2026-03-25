/**
 * AI Suggestion Engine — P1 반자동 운영 레이어
 *
 * 독립 쇼케이스가 아니라 검색/비교/요청 흐름 안의 inline workflow helper.
 * 모든 출력은 사용자 승인 전까지 실행되지 않는다.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type SuggestionType = "search_summary" | "compare_recommendation" | "request_draft";
export type SuggestionStatus = "generated" | "accepted" | "edited" | "dismissed";
export type Confidence = "low" | "medium" | "high";

export interface AISuggestion {
  type: SuggestionType;
  status: SuggestionStatus;
  confidence: Confidence;
  sourceContext: string;
  actionTarget?: string;
}

// ── P1-A: Search Next Step Summary ─────────────────────────────────────────

export interface SearchSummaryInput {
  query: string;
  products: any[];
  compareIds: string[];
  quoteItemIds: string[];
}

export interface SearchSummaryLine {
  text: string;
  signal: "info" | "compare" | "request" | "caution";
}

export function generateSearchSummary(input: SearchSummaryInput): SearchSummaryLine[] {
  const { query, products, compareIds, quoteItemIds } = input;
  const lines: SearchSummaryLine[] = [];
  if (products.length === 0) return lines;

  // 가격 분석
  const prices = products
    .map((p: any) => p.vendors?.[0]?.priceInKRW)
    .filter((p: number | undefined): p is number => !!p && p > 0);

  if (prices.length >= 2) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const diff = max - min;
    const diffPct = Math.round((diff / min) * 100);
    if (diffPct > 30) {
      lines.push({ text: `가격 차이가 ${diffPct}%로 큽니다. 비교 후 요청을 권장합니다.`, signal: "compare" });
    }
  }

  // 규격/카테고리 유사성 분석
  const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
  const brands = [...new Set(products.map((p: any) => p.brand).filter(Boolean))];

  // 비교 적합 후보
  const compareCandidates = products.filter((p: any) => {
    const hasPrice = p.vendors?.[0]?.priceInKRW > 0;
    const notInCompare = !compareIds.includes(p.id);
    return hasPrice && notInCompare;
  });

  if (compareCandidates.length >= 2 && compareIds.length === 0) {
    lines.push({
      text: `비교 적합 후보 ${Math.min(compareCandidates.length, 5)}개가 확인되었습니다.`,
      signal: "compare",
    });
  }

  // 납기 불완전 감지
  const missingLeadTime = products.filter((p: any) => {
    const vendors = p.vendors || [];
    return vendors.length > 0 && !vendors[0]?.leadTime;
  });
  if (missingLeadTime.length > 0) {
    lines.push({
      text: `납기 정보가 불완전한 품목 ${missingLeadTime.length}개는 견적 요청 전환이 적절합니다.`,
      signal: "request",
    });
  }

  // 공급사 다양성
  const vendorNames = [...new Set(products.flatMap((p: any) => (p.vendors || []).map((v: any) => v.vendor?.name)).filter(Boolean))];
  if (vendorNames.length >= 3) {
    lines.push({
      text: `${vendorNames.length}개 공급사에서 결과가 확인되어 비교 범위가 충분합니다.`,
      signal: "info",
    });
  } else if (vendorNames.length === 1 && products.length > 1) {
    lines.push({
      text: `단일 공급사 결과입니다. 추가 검색으로 비교 범위를 넓히는 것을 권장합니다.`,
      signal: "caution",
    });
  }

  // 이미 비교 중이면 다음 단계 안내
  if (compareIds.length >= 2 && quoteItemIds.length === 0) {
    lines.push({
      text: `비교 ${compareIds.length}개 준비 완료. 비교 판단 화면으로 이동하여 검토를 시작하세요.`,
      signal: "compare",
    });
  }

  // 견적 담기 완료 상태
  if (quoteItemIds.length > 0) {
    lines.push({
      text: `견적 ${quoteItemIds.length}건이 담겨 있습니다. 요청서 작성으로 전환할 수 있습니다.`,
      signal: "request",
    });
  }

  return lines.slice(0, 3); // max 3 lines
}

// ── P1-A2: Dock-level Next Action Recommendation ──────────────────────────

export interface DockRecommendationInput {
  compareIds: string[];
  quoteItemIds: string[];
  products: any[];
}

export function generateDockRecommendation(input: DockRecommendationInput): string | null {
  const { compareIds, quoteItemIds, products } = input;

  // 비교 후보 분석
  const compareProducts = products.filter((p: any) => compareIds.includes(p.id));
  const compareCategories = [...new Set(compareProducts.map((p: any) => p.category).filter(Boolean))];

  // 견적 후보 분석
  const requestProducts = products.filter((p: any) => quoteItemIds.includes(p.id));
  const missingLeadTime = requestProducts.filter((p: any) => !(p.vendors?.[0]?.leadTime));

  // 비교 + 견적 모두 있으면
  if (compareIds.length >= 2 && quoteItemIds.length > 0) {
    return `비교 ${compareIds.length}개와 견적 ${quoteItemIds.length}건이 준비되었습니다. 비교 후 요청서 생성이 적절합니다.`;
  }

  // 비교만 있으면
  if (compareIds.length >= 2 && quoteItemIds.length === 0) {
    if (compareCategories.length <= 1) {
      return `동일 카테고리 ${compareIds.length}개가 모였습니다. 비교 시작이 적절합니다.`;
    }
    return `서로 다른 카테고리가 포함되어 있습니다. 규격 확인 후 비교를 시작하세요.`;
  }

  // 견적만 있으면
  if (quoteItemIds.length > 0) {
    if (missingLeadTime.length > 0) {
      return `견적 후보 ${quoteItemIds.length}개 중 ${missingLeadTime.length}개는 납기 미확정입니다. 요청서에 납기 문의를 포함하세요.`;
    }
    return `견적 후보 ${quoteItemIds.length}건이 준비되었습니다. 요청서 생성으로 이동할 수 있습니다.`;
  }

  // 비교 1개만
  if (compareIds.length === 1) {
    return `비교 후보 1개가 추가되었습니다. 1개 더 추가하면 비교가 가능합니다.`;
  }

  return null;
}

// ── P1-B: Compare Decision Summary ─────────────────────────────────────────

export interface CompareDecisionInput {
  products: any[];
  scenario: string; // "cost" | "leadtime" | "spec" | "manual"
  getAverageLeadTime: (product: any) => number;
  quoteItemsCount: number;
}

export interface CompareDecisionSummary {
  recommendation: string;
  reasons: string[];
  nextAction: string;
  confidence: Confidence;
}

export function generateCompareDecision(input: CompareDecisionInput): CompareDecisionSummary | null {
  const { products, scenario, getAverageLeadTime, quoteItemsCount } = input;
  if (products.length < 2) return null;

  const reasons: string[] = [];
  let recommendation = "";
  let nextAction = "";
  let confidence: Confidence = "medium";

  // 가격 데이터
  const priced = products
    .map((p: any) => ({ product: p, price: p.vendors?.[0]?.priceInKRW || 0 }))
    .filter((x) => x.price > 0)
    .sort((a, b) => a.price - b.price);

  // 납기 데이터
  const withLeadTime = products
    .map((p: any) => ({ product: p, leadTime: getAverageLeadTime(p) }))
    .filter((x) => x.leadTime > 0)
    .sort((a, b) => a.leadTime - b.leadTime);

  const cheapest = priced[0];
  const fastest = withLeadTime[0];

  if (scenario === "cost" && cheapest) {
    const name = cheapest.product.name?.substring(0, 20) || "—";
    recommendation = `가격 우선이면 ${name}이(가) 유리합니다.`;
    if (priced.length >= 2) {
      const diff = Math.round(((priced[priced.length - 1].price - cheapest.price) / cheapest.price) * 100);
      reasons.push(`최저가 ₩${cheapest.price.toLocaleString()} — 최고가 대비 ${diff}% 저렴`);
    }
    if (fastest && fastest.product.id !== cheapest.product.id) {
      reasons.push(`납기는 ${fastest.product.name?.substring(0, 15)}이(가) 더 빠름 (${fastest.leadTime}일)`);
    }
    confidence = priced.length >= 2 ? "high" : "medium";
  } else if (scenario === "leadtime" && fastest) {
    const name = fastest.product.name?.substring(0, 20) || "—";
    recommendation = `납기 우선이면 ${name}이(가) 적합합니다.`;
    reasons.push(`예상 납기 ${fastest.leadTime}일`);
    if (cheapest && cheapest.product.id !== fastest.product.id) {
      reasons.push(`가격은 ${cheapest.product.name?.substring(0, 15)}이(가) 더 저렴`);
    }
    confidence = withLeadTime.length >= 2 ? "high" : "medium";
  } else if (scenario === "spec") {
    recommendation = `규격 일치 기준으로 상위 결과를 검토하세요.`;
    const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
    if (categories.length > 1) {
      reasons.push(`서로 다른 카테고리 (${categories.length}개) 포함 — 규격 직접 확인 필요`);
    }
    confidence = "medium";
  } else {
    recommendation = `수동 선택 모드에서 직접 비교 중입니다.`;
    if (cheapest) reasons.push(`참고: 최저가 ${cheapest.product.name?.substring(0, 15)} (₩${cheapest.price.toLocaleString()})`);
    confidence = "low";
  }

  // 다음 액션
  if (quoteItemsCount > 0) {
    nextAction = `견적 ${quoteItemsCount}건이 담겨 있습니다. 요청서 생성으로 이동할 수 있습니다.`;
  } else if (cheapest) {
    nextAction = `선택한 제품을 견적 담기하여 요청서 생성을 준비하세요.`;
  } else {
    nextAction = `가격 정보가 부족합니다. 견적 요청으로 공급사에 직접 확인하세요.`;
  }

  return { recommendation, reasons, nextAction, confidence };
}

// ── P1-C: Request Draft Generator ──────────────────────────────────────────

export interface RequestDraftInput {
  vendorName: string;
  items: Array<{
    productName: string;
    quantity: number;
    specification?: string;
    catalogNumber?: string;
  }>;
  purpose?: string;
}

export interface RequestDraft {
  message: string;
  checklist: Array<{ label: string; status: "included" | "missing" }>;
  confidence: Confidence;
}

export function generateRequestDraft(input: RequestDraftInput): RequestDraft {
  const { vendorName, items, purpose } = input;

  const itemLines = items.map((item, i) =>
    `${i + 1}. ${item.productName}${item.catalogNumber ? ` (Cat. ${item.catalogNumber})` : ""} — ${item.quantity}개`
  ).join("\n");

  const purposeLine = purpose || "연구용 시약/소모품 구매";

  const message = [
    `${vendorName} 담당자님께,`,
    ``,
    `아래 품목에 대한 견적을 요청드립니다.`,
    ``,
    `■ 요청 목적: ${purposeLine}`,
    ``,
    `■ 요청 품목:`,
    itemLines,
    ``,
    `■ 납기 요청: 가능한 빠른 납기 일정을 안내해 주시기 바랍니다.`,
    ``,
    `■ 대체 가능 여부: 요청 품목과 동등 규격의 대체품이 있을 경우 함께 안내해 주시면 검토하겠습니다.`,
    ``,
    `■ 첨부: 별도 첨부 문서가 있을 경우 회신 시 함께 전달해 주시기 바랍니다.`,
    ``,
    `감사합니다.`,
  ].join("\n");

  const checklist: RequestDraft["checklist"] = [
    { label: "요청 목적", status: purpose ? "included" : "missing" },
    { label: "품목 목록", status: items.length > 0 ? "included" : "missing" },
    { label: "납기 요청", status: "included" },
    { label: "대체 가능 여부 문의", status: "included" },
    { label: "첨부 안내", status: "included" },
  ];

  return {
    message,
    checklist,
    confidence: items.length > 0 ? "high" : "low",
  };
}
