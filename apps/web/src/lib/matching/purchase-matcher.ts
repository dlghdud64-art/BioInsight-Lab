import { db } from "@/lib/db";

export type MatchType = "CATALOG" | "FUZZY" | "MANUAL";

interface MatchResult {
  productId: string | null;
  matchType: MatchType | null;
  score?: number;
  reason?: string;
}

/**
 * 구매 내역과 제품 자동 매칭
 * 우선순위:
 * 1) catalogNumber 정확 일치 (vendor까지 있으면 vendor도 함께)
 * 2) catalogNumber startsWith
 * 3) itemName trigram similarity + vendor filter (score threshold 0.3~0.5)
 */
export async function matchPurchaseToProduct(params: {
  productName?: string;
  catalogNumber?: string;
  vendorId?: string | null;
  vendorName?: string | null;
}): Promise<MatchResult> {
  const { productName, catalogNumber, vendorId, vendorName } = params;

  // 1. catalogNumber 정확 일치 (vendor까지 있으면 vendor도 함께)
  if (catalogNumber) {
    const catalogMatch = await db.product.findFirst({
      where: {
        catalogNumber: {
          equals: catalogNumber,
          mode: "insensitive",
        },
        ...(vendorId && {
          vendors: {
            some: {
              vendorId,
            },
          },
        }),
      },
      select: {
        id: true,
      },
    });

    if (catalogMatch) {
      return {
        productId: catalogMatch.id,
        matchType: "CATALOG",
        score: 1.0,
        reason: `카탈로그 번호 정확 일치: ${catalogNumber}`,
      };
    }

    // 2. catalogNumber startsWith
    const catalogStartsWithMatch = await db.product.findFirst({
      where: {
        catalogNumber: {
          startsWith: catalogNumber,
          mode: "insensitive",
        },
        ...(vendorId && {
          vendors: {
            some: {
              vendorId,
            },
          },
        }),
      },
      select: {
        id: true,
        catalogNumber: true,
      },
      orderBy: {
        catalogNumber: "asc",
      },
    });

    if (catalogStartsWithMatch) {
      return {
        productId: catalogStartsWithMatch.id,
        matchType: "CATALOG",
        score: 0.8,
        reason: `카탈로그 번호 부분 일치: ${catalogStartsWithMatch.catalogNumber}`,
      };
    }
  }

  // 3. itemName fuzzy matching (vendor filter 포함)
  if (productName && productName.trim().length > 0) {
    // PostgreSQL의 pg_trgm 확장을 사용한 유사도 검색
    // Prisma에서는 직접 지원하지 않으므로 Raw SQL 사용
    try {
      const fuzzyQuery = `
        SELECT 
          p.id,
          similarity(p.name, $1) as name_score,
          similarity(COALESCE(p."nameEn", ''), $1) as name_en_score
        FROM "Product" p
        WHERE (
          similarity(p.name, $1) > 0.3
          OR similarity(COALESCE(p."nameEn", ''), $1) > 0.3
        )
        ${vendorId ? `AND EXISTS (SELECT 1 FROM "ProductVendor" pv WHERE pv."productId" = p.id AND pv."vendorId" = $2)` : ""}
        ORDER BY GREATEST(
          similarity(p.name, $1),
          similarity(COALESCE(p."nameEn", ''), $1)
        ) DESC
        LIMIT 1
      `;

      const params: any[] = [productName.trim()];
      if (vendorId) {
        params.push(vendorId);
      }

      const fuzzyResult = await db.$queryRawUnsafe(fuzzyQuery, ...params) as Array<{
        id: string;
        name_score: number;
        name_en_score: number;
      }>;

      if (fuzzyResult && fuzzyResult.length > 0) {
        const bestMatch = fuzzyResult[0];
        const score = Math.max(bestMatch.name_score || 0, bestMatch.name_en_score || 0);

        if (score >= 0.3) {
          return {
            productId: bestMatch.id,
            matchType: "FUZZY",
            score,
            reason: `제품명 유사도 매칭 (${(score * 100).toFixed(0)}%): ${productName}`,
          };
        }
      }
    } catch (error) {
      // pg_trgm 확장이 없거나 오류 발생 시 fallback: 단순 contains 검색
      console.warn("Fuzzy matching failed, falling back to contains search:", error);

      const fallbackMatch = await db.product.findFirst({
        where: {
          OR: [
            { name: { contains: productName.trim(), mode: "insensitive" } },
            { nameEn: { contains: productName.trim(), mode: "insensitive" } },
          ],
          ...(vendorId && {
            vendors: {
              some: {
                vendorId,
              },
            },
          }),
        },
        select: {
          id: true,
        },
      });

      if (fallbackMatch) {
        return {
          productId: fallbackMatch.id,
          matchType: "FUZZY",
          score: 0.5,
          reason: `제품명 부분 일치: ${productName}`,
        };
      }
    }
  }

  // 매칭 실패
  return {
    productId: null,
    matchType: null,
    score: 0,
    reason: "매칭 실패",
  };
}

/**
 * 제품의 위험 정보 스냅샷 생성
 */
export async function createHazardSnapshot(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      hazardCodes: true,
      pictograms: true,
      msdsUrl: true,
    },
  });

  if (!product) {
    return null;
  }

  return {
    hazardCodes: product.hazardCodes || [],
    pictograms: product.pictograms || [],
    msdsUrl: product.msdsUrl || null,
  };
}




