import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRecentProducts } from "@/lib/api/search-history";

// 최근 본 제품 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id || null;

    const limit = request.nextUrl.searchParams.get("limit")
      ? parseInt(request.nextUrl.searchParams.get("limit")!)
      : 20;

    const products = await getRecentProducts(userId, limit);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Error fetching recent products:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent products" },
      { status: 500 }
    );
  }
}

