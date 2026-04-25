/**
 * apps/web/src/__tests__/lib/ontology/purchase-conversion-resolver.test.ts
 *
 * Tests for #P02 Phase B-α resolver. Table-driven where possible.
 * 27 cases as called out in PLAN_phase-b-alpha-purchase-conversion.md §α-A.
 */

import { describe, it, expect } from "vitest";
import {
  resolvePurchaseConversion,
  type PurchaseConversionInput,
  type QuoteInput,
  type QuoteVendorInput,
  type QuoteVendorRequestInput,
  type QuoteReplyInput,
  type OrderInput,
  type AiActionInput,
} from "@/lib/ontology/purchase-conversion-resolver";

// ──────────────────────────────────────────────────────────
// Builders
// ──────────────────────────────────────────────────────────

const NOW = new Date("2026-04-25T12:00:00Z");

function quote(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    id: "q1",
    title: "Test Quote",
    description: null,
    status: "RESPONDED",
    totalAmount: 1_000_000,
    currency: "KRW",
    quoteNumber: "Q-20260425-0001",
    validUntil: new Date("2026-05-25T00:00:00Z"),
    createdAt: new Date("2026-04-20T00:00:00Z"),
    ...overrides,
  };
}

function vendor(name: string, overrides: Partial<QuoteVendorInput> = {}): QuoteVendorInput {
  return { id: `v-${name}`, vendorName: name, email: null, ...overrides };
}

function vendorRequest(
  name: string | null,
  responded: boolean,
  overrides: Partial<QuoteVendorRequestInput> = {},
): QuoteVendorRequestInput {
  return {
    id: `vr-${name ?? "anon"}`,
    vendorName: name,
    vendorEmail: null,
    status: responded ? "RESPONDED" : "SENT",
    respondedAt: responded ? new Date("2026-04-22T00:00:00Z") : null,
    ...overrides,
  };
}

function reply(name: string | null, fromEmail: string): QuoteReplyInput {
  return {
    id: `r-${name ?? fromEmail}`,
    vendorName: name,
    fromEmail,
    receivedAt: new Date("2026-04-22T00:00:00Z"),
  };
}

function order(status: string): OrderInput {
  return { id: "o1", orderNumber: "ORD-20260425-0001", status };
}

function aiAction(overrides: Partial<AiActionInput> = {}): AiActionInput {
  return {
    id: "a1",
    type: "VENDOR_RESPONSE_PARSED",
    status: "PENDING",
    taskStatus: "READY",
    ...overrides,
  };
}

function input(
  overrides: Partial<PurchaseConversionInput> = {},
): PurchaseConversionInput {
  return {
    quote: quote(),
    vendors: [],
    vendorRequests: [],
    replies: [],
    order: null,
    aiActions: [],
    now: NOW,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────
// 1) Empty quote — bare minimum input
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — empty quote", () => {
  it("[1] empty quote, no vendors, no replies → review_required, none, review_selection", () => {
    const r = resolvePurchaseConversion(input());
    expect(r.conversionStatus).toBe("review_required");
    expect(r.blockerType).toBe("none");
    expect(r.nextAction).toBe("review_selection");
    expect(r.supplierReplies).toBe(0);
    expect(r.totalSuppliers).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────
// 2-4) Reply ratio variants
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — reply ratio", () => {
  it("[2] 3 vendors, 0 replies → review_required, partial_reply, wait_reply", () => {
    const r = resolvePurchaseConversion(
      input({ vendors: [vendor("V1"), vendor("V2"), vendor("V3")] }),
    );
    expect(r.totalSuppliers).toBe(3);
    expect(r.supplierReplies).toBe(0);
    expect(r.blockerType).toBe("partial_reply");
    expect(r.nextAction).toBe("wait_reply");
  });

  it("[3] 3 vendors, 2 replies → still partial_reply, wait_reply", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("V1"), vendor("V2"), vendor("V3")],
        replies: [reply("V1", "v1@x.com"), reply("V2", "v2@x.com")],
      }),
    );
    expect(r.supplierReplies).toBe(2);
    expect(r.totalSuppliers).toBe(3);
    expect(r.blockerType).toBe("partial_reply");
    expect(r.nextAction).toBe("wait_reply");
  });

  it("[4] 3 vendors, 3 replies, status RESPONDED → ready_for_po, approval_unknown, check_external_approval", () => {
    // ready_for_po surfaces approval_unknown because Approval model isn't built yet (plan §0.2)
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("V1"), vendor("V2"), vendor("V3")],
        replies: [reply("V1", "v1@x.com"), reply("V2", "v2@x.com"), reply("V3", "v3@x.com")],
      }),
    );
    expect(r.supplierReplies).toBe(3);
    expect(r.totalSuppliers).toBe(3);
    expect(r.conversionStatus).toBe("ready_for_po");
    expect(r.blockerType).toBe("approval_unknown");
    expect(r.nextAction).toBe("check_external_approval");
  });
});

// ──────────────────────────────────────────────────────────
// 5-10) QuoteStatus / Order shape decode
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — status / order decode", () => {
  it("[5] quote.status COMPLETED + no order → ready_for_po", () => {
    const r = resolvePurchaseConversion(input({ quote: quote({ status: "COMPLETED" }) }));
    expect(r.conversionStatus).toBe("ready_for_po");
  });

  it("[6] quote.status COMPLETED + order ORDERED → ready_for_po", () => {
    const r = resolvePurchaseConversion(
      input({ quote: quote({ status: "COMPLETED" }), order: order("ORDERED") }),
    );
    expect(r.conversionStatus).toBe("ready_for_po");
  });

  it("[7] quote.status PURCHASED → confirmed, blockerType none, nextAction prepare_po", () => {
    const r = resolvePurchaseConversion(input({ quote: quote({ status: "PURCHASED" }) }));
    expect(r.conversionStatus).toBe("confirmed");
    expect(r.blockerType).toBe("none");
    expect(r.nextAction).toBe("prepare_po");
  });

  it("[8] quote.status CANCELLED → hold, blockerType none", () => {
    const r = resolvePurchaseConversion(input({ quote: quote({ status: "CANCELLED" }) }));
    expect(r.conversionStatus).toBe("hold");
    expect(r.blockerType).toBe("none");
  });

  it("[9] order DELIVERED → confirmed", () => {
    const r = resolvePurchaseConversion(input({ order: order("DELIVERED") }));
    expect(r.conversionStatus).toBe("confirmed");
    expect(r.nextAction).toBe("prepare_po");
  });

  it("[10] order ORDERED + quote.status PENDING → ready_for_po (order presence wins)", () => {
    const r = resolvePurchaseConversion(
      input({ quote: quote({ status: "PENDING" }), order: order("ORDERED") }),
    );
    expect(r.conversionStatus).toBe("ready_for_po");
  });
});

// ──────────────────────────────────────────────────────────
// 11-12) Expiry / lead_time
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — expiry", () => {
  it("[11] expired quote → isExpired true, blockerType lead_time", () => {
    const r = resolvePurchaseConversion(
      input({
        quote: quote({ validUntil: new Date("2026-04-20T00:00:00Z") }),
        vendors: [vendor("V1")],
        replies: [reply("V1", "v1@x.com")],
      }),
    );
    expect(r.isExpired).toBe(true);
    expect(r.blockerType).toBe("lead_time");
  });

  it("[12] non-expired quote → isExpired false", () => {
    const r = resolvePurchaseConversion(input());
    expect(r.isExpired).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 13) Reply count = vendor count, no expiry
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — full reply set", () => {
  it("[13] 2 vendors, 2 replies (status RESPONDED) → ready_for_po, approval_unknown", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("V1"), vendor("V2")],
        replies: [reply("V1", "v1@x.com"), reply("V2", "v2@x.com")],
      }),
    );
    expect(r.conversionStatus).toBe("ready_for_po");
    expect(r.blockerType).toBe("approval_unknown");
  });
});

// ──────────────────────────────────────────────────────────
// 14-16) totalSuppliers source variations
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — supplier counting paths", () => {
  it("[14] vendorRequests only (no static vendors) → totalSuppliers from requests", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [],
        vendorRequests: [
          vendorRequest("V1", true),
          vendorRequest("V2", true),
          vendorRequest("V3", false),
        ],
      }),
    );
    expect(r.totalSuppliers).toBe(3);
    expect(r.supplierReplies).toBe(2);
    expect(r.blockerType).toBe("partial_reply");
  });

  it("[15] both vendors and vendorRequests present → uses max for totalSuppliers", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("V1"), vendor("V2")],
        vendorRequests: [
          vendorRequest("V1", true),
          vendorRequest("V2", true),
          vendorRequest("V3", false),
        ],
      }),
    );
    expect(r.totalSuppliers).toBe(3);
  });

  it("[16] more replies than declared vendors (manual reply path) → supplierReplies still tallied", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("V1")],
        replies: [
          reply("V1", "v1@x.com"),
          reply("V2", "v2@x.com"),
          reply(null, "unknown@x.com"),
        ],
      }),
    );
    // total comes from max(vendors.length, vendorRequests.length) = 1
    expect(r.totalSuppliers).toBe(1);
    // dedupe by name|email — "V1", "v2@x.com", "unknown@x.com" → 3
    expect(r.supplierReplies).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────
// 17-20) AI signal decode
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — AI recommendation status", () => {
  it("[17] AI action APPROVED COMPARE_DECISION → recommended", () => {
    const r = resolvePurchaseConversion(
      input({
        aiActions: [
          aiAction({ type: "COMPARE_DECISION", status: "APPROVED", taskStatus: "READY" }),
        ],
      }),
    );
    expect(r.aiRecommendationStatus).toBe("recommended");
  });

  it("[18] AI action REVIEW_NEEDED VENDOR_RESPONSE_PARSED → review_needed", () => {
    const r = resolvePurchaseConversion(
      input({
        aiActions: [
          aiAction({
            type: "VENDOR_RESPONSE_PARSED",
            status: "PENDING",
            taskStatus: "REVIEW_NEEDED",
          }),
        ],
      }),
    );
    expect(r.aiRecommendationStatus).toBe("review_needed");
  });

  it("[19] no AI actions, replies present → recommended (rule-based fallback)", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("V1")],
        replies: [reply("V1", "v1@x.com")],
      }),
    );
    expect(r.aiRecommendationStatus).toBe("recommended");
  });

  it("[20] no AI actions, no replies → hold", () => {
    const r = resolvePurchaseConversion(input());
    expect(r.aiRecommendationStatus).toBe("hold");
  });
});

// ──────────────────────────────────────────────────────────
// 21) createdDaysAgo math
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — createdDaysAgo", () => {
  it.each([
    { label: "today", createdAt: NOW, expected: 0 },
    {
      label: "1 day ago",
      createdAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      expected: 1,
    },
    {
      label: "30 days ago",
      createdAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
      expected: 30,
    },
    {
      label: "future-dated (created after now) clamps to 0",
      createdAt: new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000),
      expected: 0,
    },
  ])("[21:$label] → $expected", ({ createdAt, expected }) => {
    const r = resolvePurchaseConversion(input({ quote: quote({ createdAt }) }));
    expect(r.createdDaysAgo).toBe(expected);
  });
});

// ──────────────────────────────────────────────────────────
// 22) Currency passthrough
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — currency", () => {
  it.each(["KRW", "USD", "EUR"])("[22:%s] currency passes through unchanged", (cur) => {
    const r = resolvePurchaseConversion(input({ quote: quote({ currency: cur }) }));
    expect(r.currency).toBe(cur);
  });
});

// ──────────────────────────────────────────────────────────
// 23) quoteNumber present vs null
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — quoteNumber passthrough", () => {
  it("[23a] quoteNumber present → passed through", () => {
    const r = resolvePurchaseConversion(
      input({ quote: quote({ quoteNumber: "Q-20260101-9999" }) }),
    );
    expect(r.quoteNumber).toBe("Q-20260101-9999");
  });

  it("[23b] quoteNumber null → passed through as null", () => {
    const r = resolvePurchaseConversion(input({ quote: quote({ quoteNumber: null }) }));
    expect(r.quoteNumber).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────
// 24) description → itemSummary fallback
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — itemSummary derivation", () => {
  it("[24a] description present → used verbatim", () => {
    const r = resolvePurchaseConversion(
      input({ quote: quote({ description: "PCR 튜브 외 3건" }) }),
    );
    expect(r.itemSummary).toBe("PCR 튜브 외 3건");
  });

  it("[24b] description null + vendors present → '공급사 N곳'", () => {
    const r = resolvePurchaseConversion(
      input({ vendors: [vendor("V1"), vendor("V2")] }),
    );
    expect(r.itemSummary).toBe("공급사 2곳");
  });

  it("[24c] description null + no vendors → '품목 정보 없음'", () => {
    const r = resolvePurchaseConversion(input());
    expect(r.itemSummary).toBe("품목 정보 없음");
  });
});

// ──────────────────────────────────────────────────────────
// 25) aiOptions enumeration + recommendationLevel
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — aiOptions", () => {
  it("[25a] 3 vendors, 2 replied → first is primary, replied are alternate, unreplied are conservative", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("V1"), vendor("V2"), vendor("V3")],
        replies: [reply("V1", "v1@x.com"), reply("V2", "v2@x.com")],
      }),
    );
    expect(r.aiOptions.length).toBe(3);
    expect(r.aiOptions[0].recommendationLevel).toBe("primary");
    // V2 (replied) → alternate; V3 (unreplied) → conservative
    const v2 = r.aiOptions.find((o) => o.supplierName === "V2");
    const v3 = r.aiOptions.find((o) => o.supplierName === "V3");
    expect(v2?.recommendationLevel).toBe("alternate");
    expect(v3?.recommendationLevel).toBe("conservative");
  });

  it("[25b] all aiOptions have null price/leadDays/moq in v0", () => {
    const r = resolvePurchaseConversion(
      input({ vendors: [vendor("V1")], replies: [reply("V1", "v1@x.com")] }),
    );
    expect(r.aiOptions.every((o) => o.price === null)).toBe(true);
    expect(r.aiOptions.every((o) => o.leadDays === null)).toBe(true);
    expect(r.aiOptions.every((o) => o.moq === null)).toBe(true);
  });

  it("[25c] dedupes the same supplier across vendors / replies / vendorRequests", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("Acme")],
        vendorRequests: [vendorRequest("Acme", true)],
        replies: [reply("Acme", "acme@x.com")],
      }),
    );
    expect(r.aiOptions.length).toBe(1);
    expect(r.aiOptions[0].supplierName).toBe("Acme");
  });
});

// ──────────────────────────────────────────────────────────
// 26-27) v0 stubs (externalApprovalStatus, selectedOptionId)
// ──────────────────────────────────────────────────────────

describe("resolvePurchaseConversion — v0 placeholders", () => {
  it("[26] externalApprovalStatus is always 'unknown' in v0", () => {
    const cases = [
      input(),
      input({ vendors: [vendor("V1")] }),
      input({ order: order("DELIVERED") }),
      input({ quote: quote({ status: "PURCHASED" }) }),
    ];
    for (const c of cases) {
      expect(resolvePurchaseConversion(c).externalApprovalStatus).toBe("unknown");
    }
  });

  it("[27] selectedOptionId is always null in v0", () => {
    const r = resolvePurchaseConversion(
      input({
        vendors: [vendor("V1")],
        replies: [reply("V1", "v1@x.com")],
      }),
    );
    expect(r.selectedOptionId).toBeNull();
  });
});
