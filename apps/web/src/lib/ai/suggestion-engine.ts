/**
 * AI Suggestion Engine — P1 반자동 운영 레이어
 *
 * 모든 문구는 행동 방향형. 설명하지 않고 다음 행동을 보여준다.
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
  const { products, compareIds, quoteItemIds } = input;
  const lines: SearchSummaryLine[] = [];
  if (products.length === 0) return lines;

  // 가격 분석 → 비교 권장
  const prices = products
    .map((p: any) => p.vendors?.[0]?.priceInKRW)
    .filter((p: number | undefined): p is number => !!p && p > 0);

  if (prices.length >= 2) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const diffPct = Math.round(((max - min) / min) * 100);
    if (diffPct > 30) {
      lines.push({ text: "비교 후보를 준비했습니다", signal: "compare" });
    }
  }

  // 비교 적합 후보
  const compareCandidates = products.filter((p: any) => {
    return p.vendors?.[0]?.priceInKRW > 0 && !compareIds.includes(p.id);
  });

  if (compareCandidates.length >= 2 && compareIds.length === 0) {
    lines.push({ text: "동일 규격 후보가 있어 비교가 가능합니다", signal: "compare" });
  }

  // 납기 불완전
  const missingLeadTime = products.filter((p: any) => {
    const vendors = p.vendors || [];
    return vendors.length > 0 && !vendors[0]?.leadTime;
  });
  if (missingLeadTime.length > 0) {
    lines.push({ text: "납기 확인이 필요한 항목이 있습니다", signal: "caution" });
  }

  // 공급사 다양성
  const vendorNames = [...new Set(products.flatMap((p: any) => (p.vendors || []).map((v: any) => v.vendor?.name)).filter(Boolean))];
  if (vendorNames.length === 1 && products.length > 1) {
    lines.push({ text: "공급사 확인 필요", signal: "caution" });
  }

  // 비교 + 요청 혼합
  if (compareIds.length >= 2 && quoteItemIds.length > 0) {
    lines.push({ text: "비교 후 요청 전환이 적절합니다", signal: "compare" });
  }

  // 비교 준비됨
  if (compareIds.length >= 2 && quoteItemIds.length === 0) {
    lines.push({ text: "비교 후보가 준비되었습니다", signal: "compare" });
  }

  // 요청 전환 필요
  const noPriceProducts = products.filter((p: any) => !(p.vendors?.[0]?.priceInKRW > 0));
  if (noPriceProducts.length > 0 && quoteItemIds.length === 0 && compareIds.length === 0) {
    lines.push({ text: "요청 전환이 필요한 항목이 있습니다", signal: "request" });
  }

  // 견적 담기 완료
  if (quoteItemIds.length > 0 && compareIds.length === 0) {
    lines.push({ text: "바로 요청 가능", signal: "request" });
  }

  return lines.slice(0, 3);
}

// ── P1-A2: Dock-level Next Action Recommendation ──────────────────────────

export interface DockRecommendationInput {
  compareIds: string[];
  quoteItemIds: string[];
  products: any[];
}

export function generateDockRecommendation(input: DockRecommendationInput): string | null {
  const { compareIds, quoteItemIds, products } = input;

  const compareProducts = products.filter((p: any) => compareIds.includes(p.id));
  const compareCategories = [...new Set(compareProducts.map((p: any) => p.category).filter(Boolean))];
  const requestProducts = products.filter((p: any) => quoteItemIds.includes(p.id));
  const missingLeadTime = requestProducts.filter((p: any) => !(p.vendors?.[0]?.leadTime));

  // 혼합형
  if (compareIds.length >= 2 && quoteItemIds.length > 0) {
    return "비교 후 요청 전환이 적절합니다";
  }
  // 비교 중심
  if (compareIds.length >= 2 && quoteItemIds.length === 0) {
    if (compareCategories.length <= 1) return "동일 카테고리 비교가 가능합니다";
    return "비교 시작이 적절합니다";
  }
  // 요청 중심
  if (quoteItemIds.length > 0) {
    if (missingLeadTime.length > 0) return "요청 전환이 필요한 항목이 있습니다";
    return "요청서 생성으로 이어갈 수 있습니다";
  }
  if (compareIds.length === 1) {
    return "비교 후보가 준비되었습니다";
  }
  return null;
}

// ── P1-B: Compare Decision Summary ─────────────────────────────────────────

export interface CompareDecisionInput {
  products: any[];
  scenario: string;
  getAverageLeadTime: (product: any) => number;
  quoteItemsCount: number;
}

export interface CompareDecisionSummary {
  recommendation: string;
  details: string[];
  nextAction: string;
  confidence: Confidence;
}

export function generateCompareDecision(input: CompareDecisionInput): CompareDecisionSummary | null {
  const { products, scenario, getAverageLeadTime, quoteItemsCount } = input;
  if (products.length < 2) return null;

  const details: string[] = [];
  let recommendation = "";
  let nextAction = "";
  let confidence: Confidence = "medium";

  const priced = products
    .map((p: any) => ({ product: p, price: p.vendors?.[0]?.priceInKRW || 0 }))
    .filter((x) => x.price > 0)
    .sort((a, b) => a.price - b.price);

  const withLeadTime = products
    .map((p: any) => ({ product: p, leadTime: getAverageLeadTime(p) }))
    .filter((x) => x.leadTime > 0)
    .sort((a, b) => a.leadTime - b.leadTime);

  const cheapest = priced[0];
  const fastest = withLeadTime[0];

  if (scenario === "cost" && cheapest) {
    const name = cheapest.product.name?.substring(0, 18) || "—";
    recommendation = name;
    details.push("가격 기준으로 유리합니다");
    if (fastest && fastest.product.id !== cheapest.product.id) {
      details.push("납기 기준으로 유리합니다");
    }
    confidence = priced.length >= 2 ? "high" : "medium";
  } else if (scenario === "leadtime" && fastest) {
    const name = fastest.product.name?.substring(0, 18) || "—";
    recommendation = name;
    details.push("납기 기준으로 유리합니다");
    if (cheapest && cheapest.product.id !== fastest.product.id) {
      details.push("가격 기준으로 유리합니다");
    }
    confidence = withLeadTime.length >= 2 ? "high" : "medium";
  } else if (scenario === "spec") {
    recommendation = "현재 선택안 유지";
    const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
    if (categories.length > 1) {
      details.push("규격 일치도가 높습니다");
    }
    confidence = "medium";
  } else {
    recommendation = "현재 선택안 유지";
    if (priced.length >= 2) {
      details.push("추가 비교보다 요청 전환이 적절합니다");
    }
    confidence = "low";
  }

  if (quoteItemsCount > 0) {
    nextAction = "요청 단계로 이동";
  } else if (priced.length >= 2) {
    nextAction = "2개 함께 요청 권장";
  } else if (cheapest) {
    nextAction = "현재 선택안 유지";
  } else {
    nextAction = "추가 비교 필요";
  }

  return { recommendation, details, nextAction, confidence };
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
    { label: "납품지 확인", status: "missing" },
    { label: "담당자 정보", status: "missing" },
  ];

  return {
    message,
    checklist,
    confidence: items.length > 0 ? "high" : "low",
  };
}
