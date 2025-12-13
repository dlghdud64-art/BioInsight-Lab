/**
 * 협업 필터링 기반 제품 추천
 * 사용자 간 유사도와 구매 패턴을 기반으로 추천
 */

import { db } from "@/lib/db";

export interface CollaborativeRecommendation {
  productId: string;
  score: number;
  reason: string;
  source: "collaborative_filtering";
}

/**
 * 협업 필터링 기반 추천 생성
 * 
 * 알고리즘:
 * 1. 현재 사용자와 유사한 사용자 찾기 (구매 패턴 기반)
 * 2. 유사 사용자들이 구매한 제품 중 현재 사용자가 구매하지 않은 제품 추천
 * 3. 유사도 점수와 구매 빈도를 기반으로 점수 계산
 */
export async function generateCollaborativeRecommendations(
  userId: string,
  options: {
    limit?: number;
    minSimilarity?: number;
  } = {}
): Promise<CollaborativeRecommendation[]> {
  try {
    const limit = options.limit || 10;
    const minSimilarity = options.minSimilarity || 0.3;

    // 현재 사용자의 구매 이력
    const userPurchases = await db.purchaseRecord.findMany({
      where: { importedBy: userId },
      select: {
        productId: true,
        quantity: true,
        totalAmount: true,
        purchaseDate: true,
      },
    });

    if (userPurchases.length === 0) {
      return [];
    }

    const userProductIds = new Set(userPurchases.map((p) => p.productId));

    // 다른 사용자들의 구매 이력
    const allPurchases = await db.purchaseRecord.findMany({
      where: {
        importedBy: { not: userId },
      },
      select: {
        importedBy: true,
        productId: true,
        quantity: true,
        totalAmount: true,
        purchaseDate: true,
      },
    });

    // 사용자별 구매 제품 집합
    const userProductMap = new Map<string, Set<string>>();
    allPurchases.forEach((purchase) => {
      if (!userProductMap.has(purchase.importedBy)) {
        userProductMap.set(purchase.importedBy, new Set());
      }
      userProductMap.get(purchase.importedBy)!.add(purchase.productId);
    });

    // 유사도 계산 (Jaccard 유사도)
    const similarities: Array<{ userId: string; similarity: number; products: Set<string> }> = [];
    
    userProductMap.forEach((otherProducts, otherUserId) => {
      const intersection = new Set(
        [...userProductIds].filter((id) => otherProducts.has(id))
      );
      const union = new Set([...userProductIds, ...otherProducts]);
      
      const similarity = intersection.size / union.size;
      
      if (similarity >= minSimilarity) {
        similarities.push({
          userId: otherUserId,
          similarity,
          products: otherProducts,
        });
      }
    });

    // 유사도 순으로 정렬
    similarities.sort((a, b) => b.similarity - a.similarity);

    // 추천 제품 점수 계산
    const productScores = new Map<string, { score: number; purchaseCount: number }>();

    similarities.forEach(({ similarity, products }) => {
      products.forEach((productId) => {
        // 현재 사용자가 구매하지 않은 제품만 추천
        if (!userProductIds.has(productId)) {
          const current = productScores.get(productId) || { score: 0, purchaseCount: 0 };
          productScores.set(productId, {
            score: current.score + similarity,
            purchaseCount: current.purchaseCount + 1,
          });
        }
      });
    });

    // 점수 정규화 및 정렬
    const recommendations: CollaborativeRecommendation[] = Array.from(
      productScores.entries()
    )
      .map(([productId, { score, purchaseCount }]) => {
        // 점수 정규화: 유사도 점수 * 구매 빈도 가중치
        const normalizedScore = score * (1 + Math.log(purchaseCount + 1));
        
        return {
          productId,
          score: normalizedScore,
          reason: `유사한 사용자 ${purchaseCount}명이 구매한 제품`,
          source: "collaborative_filtering" as const,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return recommendations;
  } catch (error) {
    console.error("Error generating collaborative recommendations:", error);
    return [];
  }
}

/**
 * 컨텍스트 기반 추천
 * 프로젝트, 예산, 사용 패턴을 고려한 추천
 */
export interface ContextBasedRecommendation {
  productId: string;
  score: number;
  reason: string;
  source: "context_based";
  context: {
    project?: string;
    budget?: number;
    category?: string;
    priceRange?: { min: number; max: number };
  };
}

export async function generateContextBasedRecommendations(
  userId: string,
  context: {
    projectName?: string;
    budget?: number;
    category?: string;
    priceRange?: { min: number; max: number };
  },
  options: { limit?: number } = {}
): Promise<ContextBasedRecommendation[]> {
  try {
    const limit = options.limit || 10;

    // 사용자의 과거 구매 패턴 분석
    const userPurchases = await db.purchaseRecord.findMany({
      where: { importedBy: userId },
      include: {
        product: {
          select: {
            id: true,
            category: true,
            name: true,
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
      take: 50, // 최근 50개 구매만 분석
    });

    // 프로젝트별 구매 패턴
    const projectPurchases = context.projectName
      ? userPurchases.filter((p) => p.projectName === context.projectName)
      : userPurchases;

    // 카테고리별 선호도 계산
    const categoryPreferences = new Map<string, number>();
    projectPurchases.forEach((purchase) => {
      const category = purchase.product?.category || "UNKNOWN";
      const current = categoryPreferences.get(category) || 0;
      categoryPreferences.set(category, current + 1);
    });

    // 예산 범위 내 제품 검색
    const where: any = {};
    
    if (context.category) {
      where.category = context.category;
    } else if (categoryPreferences.size > 0) {
      // 가장 선호하는 카테고리 사용
      const topCategory = Array.from(categoryPreferences.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      where.category = topCategory;
    }

    if (context.priceRange) {
      where.vendors = {
        some: {
          priceInKRW: {
            gte: context.priceRange.min,
            lte: context.priceRange.max,
          },
        },
      };
    } else if (context.budget) {
      // 예산의 80% 이내 제품 추천
      where.vendors = {
        some: {
          priceInKRW: {
            lte: context.budget * 0.8,
          },
        },
      };
    }

    // 사용자가 이미 구매한 제품 제외
    const purchasedProductIds = new Set(
      userPurchases.map((p) => p.productId)
    );
    if (purchasedProductIds.size > 0) {
      where.id = { notIn: Array.from(purchasedProductIds) };
    }

    // 제품 조회
    const products = await db.product.findMany({
      where,
      include: {
        vendors: {
          select: {
            priceInKRW: true,
            stockStatus: true,
            leadTime: true,
          },
        },
      },
      take: limit * 2, // 더 많이 가져와서 필터링
    });

    // 점수 계산 및 정렬
    const recommendations: ContextBasedRecommendation[] = products
      .map((product) => {
        let score = 0.5; // 기본 점수

        // 카테고리 선호도 반영
        if (product.category && categoryPreferences.has(product.category)) {
          const preference = categoryPreferences.get(product.category)!;
          score += (preference / projectPurchases.length) * 0.3;
        }

        // 가격 적합성
        const minPrice = product.vendors
          ?.map((v) => v.priceInKRW)
          .filter((p): p is number => p !== null && p !== undefined)
          .sort((a, b) => a - b)[0];

        if (minPrice && context.budget) {
          const priceRatio = minPrice / context.budget;
          if (priceRatio <= 0.5) {
            score += 0.2; // 예산의 50% 이하면 높은 점수
          } else if (priceRatio <= 0.8) {
            score += 0.1; // 예산의 80% 이하면 중간 점수
          }
        }

        // 재고 상태
        const inStock = product.vendors?.some(
          (v) => v.stockStatus === "재고 있음" || v.stockStatus === "In Stock"
        );
        if (inStock) {
          score += 0.1;
        }

        // 납기
        const minLeadTime = product.vendors
          ?.map((v) => v.leadTime)
          .filter((t): t is number => t !== null && t !== undefined)
          .sort((a, b) => a - b)[0];

        if (minLeadTime && minLeadTime <= 7) {
          score += 0.1; // 1주일 이내 납기면 가산점
        }

        const reasonParts: string[] = [];
        if (context.projectName) {
          reasonParts.push(`"${context.projectName}" 프로젝트에 적합한`);
        }
        if (context.category) {
          reasonParts.push(`${context.category} 카테고리`);
        }
        if (context.budget && minPrice) {
          reasonParts.push(`예산 내 제품 (₩${minPrice.toLocaleString()})`);
        }
        reasonParts.push("추천");

        return {
          productId: product.id,
          score: Math.min(score, 1.0), // 최대 1.0으로 제한
          reason: reasonParts.join(" "),
          source: "context_based" as const,
          context: {
            project: context.projectName,
            budget: context.budget,
            category: product.category,
            priceRange: minPrice
              ? { min: minPrice, max: minPrice }
              : undefined,
          },
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return recommendations;
  } catch (error) {
    console.error("Error generating context-based recommendations:", error);
    return [];
  }
}

