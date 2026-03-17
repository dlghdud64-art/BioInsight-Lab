import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { generateCompareInsight } from "@/lib/compare-workspace/compare-insight-generator";

// fetch 모킹
const mockFetch = jest.fn() as jest.Mock<any>;
(global as any).fetch = mockFetch;

const mockDiffResult = {
  compareId: "test-1",
  sourceEntityId: "prod-a",
  targetEntityId: "prod-b",
  compareType: "PRODUCT_VS_PRODUCT" as const,
  totalFieldsCompared: 10,
  totalDifferences: 3,
  items: [
    {
      fieldKey: "manufacturer" as const,
      fieldLabel: "브랜드/제조사",
      diffType: "DIFFERENT" as const,
      sourceValue: "Sigma-Aldrich",
      targetValue: "Fisher Scientific",
      significance: "HIGH" as const,
      actionability: "REQUIRES_REVIEW" as const,
    },
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
      fieldKey: "packSize" as const,
      fieldLabel: "규격",
      diffType: "IDENTICAL" as const,
      sourceValue: "2.5L",
      targetValue: "2.5L",
      significance: "MEDIUM" as const,
      actionability: "INFORMATIONAL" as const,
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
    highCount: 3,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
    overallVerdict: "SIGNIFICANT_DIFFERENCES" as const,
    verdictReason: "중요 차이 3건 발견.",
  },
  ontologyHints: [],
  computedAt: new Date(),
};

describe("generateCompareInsight", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it("should generate fallback insight when API key is not set", async () => {
    const insight = await generateCompareInsight(mockDiffResult, "Product A", "Product B");

    expect(insight).toBeDefined();
    expect(insight.keyChanges).toBeInstanceOf(Array);
    expect(insight.keyChanges.length).toBeGreaterThan(0);
    expect(insight.recommendedActions).toBeInstanceOf(Array);
    expect(insight.generatedAt).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should include INQUIRE_VENDOR action when price/leadtime differs", async () => {
    const insight = await generateCompareInsight(mockDiffResult, "Product A", "Product B");

    const vendorAction = insight.recommendedActions.find(
      (a) => a.actionType === "INQUIRE_VENDOR"
    );
    expect(vendorAction).toBeDefined();
    expect(vendorAction?.label).toContain("공급사");
  });

  it("should call OpenAI API when key is set", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyChanges: ["가격 차이 발견"],
                reviewPoints: [],
                recommendedActions: [{ actionType: "INQUIRE_VENDOR", label: "문의", description: "test" }],
                uncertainFields: [],
                overallAssessment: "검토 필요",
              }),
            },
          },
        ],
      }),
    } as any);

    const insight = await generateCompareInsight(mockDiffResult, "Product A", "Product B");

    expect(mockFetch).toHaveBeenCalled();
    expect(insight.keyChanges).toContain("가격 차이 발견");
  });

  it("should fallback gracefully on API error", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    const insight = await generateCompareInsight(mockDiffResult, "Product A", "Product B");

    expect(insight).toBeDefined();
    expect(insight.keyChanges.length).toBeGreaterThan(0);
  });

  it("should flag SOURCE_ONLY items as uncertain fields", async () => {
    const diffWithMissing = {
      ...mockDiffResult,
      items: [
        ...mockDiffResult.items,
        {
          fieldKey: "storageCondition" as const,
          fieldLabel: "보관 조건",
          diffType: "SOURCE_ONLY" as const,
          sourceValue: "냉장 보관",
          targetValue: null,
          significance: "CRITICAL" as const,
          actionability: "REQUIRES_DECISION" as const,
        },
      ],
      totalDifferences: 4,
    };

    const insight = await generateCompareInsight(diffWithMissing, "A", "B");
    expect(insight.uncertainFields.length).toBeGreaterThan(0);
    expect(insight.uncertainFields[0].field).toBe("보관 조건");
  });
});
