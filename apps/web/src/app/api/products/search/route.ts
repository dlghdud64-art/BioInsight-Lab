import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/api/products";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = request.nextUrl.searchParams;
    
    const params = {
      query: searchParams.get("q") || undefined,
      category: searchParams.get("category") as any,
      brand: searchParams.get("brand") || undefined,
      minPrice: searchParams.get("minPrice")
        ? Number(searchParams.get("minPrice"))
        : undefined,
      maxPrice: searchParams.get("maxPrice")
        ? Number(searchParams.get("maxPrice"))
        : undefined,
      sortBy: (searchParams.get("sortBy") as any) || "relevance",
      page: searchParams.get("page")
        ? Number(searchParams.get("page"))
        : 1,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : 20,
    };

    const result = await searchProducts(params);

    // 검색 기록 저장 (비동기, 에러가 나도 검색 결과는 반환)
    if (params.query && session?.user?.id) {
      try {
        await db.searchHistory.create({
          data: {
            userId: session.user.id,
            query: params.query,
            category: params.category || null,
            filters: params.brand || params.minPrice || params.maxPrice
              ? JSON.parse(JSON.stringify({
                  brand: params.brand,
                  minPrice: params.minPrice,
                  maxPrice: params.maxPrice,
                }))
              : null,
            resultCount: result.products?.length || 0,
          },
        });
      } catch (error) {
        // 검색 기록 저장 실패는 무시
        console.warn("Failed to save search history:", error);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error searching products:", error);
    return NextResponse.json(
      { error: "Failed to search products" },
      { status: 500 }
    );
  }
}

