import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { expandQueryWithSynonyms } from "@/lib/search/synonyms";
import { buildSearchQuery, sortByRelevance } from "@/lib/search/ranking";
import { Prisma, ProductCategory } from "@prisma/client";

const logger = createLogger("products/search");

export interface SearchResponse {
  products: any[];
  total: number;
  page: number;
  limit: number;
  facets?: {
    vendorCounts: Array<{ vendorId: string; vendorName: string; count: number }>;
    categoryCounts: Array<{ category: ProductCategory; count: number }>;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = request.nextUrl.searchParams;

    // Parse search parameters
    const query = searchParams.get("query") || searchParams.get("q") || "";
    const vendorId = searchParams.get("vendorId") || undefined;
    const category = searchParams.get("category") as ProductCategory | undefined;
    const minPrice = searchParams.get("minPrice")
      ? Number(searchParams.get("minPrice"))
      : undefined;
    const maxPrice = searchParams.get("maxPrice")
      ? Number(searchParams.get("maxPrice"))
      : undefined;
    const sortBy = searchParams.get("sortBy") || "relevance";
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
    const limit = Math.min(
      searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
      100 // Max 100 per page
    );
    const includeFacets = searchParams.get("facets") === "true";

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        products: [],
        total: 0,
        page,
        limit,
      });
    }

    logger.info(`Search query: "${query}"`, { vendorId, category, page });

    // Expand query with synonyms (max 3 variants)
    const expandedQueries = expandQueryWithSynonyms(query);
    logger.debug("Expanded queries", { original: query, expanded: expandedQueries });

    // Build search query with filters
    const { where } = buildSearchQuery({
      query,
      expandedQueries,
      vendorId,
      category,
      minPrice,
      maxPrice,
    });

    // Fetch products with vendors (for scoring and display)
    const products = await db.product.findMany({
      where,
      include: {
        vendors: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          where: {
            AND: [
              ...(minPrice !== undefined ? [{ priceInKRW: { gte: minPrice } }] : []),
              ...(maxPrice !== undefined ? [{ priceInKRW: { lte: maxPrice } }] : []),
            ],
          },
          orderBy: {
            priceInKRW: "asc",
          },
          take: 5, // Max 5 vendors per product
        },
      },
      take: 1000, // Fetch more for ranking, will paginate after scoring
    });

    logger.info(`Found ${products.length} candidate products`);

    // Score and sort by relevance
    const scored = sortByRelevance(products, query, vendorId);

    // Apply custom sorting if specified
    let sortedProducts = scored.map((s) => s.product);

    if (sortBy === "price_low") {
      sortedProducts.sort((a: any, b: any) => {
        const aPrice = (a.vendors?.[0] as any)?.priceInKRW || 0;
        const bPrice = (b.vendors?.[0] as any)?.priceInKRW || 0;
        return aPrice - bPrice;
      });
    } else if (sortBy === "price_high") {
      sortedProducts.sort((a: any, b: any) => {
        const aPrice = (a.vendors?.[0] as any)?.priceInKRW || 0;
        const bPrice = (b.vendors?.[0] as any)?.priceInKRW || 0;
        return bPrice - aPrice;
      });
    } else if (sortBy === "name") {
      sortedProducts.sort((a: any, b: any) => a.name.localeCompare(b.name));
    }
    // else: relevance (already sorted by score)

    const total = sortedProducts.length;

    // Paginate
    const start = (page - 1) * limit;
    const paginatedProducts = sortedProducts.slice(start, start + limit);

    // Build response
    const response: SearchResponse = {
      products: paginatedProducts.map((product: any) => ({
        id: product.id,
        name: product.name,
        nameEn: product.nameEn,
        description: product.description,
        category: product.category,
        brand: product.brand,
        catalogNumber: product.catalogNumber,
        imageUrl: product.imageUrl,
        grade: product.grade,
        specification: product.specification,
        vendors: product.vendors?.map((pv: any) => ({
          id: pv.id,
          vendorId: pv.vendorId,
          vendor: pv.vendor,
          price: pv.price,
          priceInKRW: pv.priceInKRW,
          currency: pv.currency,
          stockStatus: pv.stockStatus,
          leadTime: pv.leadTime,
          url: pv.url,
        })) || [],
      })),
      total,
      page,
      limit,
    };

    // Calculate facets if requested
    if (includeFacets) {
      const vendorCounts = new Map<string, { name: string; count: number }>();
      const categoryCounts = new Map<ProductCategory, number>();

      for (const product of sortedProducts) {
        // Count categories
        categoryCounts.set(
          (product as any).category,
          (categoryCounts.get((product as any).category) || 0) + 1
        );

        // Count vendors
        for (const pv of (product as any).vendors || []) {
          if (pv.vendor) {
            const existing = vendorCounts.get(pv.vendorId);
            if (existing) {
              existing.count++;
            } else {
              vendorCounts.set(pv.vendorId, {
                name: pv.vendor.name,
                count: 1,
              });
            }
          }
        }
      }

      response.facets = {
        vendorCounts: Array.from(vendorCounts.entries())
          .map(([vendorId, { name, count }]) => ({
            vendorId,
            vendorName: name,
            count,
          }))
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 20), // Top 20 vendors

        categoryCounts: Array.from(categoryCounts.entries())
          .map(([category, count]) => ({ category, count }))
          .sort((a: any, b: any) => b.count - a.count),
      };
    }

    // Save search history (async, non-blocking)
    if (query && session?.user?.id) {
      db.searchHistory
        .create({
          data: {
            userId: session.user.id,
            query,
            category: category || null,
            filters: {
              vendorId,
              minPrice,
              maxPrice,
              sortBy,
            },
            resultCount: total,
          },
        })
        .catch((error: any) => {
          logger.error("Failed to save search history", error);
        });
    }

    logger.info(`Returning ${paginatedProducts.length} products (total: ${total})`);

    return NextResponse.json(response);
  } catch (error) {
    // DB 연결/테넌트 등 민감한 에러는 서버에서만 로깅하고, 클라이언트에는 안전한 메시지 반환
    const isDbConnectionError =
      error instanceof Error &&
      (error.message.includes("FATAL") ||
        error.message.includes("Tenant or user not found") ||
        error.message.includes("Can't reach database") ||
        error.message.includes("Connection") ||
        error.message.includes("ECONNREFUSED") ||
        (error as any).code === "P1001" ||
        (error as any).code === "P1017");

    if (isDbConnectionError) {
      console.error("[products/search] Database error:", error);
      return NextResponse.json(
        {
          error:
            "데이터베이스 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: 500 }
      );
    }

    return handleApiError(error, "products/search");
  }
}
