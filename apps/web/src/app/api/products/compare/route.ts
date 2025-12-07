import { NextRequest, NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/api/products";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "Product IDs array is required" },
        { status: 400 }
      );
    }

    if (productIds.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 products can be compared" },
        { status: 400 }
      );
    }

    const products = await getProductsByIds(productIds);

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Error comparing products:", error);
    return NextResponse.json(
      { error: "Failed to compare products" },
      { status: 500 }
    );
  }
}

