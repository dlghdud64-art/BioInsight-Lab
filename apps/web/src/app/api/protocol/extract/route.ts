import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const extractSchema = z.object({
  text: z.string().min(1),
});

/**
 * POST /api/protocol/extract
 * Extract items from protocol text
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = extractSchema.parse(body);

    console.log("Extracting protocol text, length:", text.length);

    // TODO: Implement actual AI extraction logic
    // Mock data for now
    const mockResult = {
      items: [
        {
          id: "ext-1",
          name: "PBS Buffer",
          category: "시약",
          quantity: "5",
          unit: "ml",
          confidence: "high" as const,
          evidence: "Add 5ml of PBS buffer to the cell culture.",
        },
        {
          id: "ext-2",
          name: "Trypsin-EDTA Solution",
          category: "시약",
          quantity: "2",
          unit: "ml",
          confidence: "high" as const,
          evidence: "Add trypsin-EDTA solution and incubate.",
        },
        {
          id: "ext-3",
          name: "Cell Culture Plate",
          category: "소모품",
          confidence: "medium" as const,
          evidence: "Transfer cells to culture plate.",
        },
        {
          id: "ext-4",
          name: "Unknown Reagent",
          category: "시약",
          confidence: "low" as const,
          evidence: "Add reagent X (unclear specification).",
        },
      ],
      summary: "Cell culture protocol requiring PBS buffer, trypsin-EDTA, and culture plates.",
    };

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return NextResponse.json(mockResult);
  } catch (error) {
    console.error("Extract error:", error);
    return NextResponse.json(
      { error: "Failed to extract protocol" },
      { status: 500 }
    );
  }
}
