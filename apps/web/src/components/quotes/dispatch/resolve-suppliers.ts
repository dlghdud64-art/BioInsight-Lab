/**
 * resolve-suppliers.ts
 *
 * 견적 데이터에서 발송 대상 공급사를 자동 추출합니다.
 * VendorRequestModal에 resolvedSuppliers prop으로 전달하여
 * manual compose 대신 readiness-first UX를 기본 경로로 만듭니다.
 *
 * 우선순위:
 *   1. 과거 발송 이력 (recent_rfq) — 이미 이 견적에 발송한 적 있는 공급사
 *   2. 견적 품목에 연결된 공급사 (supplier_book) — 제품 vendor DB
 *   3. AI 추출 공급사 (ai_recommended) — quote.vendor 필드
 *
 * 동일 이메일은 중복 제거하며, 가장 높은 confidence가 우선합니다.
 */

export interface ResolvedSupplier {
  vendorId: string;
  vendorName: string;
  email: string;
  contactSource: "supplier_book" | "recent_rfq" | "ai_recommended" | "manual";
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
        name?: string;
        brand?: string;
        vendors?: Array<{
          vendor?: {
            id?: string;
            name?: string;
            email?: string;
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
}

const CONFIDENCE_ORDER = { high: 3, medium: 2, low: 1 };

export function resolveSuppliers(input: ResolveInput): ResolvedSupplier[] {
  const { quote, vendorRequests = [] } = input;
  const seen = new Map<string, ResolvedSupplier>(); // key: lowercase email

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

  // ── 2. Product-linked vendors (supplier book) ──
  const items = quote.items || [];
  for (const item of items) {
    const productVendors = item.product?.vendors || [];
    for (const pv of productVendors) {
      const vendor = pv.vendor;
      if (!vendor?.email) continue;
      const email = vendor.email.trim().toLowerCase();
      if (seen.has(email)) {
        // Already from recent_rfq — upgrade if needed
        const existing = seen.get(email)!;
        if (CONFIDENCE_ORDER[existing.confidence] < CONFIDENCE_ORDER.high) {
          existing.confidence = "high";
          existing.reason = `${existing.reason} + 제품 공급사 DB 일치`;
        }
        continue;
      }

      seen.set(email, {
        vendorId: vendor.id || `product-vendor-${email}`,
        vendorName: vendor.name || email.split("@")[0],
        email: vendor.email.trim(),
        contactSource: "supplier_book",
        confidence: "high",
        reason: `${item.product?.name || "품목"} 등록 공급사`,
        included: true,
      });
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
  lines.push("납기, 재고, MOQ, 단가를 포함하여 회신 부탁드립니다.");
  lines.push("");
  lines.push("감사합니다.");

  return lines.join("\n");
}
