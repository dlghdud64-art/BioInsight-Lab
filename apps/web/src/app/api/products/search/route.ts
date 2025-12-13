import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/api/products";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dummyProducts } from "@/data/dummy-products";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = request.nextUrl.searchParams;
    
    const query = searchParams.get("query") || searchParams.get("q") || "";
    const category = searchParams.get("category");
    const sortBy = (searchParams.get("sortBy") as any) || "relevance";
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 20;

    // 더미 데이터 사용 (임시)
    let results = dummyProducts.filter((p) => {
      if (query) {
        const q = query.toLowerCase().trim();
        const matches = 
          p.name.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q)) ||
          (p.catalogNumber?.toLowerCase().includes(q)); // Cat.No 검색 추가
        if (!matches) return false;
      }
      if (category && category !== "all") {
        if (p.category !== category) return false;
      }
      return true;
    });

    // Cat.No로 검색한 경우, 정확히 일치하는 제품을 우선순위로 정렬
    if (query) {
      const q = query.toLowerCase().trim();
      const exactCatalogMatch = results.find((p) => 
        p.catalogNumber?.toLowerCase() === q
      );
      
      if (exactCatalogMatch) {
        // 정확히 일치하는 제품을 맨 앞으로
        results = results.filter((p) => p.id !== exactCatalogMatch.id);
        results.unshift(exactCatalogMatch);
        
        // 같은 Cat.No를 가진 다른 제품들도 함께 표시 (같은 Cat.No를 가진 제품이 여러 개일 수 있음)
        const sameCatalogProducts = dummyProducts.filter((p) => 
          p.catalogNumber?.toLowerCase() === q && p.id !== exactCatalogMatch.id
        );
        if (sameCatalogProducts.length > 0) {
          results = [exactCatalogMatch, ...sameCatalogProducts, ...results];
        }
      } else {
        // 부분 일치하는 Cat.No 제품을 우선순위로
        const catalogMatches = results.filter((p) => 
          p.catalogNumber?.toLowerCase().includes(q)
        );
        const otherMatches = results.filter((p) => 
          !p.catalogNumber?.toLowerCase().includes(q)
        );
        results = [...catalogMatches, ...otherMatches];
      }
    }

    // 정렬
    if (sortBy === "price_low") {
      results.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_high") {
      results.sort((a, b) => b.price - a.price);
    }

    // 페이지네이션
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedResults = results.slice(start, end);

    // API 형식에 맞게 변환
    const result = {
      products: paginatedResults.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.vendor,
        category: p.category,
        catalogNumber: p.catalogNumber,
        description: p.description,
        vendors: [{
          id: `${p.id}-vendor`,
          vendor: {
            id: p.vendor.toLowerCase().replace(/\s+/g, "-"),
            name: p.vendor,
          },
          priceInKRW: p.price,
          currency: "KRW",
        }],
      })),
      total: results.length,
      page,
      limit,
    };

    // 기존 코드 (주석 처리)
    /*
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
    */

    // 검색 기록 저장 (비동기, 에러가 나도 검색 결과는 반환)
    if (query && session?.user?.id) {
      try {
        await db.searchHistory.create({
          data: {
            userId: session.user.id,
            query: query,
            category: category || null,
            filters: null, // 더미 데이터에서는 필터 없음
            // 타입 에러 수정: result가 products 속성을 가지는지 확인
            resultCount: (result as any).products?.length || 0,
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