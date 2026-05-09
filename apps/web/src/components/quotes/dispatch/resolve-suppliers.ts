/**
 * resolve-suppliers.ts
 *
 * 견적 데이터에서 발송 대상 공급사를 자동 추출합니다.
 * VendorRequestModal에 resolvedSuppliers prop으로 전달하여
 * manual compose 대신 readiness-first UX를 기본 경로로 만듭니다.
 *
 * 우선순위 (#user-supplier-registration Phase 3 정합 — 호영님 결정):
 *   1. 과거 발송 이력 (recent_rfq) — 이미 이 견적에 발송한 적 있는 공급사
 *   2. 조직 거래처 (org_book) — operator 가 명시 등록한 OrganizationVendor
 *   3. 견적 품목에 연결된 공급사 (supplier_book) — 제품 vendor DB
 *   4. AI 추출 공급사 (ai_recommended) — quote.vendor 필드
 *
 * 동일 이메일은 중복 제거하며, 가장 높은 우선순위/confidence 가 보존됩니다.
 */

// #vendor-partnership-tier Phase 3 — 4단계 enum (Phase 1 schema 정합).
//   resolveSuppliers 의 confidence 결정에 반영 (호영님 결정 5A).
export type PartnershipTier = "DIRECT_PARTNER" | "VERIFIED" | "GENERAL" | "UNVERIFIED";

const PARTNERSHIP_TIER_TO_CONFIDENCE: Record<PartnershipTier, "high" | "medium" | "low"> = {
  DIRECT_PARTNER: "high",
  VERIFIED: "high",
  GENERAL: "medium",
  UNVERIFIED: "low",
};

function tierToConfidence(
  tier: string | null | undefined,
): "high" | "medium" | "low" | null {
  if (!tier) return null;
  return PARTNERSHIP_TIER_TO_CONFIDENCE[tier as PartnershipTier] ?? null;
}

export interface ResolvedSupplier {
  vendorId: string;
  vendorName: string;
  email: string;
  contactSource: "supplier_book" | "recent_rfq" | "ai_recommended" | "manual" | "org_book";
  confidence: "high" | "medium" | "low";
  reason?: string;
  lastUsed?: string;
  included: boolean;
}

interface ResolveInput {
  /** Quote object from API */
  quote: {
    id: string;
    title?: string;
    vendor?: string | null;
    confidence?: string | null;
    items?: Array<{
      product?: {
        // #vendor-catalog-product-matching Phase 3 — productId for matching.
        id?: string;
        name?: string;
        brand?: string;
        vendors?: Array<{
          vendor?: {
            id?: string;
            name?: string;
            email?: string;
            // #vendor-partnership-tier Phase 3 — 글로벌 baseline.
            partnershipTier?: PartnershipTier;
          };
        }>;
      };
    }>;
  };
  /** Past vendor requests for this quote */
  vendorRequests?: Array<{
    id: string;
    vendorEmail?: string | null;
    vendorName?: string | null;
    status?: string;
    respondedAt?: string | null;
    createdAt?: string;
  }>;
  /**
   * #user-supplier-registration Phase 3 — Organization 단위 supplier-book.
   * caller 가 `/api/organization-vendors` 응답을 forward — operator 직접
   * 등록한 거래처. recent_rfq 보다 낮고 supplier_book 보다 높은 우선순위.
   * 미전달 시 빈 array fallback (backward compat).
   */
  organizationVendors?: Array<{
    id: string;
    vendorName: string;
    vendorEmail: string;
    vendorPhone?: string | null;
    isPrimary?: boolean;
    notes?: string | null;
    // #vendor-partnership-tier Phase 3 — 조직 override (null fallback to baseline).
    partnershipTier?: PartnershipTier | null;
  }>;
  /**
   * #vendor-catalog-product-matching Phase 3 — 조직 단위 vendor-product carry 매핑.
   *   resolved supplier 의 vendorId 와 매칭 + quote.items 의 productId 매칭 시
   *   confidence 한 단계 boost (low → medium, medium → high). 호영님 결정 4A.
   *   미전달 시 빈 array fallback (backward compat).
   */
  organizationVendorProducts?: Array<{
    vendorId: string;
    productId: string;
  }>;
}

const CONFIDENCE_ORDER = { high: 3, medium: 2, low: 1 };

export function resolveSuppliers(input: ResolveInput): ResolvedSupplier[] {
  const {
    quote,
    vendorRequests = [],
    organizationVendors = [],
    organizationVendorProducts = [],
  } = input;
  const seen = new Map<string, ResolvedSupplier>(); // key: lowercase email
  // #vendor-partnership-tier Phase 3 — overlay lock.
  //   email 의 tier 가 명시적으로 결정되면 후속 source 가 confidence 덮어쓰지
  //   않음 (org override > vendor baseline 정합 보호).
  const tierLocked = new Set<string>();

  // ── 1. Past vendor requests (highest priority — known contacts) ──
  for (const vr of vendorRequests) {
    if (!vr.vendorEmail) continue;
    const email = vr.vendorEmail.trim().toLowerCase();
    if (!email || seen.has(email)) continue;

    const hasResponded = vr.status === "RESPONDED";
    seen.set(email, {
      vendorId: vr.id,
      vendorName: vr.vendorName || email.split("@")[0],
      email: vr.vendorEmail.trim(),
      contactSource: "recent_rfq",
      confidence: hasResponded ? "high" : "medium",
      reason: hasResponded
        ? "이전 견적에 회신한 공급사"
        : "이전 견적 발송 이력",
      lastUsed: vr.respondedAt || vr.createdAt || undefined,
      included: hasResponded, // 회신 이력이 있으면 기본 포함
    });
  }

  // ── 2. Organization vendors (#user-supplier-registration Phase 3) ──
  // operator 가 명시적으로 등록한 거래처 — recent_rfq 보다 낮지만 supplier_book
  // 보다 높은 우선순위. 같은 email 이 recent_rfq 에 이미 있으면 skip (recent_rfq
  // 의 lastUsed 정보 보존).
  // #vendor-partnership-tier Phase 3 — partnershipTier 명시 시 tierConf 사용
  // (DIRECT_PARTNER/VERIFIED → high, GENERAL → medium, UNVERIFIED → low).
  // 명시 없으면 기존 isPrimary 분기 (backward compat).
  for (const ov of organizationVendors) {
    if (!ov.vendorEmail) continue;
    const email = ov.vendorEmail.trim().toLowerCase();
    if (!email || seen.has(email)) continue;

    const tierConf = tierToConfidence(ov.partnershipTier);
    const confidence: "high" | "medium" | "low" =
      tierConf ?? (ov.isPrimary ? "high" : "medium");
    const tierReason = ov.partnershipTier
      ? ` · ${ov.partnershipTier}`
      : "";

    seen.set(email, {
      vendorId: ov.id,
      vendorName: ov.vendorName || email.split("@")[0],
      email: ov.vendorEmail.trim(),
      contactSource: "org_book",
      confidence,
      reason: (ov.isPrimary ? "조직 거래처 (우선)" : "조직 거래처") + tierReason,
      included: true, // operator 직접 등록 → 기본 포함
    });
    if (tierConf) tierLocked.add(email);
  }

  // ── 3. Product-linked vendors (supplier book) ──
  // #vendor-partnership-tier Phase 3 — vendor.partnershipTier (글로벌 baseline)
  //   가 confidence 결정. tier 명시 없으면 기존 "high" 보존 (backward compat).
  //   overlay: org override 가 이미 결정되어 tierLocked 면 confidence 보존.
  const items = quote.items || [];
  for (const item of items) {
    const productVendors = item.product?.vendors || [];
    for (const pv of productVendors) {
      const vendor = pv.vendor;
      if (!vendor?.email) continue;
      const email = vendor.email.trim().toLowerCase();
      const baselineConf = tierToConfidence(vendor.partnershipTier);

      if (seen.has(email)) {
        // Already from recent_rfq 또는 org_book.
        if (tierLocked.has(email)) continue; // overlay 보호 — org override winner.
        // backward compat upgrade — tier 명시 없을 때만 기존 동작.
        const existing = seen.get(email)!;
        const targetConf: "high" | "medium" | "low" = baselineConf ?? "high";
        if (CONFIDENCE_ORDER[existing.confidence] < CONFIDENCE_ORDER[targetConf]) {
          existing.confidence = targetConf;
          existing.reason = `${existing.reason} + 제품 공급사 DB 일치`;
        }
        continue;
      }

      seen.set(email, {
        vendorId: vendor.id || `product-vendor-${email}`,
        vendorName: vendor.name || email.split("@")[0],
        email: vendor.email.trim(),
        contactSource: "supplier_book",
        confidence: baselineConf ?? "high",
        reason: `${item.product?.name || "품목"} 등록 공급사`,
        included: true,
      });
      if (baselineConf) tierLocked.add(email);
    }
  }

  // ── 3. AI-extracted vendor (lowest priority — may not have email) ──
  // quote.vendor is often just a name string without email
  // We only add it if it looks like it might contain an email pattern
  if (quote.vendor && quote.vendor.includes("@")) {
    const email = quote.vendor.trim().toLowerCase();
    if (!seen.has(email)) {
      seen.set(email, {
        vendorId: `ai-${quote.id}`,
        vendorName: email.split("@")[0],
        email: quote.vendor.trim(),
        contactSource: "ai_recommended",
        confidence: (quote.confidence as "high" | "medium" | "low") || "medium",
        reason: "AI가 견적서에서 추출한 공급사",
        included: false, // AI 추출은 기본 미포함, 사용자 확인 필요
      });
    }
  }

  // #vendor-catalog-product-matching Phase 3 — product matching → confidence boost.
  //   quote.items 의 productId 와 organizationVendorProducts 의 productId 매칭 시,
  //   해당 vendorId 보유한 supplier 의 confidence 를 한 단계 boost
  //   (low → medium, medium → high, high stays). 호영님 결정 4A.
  //   reason 에 "취급 제품 일치" marker 추가.
  if (organizationVendorProducts.length > 0) {
    const quoteProductIds = new Set<string>();
    for (const item of quote.items || []) {
      if (item.product?.id) quoteProductIds.add(item.product.id);
    }
    if (quoteProductIds.size > 0) {
      const matchedVendorIds = new Set<string>();
      for (const ovp of organizationVendorProducts) {
        if (quoteProductIds.has(ovp.productId)) {
          matchedVendorIds.add(ovp.vendorId);
        }
      }
      if (matchedVendorIds.size > 0) {
        for (const supplier of seen.values()) {
          if (matchedVendorIds.has(supplier.vendorId)) {
            // boost: low → medium, medium → high, high stays.
            if (supplier.confidence === "low") {
              supplier.confidence = "medium";
            } else if (supplier.confidence === "medium") {
              supplier.confidence = "high";
            }
            supplier.reason = supplier.reason
              ? `${supplier.reason} + 취급 제품 일치`
              : "취급 제품 일치";
          }
        }
      }
    }
  }

  // Sort: included first, then by confidence desc
  const result = Array.from(seen.values());
  result.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1;
    return CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
  });

  return result;
}

/**
 * 견적 데이터 기반으로 발송 메시지 초안을 생성합니다.
 */
export function buildDraftMessage(quote: ResolveInput["quote"]): string {
  const items = quote.items || [];
  const itemCount = items.length;
  const title = quote.title || "요청 품목";

  const lines: string[] = [
    "안녕하세요,",
    "",
    `아래 ${itemCount}건 품목에 대한 견적을 요청드립니다.`,
    "",
  ];

  // Add first 3 items as context
  const preview = items.slice(0, 3);
  for (const item of preview) {
    const name = item.product?.name || "제품명 미정";
    const brand = item.product?.brand;
    lines.push(`  - ${name}${brand ? ` (${brand})` : ""}`);
  }
  if (items.length > 3) {
    lines.push(`  - 외 ${items.length - 3}건`);
  }

  lines.push("");
  lines.push("납기, 재고, 최소 주문 수량, 단가를 포함하여 회신 부탁드립니다.");
  lines.push("");
  lines.push("감사합니다.");

  return lines.join("\n");
}
