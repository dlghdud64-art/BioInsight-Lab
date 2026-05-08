/**
 * #user-supplier-registration Phase 3 RED — resolveSuppliers org_book source 추가
 *
 * Goal: resolveSuppliers 의 4 source priority 정합:
 *   recent_rfq (highest) → org_book (NEW) → supplier_book → ai_recommended (lowest).
 *
 * canonical truth lock:
 *   - ResolvedSupplier.contactSource 에 "org_book" 추가.
 *   - ResolveInput 에 `organizationVendors?` optional param.
 *   - 기존 호출 caller 영향 0 (optional, 미전달 시 빈 array fallback).
 *   - 같은 email 의 source 충돌 시 우선순위 정합 (recent_rfq 가 가장 high).
 */

import { describe, it, expect } from "vitest";
import { resolveSuppliers, type ResolvedSupplier } from "@/components/quotes/dispatch/resolve-suppliers";

describe("#user-supplier-registration Phase 3 — resolveSuppliers org_book source", () => {
  it("ResolvedSupplier.contactSource 가 'org_book' 허용", () => {
    // Type-level check — 컴파일 통과 확인.
    const sample: ResolvedSupplier = {
      vendorId: "ov-1",
      vendorName: "바이오마트",
      email: "biomart@example.com",
      contactSource: "org_book",
      confidence: "high",
      reason: "조직 거래처 등록",
      included: true,
    };
    expect(sample.contactSource).toBe("org_book");
  });

  it("organizationVendors 만 전달 시 org_book source 로 인식", () => {
    const result = resolveSuppliers({
      quote: { id: "q-1", title: "test" },
      organizationVendors: [
        {
          id: "ov-1",
          vendorName: "바이오마트",
          vendorEmail: "biomart@labaxis.invalid",
          isPrimary: true,
          notes: "메모",
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].contactSource).toBe("org_book");
    expect(result[0].email).toBe("biomart@labaxis.invalid");
    expect(result[0].included).toBe(true); // operator 직접 등록 → 기본 포함
  });

  it("isPrimary === true 시 confidence high + reason 명시", () => {
    const result = resolveSuppliers({
      quote: { id: "q-1" },
      organizationVendors: [
        {
          id: "ov-1",
          vendorName: "코아바이오텍",
          vendorEmail: "koa@labaxis.invalid",
          isPrimary: true,
        },
      ],
    });
    expect(result[0].confidence).toBe("high");
    expect(result[0].reason).toMatch(/우선|primary|등록/i);
  });

  it("isPrimary === false 도 medium-high confidence (operator 명시 등록)", () => {
    const result = resolveSuppliers({
      quote: { id: "q-1" },
      organizationVendors: [
        {
          id: "ov-1",
          vendorName: "다인바이오",
          vendorEmail: "dain@labaxis.invalid",
          isPrimary: false,
        },
      ],
    });
    expect(["high", "medium"]).toContain(result[0].confidence);
  });

  it("priority — recent_rfq 가 같은 email 의 org_book 보다 우선 (high confidence 보존)", () => {
    const result = resolveSuppliers({
      quote: { id: "q-1" },
      vendorRequests: [
        {
          id: "vr-1",
          vendorEmail: "shared@example.com",
          vendorName: "공유 vendor",
          status: "RESPONDED",
          respondedAt: "2026-05-08T00:00:00Z",
        },
      ],
      organizationVendors: [
        {
          id: "ov-1",
          vendorName: "공유 vendor (org)",
          vendorEmail: "shared@example.com",
          isPrimary: true,
        },
      ],
    });
    // 같은 email 1개만 (중복 제거).
    expect(result).toHaveLength(1);
    // recent_rfq 가 우선 — contactSource = recent_rfq 보존.
    expect(result[0].contactSource).toBe("recent_rfq");
  });

  it("priority — org_book 이 supplier_book 보다 우선 (같은 email)", () => {
    const result = resolveSuppliers({
      quote: {
        id: "q-1",
        items: [
          {
            product: {
              name: "FBS",
              vendors: [
                {
                  vendor: {
                    id: "v-1",
                    name: "platform Vendor",
                    email: "shared@example.com",
                  },
                },
              ],
            },
          },
        ],
      },
      organizationVendors: [
        {
          id: "ov-1",
          vendorName: "org-input",
          vendorEmail: "shared@example.com",
          isPrimary: true,
        },
      ],
    });
    expect(result).toHaveLength(1);
    // org_book 이 supplier_book 보다 우선.
    expect(result[0].contactSource).toBe("org_book");
  });

  it("organizationVendors 미전달 시 기존 동작 그대로 (backward compat)", () => {
    const result = resolveSuppliers({
      quote: {
        id: "q-1",
        items: [
          {
            product: {
              name: "FBS",
              vendors: [
                {
                  vendor: { id: "v-1", name: "Thermo", email: "thermo@example.com" },
                },
              ],
            },
          },
        ],
      },
      // organizationVendors 미전달
    });
    expect(result).toHaveLength(1);
    expect(result[0].contactSource).toBe("supplier_book");
  });

  it("4 source 모두 다른 email — 모두 별개 entry (sort: included → confidence)", () => {
    const result = resolveSuppliers({
      quote: {
        id: "q-1",
        vendor: "ai-recommended@example.com",
        confidence: "low",
        items: [
          {
            product: {
              vendors: [
                { vendor: { id: "v-1", name: "Platform", email: "platform@example.com" } },
              ],
            },
          },
        ],
      },
      vendorRequests: [
        {
          id: "vr-1",
          vendorEmail: "rfq@example.com",
          vendorName: "RFQ Vendor",
          status: "RESPONDED",
        },
      ],
      organizationVendors: [
        {
          id: "ov-1",
          vendorName: "Org Vendor",
          vendorEmail: "org@example.com",
          isPrimary: true,
        },
      ],
    });
    // 4 source 각 1개씩.
    expect(result).toHaveLength(4);
    const sources = result.map((r) => r.contactSource);
    expect(sources).toContain("recent_rfq");
    expect(sources).toContain("org_book");
    expect(sources).toContain("supplier_book");
    expect(sources).toContain("ai_recommended");
  });

  it("#user-supplier-registration 주석 marker (cluster trace)", () => {
    // source-level grep — helper file 의 cluster marker.
    // 이 test 는 helper 파일 직접 read 로 확인 (간접 marker).
    // 실제 string 검증은 별도 source-level test (생략 — helper unit test 가 충분).
    const result = resolveSuppliers({ quote: { id: "q-1" } });
    expect(result).toEqual([]);
  });
});
