import { db } from "@/lib/db";

/**
 * 예산/납기 관점 최적화 추천 파라미터
 */
export interface OptimizationParams {
  budget?: number; // 예산 제약
  maxLeadTime?: number; // 최대 납기일 (일 단위)
  preferredVendors?: string[]; // 선호 벤더
  requiredCategories?: string[]; // 필수 카테고리
  excludeProductIds?: string[]; // 제외할 제품 ID
}

/**
 * 제품의 최적화 점수 계산
 */
export interface OptimizedProduct {
  product: any;
  score: number;
  reasons: string[];
  priceScore: number; // 가격 점수 (낮을수록 좋음)
  leadTimeScore: number; // 납기 점수 (낮을수록 좋음)
  vendorScore: number; // 벤더 점수 (높을수록 좋음)
  totalPrice?: number; // 총 가격
  minLeadTime?: number; // 최소 납기일
  bestVendor?: any; // 최적 벤더
}

/**
 * 예산/납기 관점 최적화 추천 생성
 */
export async function generateOptimizedRecommendations(params: {
  productIds: string[]; // 추천할 제품 후보
  optimizationParams: OptimizationParams;
  limit?: number;
}): Promise<OptimizedProduct[]> {
  const { productIds, optimizationParams, limit = 10 } = params;
  const {
    budget,
    maxLeadTime,
    preferredVendors = [],
    requiredCategories = [],
    excludeProductIds = [],
  } = optimizationParams;

  try {
    // 제품 조회
    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        ...(requiredCategories.length > 0 && {
          category: { in: requiredCategories },
        }),
        ...(excludeProductIds.length > 0 && {
          id: { notIn: excludeProductIds },
        }),
      },
      include: {
        vendors: {
          include: {
            vendor: true,
          },
          orderBy: {
            priceInKRW: "asc", // 가격 낮은 순
          },
        },
      },
    });

    // 각 제품에 대해 최적화 점수 계산
    const optimizedProducts: OptimizedProduct[] = products.map((product: any) => {
      const vendors = product.vendors || [];
      
      if (vendors.length === 0) {
        return {
          product,
          score: 0,
          reasons: ["벤더 정보가 없습니다"],
          priceScore: Infinity,
          leadTimeScore: Infinity,
          vendorScore: 0,
        };
      }

      // 최적 벤더 선택 (예산/납기 제약 고려)
      let bestVendor: any = null;
      let bestScore = -Infinity;
      let totalPrice = 0;
      let minLeadTime: number | undefined = undefined;

      vendors.forEach((vendor: any) => {
        const price = vendor.priceInKRW || 0;
        const leadTime = vendor.leadTime || 0;

        // 예산 제약 확인
        if (budget !== undefined && price > budget) {
          return; // 예산 초과
        }

        // 납기 제약 확인
        if (maxLeadTime !== undefined && leadTime > 0 && leadTime > maxLeadTime) {
          return; // 납기 초과
        }

        // 점수 계산
        let score = 0;

        // 가격 점수 (낮을수록 좋음, 최대 100점)
        const priceScore = budget
          ? Math.max(0, 100 - (price / budget) * 100)
          : price > 0
          ? Math.max(0, 100 - (price / 1000000) * 100) // 기본 기준: 100만원
          : 50;

        // 납기 점수 (낮을수록 좋음, 최대 100점)
        const leadTimeScore = maxLeadTime
          ? Math.max(0, 100 - (leadTime / maxLeadTime) * 100)
          : leadTime > 0
          ? Math.max(0, 100 - (leadTime / 30) * 100) // 기본 기준: 30일
          : 50;

        // 벤더 점수 (선호 벤더면 가산점)
        const vendorScore = preferredVendors.includes(vendor.vendor?.id || "")
          ? 100
          : 50;

        // 종합 점수 (가중 평균)
        score = priceScore * 0.4 + leadTimeScore * 0.3 + vendorScore * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestVendor = vendor;
          totalPrice = price;
          minLeadTime = leadTime > 0 ? leadTime : undefined;
        }
      });

      if (!bestVendor) {
        return {
          product,
          score: 0,
          reasons: [
            ...(budget !== undefined ? ["예산 초과"] : []),
            ...(maxLeadTime !== undefined ? ["납기 초과"] : []),
          ],
          priceScore: Infinity,
          leadTimeScore: Infinity,
          vendorScore: 0,
        };
      }

      // 추천 근거 생성
      const reasons: string[] = [];
      if (budget && totalPrice <= budget * 0.8) {
        reasons.push("예산 내 최적 가격");
      }
      if (maxLeadTime && minLeadTime && minLeadTime <= maxLeadTime * 0.7) {
        reasons.push("빠른 납기");
      }
      if (preferredVendors.includes(bestVendor.vendor?.id || "")) {
        reasons.push("선호 벤더");
      }
      if (reasons.length === 0) {
        reasons.push("조건에 맞는 제품");
      }

      return {
        product,
        score: bestScore,
        reasons,
        priceScore: budget
          ? Math.max(0, 100 - (totalPrice / budget) * 100)
          : totalPrice > 0
          ? Math.max(0, 100 - (totalPrice / 1000000) * 100)
          : 50,
        leadTimeScore: maxLeadTime && minLeadTime
          ? Math.max(0, 100 - (minLeadTime / maxLeadTime) * 100)
          : minLeadTime
          ? Math.max(0, 100 - (minLeadTime / 30) * 100)
          : 50,
        vendorScore: preferredVendors.includes(bestVendor.vendor?.id || "") ? 100 : 50,
        totalPrice,
        minLeadTime,
        bestVendor,
      };
    });

    // 점수순 정렬 및 필터링 (점수가 0보다 큰 것만)
    return optimizedProducts
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error("Error generating optimized recommendations:", error);
    return [];
  }
}

/**
 * 예산 내 최적 조합 추천 (여러 제품 조합)
 */
export async function generateBudgetOptimizedCombination(params: {
  productIds: string[];
  budget: number;
  optimizationParams?: Omit<OptimizationParams, "budget">;
}): Promise<{
  selectedProducts: OptimizedProduct[];
  totalPrice: number;
  remainingBudget: number;
  averageLeadTime?: number;
}> {
  const { productIds, budget, optimizationParams = {} } = params;

  try {
    // 모든 제품의 최적화 점수 계산
    const optimizedProducts = await generateOptimizedRecommendations({
      productIds,
      optimizationParams: {
        ...optimizationParams,
        budget, // 예산 제약 포함
      },
      limit: productIds.length, // 모든 제품 평가
    });

    // 그리디 알고리즘으로 예산 내 최적 조합 선택
    const selectedProducts: OptimizedProduct[] = [];
    let remainingBudget = budget;

    // 점수순 정렬
    const sortedProducts = [...optimizedProducts].sort(
      (a, b) => b.score - a.score
    );

    for (const product of sortedProducts) {
      if (product.totalPrice && product.totalPrice <= remainingBudget) {
        selectedProducts.push(product);
        remainingBudget -= product.totalPrice;
      }
    }

    // 평균 납기일 계산
    const leadTimes = selectedProducts
      .map((p) => p.minLeadTime)
      .filter((lt): lt is number => lt !== undefined);
    const averageLeadTime =
      leadTimes.length > 0
        ? leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length
        : undefined;

    return {
      selectedProducts,
      totalPrice: budget - remainingBudget,
      remainingBudget,
      averageLeadTime,
    };
  } catch (error) {
    console.error("Error generating budget optimized combination:", error);
    return {
      selectedProducts: [],
      totalPrice: 0,
      remainingBudget: budget,
    };
  }
}



