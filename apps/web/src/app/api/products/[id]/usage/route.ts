import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/api/products";
import { generateProductUsageDescription } from "@/lib/ai/openai";

// 제품 사용 용도 설명 생성 API
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getProductById(id);

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const usageDescription = await generateProductUsageDescription(
      product.name,
      product.description || undefined,
      product.category || undefined,
      product.specification || undefined
    );

    return NextResponse.json({
      usageDescription,
    });
  } catch (error: any) {
    console.error("Error generating usage description:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate usage description" },
      { status: 500 }
    );
  }
}



