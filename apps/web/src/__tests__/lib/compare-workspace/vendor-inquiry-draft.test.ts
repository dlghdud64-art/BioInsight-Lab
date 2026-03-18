import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { generateVendorInquiryDraft } from "@/lib/compare-workspace/vendor-inquiry-draft";

(global as any).fetch = jest.fn();

const mockDiffResult = {
  compareId: "test-1",
  sourceEntityId: "prod-a",
  targetEntityId: "prod-b",
  compareType: "PRODUCT_VS_PRODUCT" as const,
  totalFieldsCompared: 10,
  totalDifferences: 2,
  items: [
    {
      fieldKey: "quoteAmount" as const,
      fieldLabel: "최저가 (₩)",
      diffType: "DIFFERENT" as const,
      sourceValue: 85000,
      targetValue: 72000,
      significance: "HIGH" as const,
      actionability: "REQUIRES_REVIEW" as const,
    },
    {
      fieldKey: "leadTimeDays" as const,
      fieldLabel: "최단 납기 (일)",
      diffType: "DIFFERENT" as const,
      sourceValue: 7,
      targetValue: 14,
      significance: "HIGH" as const,
      actionability: "REQUIRES_INQUIRY" as const,
    },
  ],
  summary: {
    criticalCount: 0,
    highCount: 2,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
    overallVerdict: "MINOR_DIFFERENCES" as const,
    verdictReason: "경미한 차이",
  },
  ontologyHints: [],
  computedAt: new Date(),
};

describe("generateVendorInquiryDraft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it("should generate a fallback draft when API key is not set", async () => {
    const result = await generateVendorInquiryDraft({
      diffResult: mockDiffResult,
      sourceProductName: "Methanol HPLC",
      targetProductName: "Methanol ACS",
      vendorName: "Fisher Scientific",
    });

    expect(result.subject).toContain("Methanol ACS");
    expect(result.body).toContain("LabAxis");
    expect(result.vendorName).toBe("Fisher Scientific");
    expect(result.productName).toBe("Methanol ACS");
    expect(result.inquiryFields.length).toBeGreaterThan(0);
    expect(result.generatedAt).toBeDefined();
  });

  it("should include diff fields in inquiry items", async () => {
    const result = await generateVendorInquiryDraft({
      diffResult: mockDiffResult,
      sourceProductName: "A",
      targetProductName: "B",
      vendorName: "Vendor",
    });

    expect(result.inquiryFields).toContain("최저가 (₩)");
    expect(result.inquiryFields).toContain("최단 납기 (일)");
  });

  it("should generate non-empty subject and body", async () => {
    const result = await generateVendorInquiryDraft({
      diffResult: mockDiffResult,
      sourceProductName: "A",
      targetProductName: "B",
      vendorName: "TestVendor",
    });

    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
  });
});
