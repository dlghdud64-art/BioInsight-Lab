import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const extractSchema = z.object({
  text: z.string().min(10, "프로토콜 텍스트는 최소 10자 이상이어야 합니다.").max(50000, "프로토콜 텍스트는 최대 50,000자까지 입력 가능합니다."),
});

/**
 * POST /api/protocol/extract
 * Extract items from protocol text
 * 
 * Request Body:
 * {
 *   text: string; // Protocol text to extract items from
 * }
 * 
 * Response Format:
 * {
 *   items: Array<{
 *     id: string;
 *     name: string;
 *     category?: string;
 *     quantity?: string;
 *     unit?: string;
 *     confidence?: "high" | "medium" | "low";
 *     evidence?: string; // Source text from protocol
 *   }>;
 *   summary?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body with validation
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { 
          error: "Invalid JSON format",
          message: "요청 본문이 올바른 JSON 형식이 아닙니다."
        },
        { status: 400 }
      );
    }

    // Validate input schema
    let validatedData;
    try {
      validatedData = extractSchema.parse(body);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      if (validationError instanceof z.ZodError) {
        const firstError = validationError.errors[0];
        return NextResponse.json(
          { 
            error: "Validation failed",
            message: firstError.message,
            details: validationError.errors
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { 
          error: "Validation failed",
          message: "입력 데이터 검증에 실패했습니다."
        },
        { status: 400 }
      );
    }

    const { text } = validatedData;
    console.log("[Protocol Extract] Processing text, length:", text.length);

    // TODO: Implement actual AI extraction logic
    // For now, return mock data
    try {
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

      console.log("[Protocol Extract] Success, extracted", mockResult.items.length, "items");
      return NextResponse.json(mockResult);
    } catch (processingError) {
      console.error("[Protocol Extract] Processing error:", processingError);
      return NextResponse.json(
        { 
          error: "Processing failed",
          message: "프로토콜 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // Catch-all error handler
    console.error("[Protocol Extract] Unexpected error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      },
      { status: 500 }
    );
  }
}
