import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface OptimizationConstraint {
  grade?: string; // 필수 Grade (예: "HPLC grade", "GMP")
  brand?: string; // 필수 브랜드
  minSpecMatch?: number; // 최소 스펙 일치율 (0-1)
  maxLeadTime?: number; // 최대 납기일 (일)
  minStockStatus?: string; // 최소 재고 상태
  excludeVendors?: string[]; // 제외할 벤더 ID
  requireSameVendor?: boolean; // 동일 벤더에서 구매 필수
}

interface OptimizationRequest {
  items: Array<{
    productId: string;
    quantity: number;
    constraints?: OptimizationConstraint; // 품목별 제약조건
  }>;
  globalConstraints?: OptimizationConstraint; // 전체 제약조건
  budgetLimit?: number; // 예산 한도
  optimizeFor?: "cost" | "leadTime" | "balanced"; // 최적화 목표
}

interface OptimizedCombination {
  items: Array<{
    originalProductId: string;
    originalProductName: string;
    selectedProductId: string;
    selectedProductName: string;
    selectedVendorId: string;
    selectedVendorName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    leadTime?: number;
    stockStatus?: string;
    similarity: number;
    similarityReasons: string[];
    constraintSatisfied: boolean;
  }>;
  totalCost: number;
  totalSavings: number; // 원래 가격 대비 절감액
  averageLeadTime?: number;
  allConstraintsSatisfied: boolean;
  constraintViolations: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: OptimizationRequest = await request.json();
    const { items, globalConstraints, budgetLimit, optimizeFor = "balanced" } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    // 각 품목에 대해 최적 대체품 찾기
    const optimizedItems: OptimizedCombination["items"] = [];
    let totalOriginalCost = 0;
    let totalOptimizedCost = 0;
    const constraintViolations: string[] = [];

    for (const item of items) {
      const constraints = { ...globalConstraints, ...item.constraints };

      // 원본 제품 정보
      const originalProduct = await db.product.findUnique({
        where: { id: item.productId },
        include: {
          vendors: {
            include: { vendor: true },
            orderBy: { priceInKRW: "asc" },
          },
        },
      });

      if (!originalProduct) continue;

      // 원본 제품의 최저가
      const originalPrice = originalProduct.vendors[0]?.priceInKRW || 0;
      totalOriginalCost += originalPrice * item.quantity;

      // 대체품 후보 찾기
      const alternatives = await db.product.findMany({
        where: {
          category: originalProduct.category,
          id: { not: originalProduct.id },
          ...(constraints.grade && { grade: constraints.grade }),
          ...(constraints.brand && { brand: constraints.brand }),
        },
        include: {
          vendors: {
            include: { vendor: true },
            orderBy: { priceInKRW: "asc" },
          },
        },
        take: 20,
      });

      // 제약조건을 만족하는 최적 대체품 찾기
      let bestAlternative: {
        product: any;
        vendor: any;
        similarity: number;
        reasons: string[];
        constraintSatisfied: boolean;
      } | null = null;

      for (const alt of alternatives) {
        // 제약조건 확인
        let constraintSatisfied = true;
        const violations: string[] = [];

        // Grade 제약조건
        if (constraints.grade && alt.grade !== constraints.grade) {
          constraintSatisfied = false;
          violations.push(`Grade 불일치: ${alt.grade} !== ${constraints.grade}`);
        }

        // 브랜드 제약조건
        if (constraints.brand && alt.brand !== constraints.brand) {
          constraintSatisfied = false;
          violations.push(`브랜드 불일치: ${alt.brand} !== ${constraints.brand}`);
        }

        // 벤더 제외
        if (constraints.excludeVendors) {
          const hasExcludedVendor = alt.vendors.some((v: any) =>
            constraints.excludeVendors!.includes(v.vendorId)
          );
          if (hasExcludedVendor) {
            constraintSatisfied = false;
            violations.push("제외된 벤더 포함");
          }
        }

        // 최적 벤더 선택
        let bestVendor: any = null;
        for (const vendor of alt.vendors) {
          // 납기 제약조건
          if (constraints.maxLeadTime && vendor.leadTime && vendor.leadTime > constraints.maxLeadTime) {
            continue;
          }

          // 재고 상태 제약조건
          if (constraints.minStockStatus && vendor.stockStatus) {
            const stockLevels = ["in_stock", "limited", "out_of_stock"];
            const currentLevel = stockLevels.indexOf(vendor.stockStatus);
            const requiredLevel = stockLevels.indexOf(constraints.minStockStatus);
            if (currentLevel > requiredLevel) {
              continue;
            }
          }

          if (!bestVendor || vendor.priceInKRW! < bestVendor.priceInKRW!) {
            bestVendor = vendor;
          }
        }

        if (!bestVendor) continue;

        // 유사도 계산 (기존 alternatives API와 유사한 로직)
        let similarity = 0;
        const reasons: string[] = [];

        // Grade 일치
        if (alt.grade === originalProduct.grade) {
          similarity += 0.3;
          reasons.push("동일 Grade");
        }

        // Specification 일치
        if (alt.specification && originalProduct.specification) {
          if (alt.specification === originalProduct.specification) {
            similarity += 0.3;
            reasons.push("동일 규격");
          } else if (
            alt.specification.toLowerCase().includes(originalProduct.specification.toLowerCase()) ||
            originalProduct.specification.toLowerCase().includes(alt.specification.toLowerCase())
          ) {
            similarity += 0.15;
            reasons.push("유사 규격");
          }
        }

        // JSON 스펙 일치
        if (alt.specifications && originalProduct.specifications) {
          const spec1 = alt.specifications as Record<string, any>;
          const spec2 = originalProduct.specifications as Record<string, any>;
          const commonKeys = Object.keys(spec1).filter((k) => spec2[k] !== undefined);
          if (commonKeys.length > 0) {
            const matchingKeys = commonKeys.filter((k) => String(spec1[k]).toLowerCase() === String(spec2[k]).toLowerCase());
            similarity += (matchingKeys.length / commonKeys.length) * 0.2;
            if (matchingKeys.length > 0) {
              reasons.push(`${matchingKeys.length}개 스펙 일치`);
            }
          }
        }

        // 브랜드 일치
        if (alt.brand === originalProduct.brand) {
          similarity += 0.1;
          reasons.push("동일 브랜드");
        }

        // 이름 유사도
        const nameSimilarity = calculateTextSimilarity(alt.name, originalProduct.name);
        similarity += nameSimilarity * 0.1;
        if (nameSimilarity > 0.3) {
          reasons.push("제품명 유사");
        }

        // 최적화 목표에 따라 점수 조정
        let score = similarity;
        if (optimizeFor === "cost") {
          // 가격이 낮을수록 높은 점수
          const priceRatio = bestVendor.priceInKRW! / originalPrice;
          score = similarity * 0.6 + (1 - priceRatio) * 0.4;
        } else if (optimizeFor === "leadTime") {
          // 납기가 짧을수록 높은 점수
          const leadTimeRatio = bestVendor.leadTime
            ? bestVendor.leadTime / (originalProduct.vendors[0]?.leadTime || 30)
            : 1;
          score = similarity * 0.6 + (1 / leadTimeRatio) * 0.4;
        } else {
          // balanced: 유사도와 가격을 균형있게 고려
          const priceRatio = bestVendor.priceInKRW! / originalPrice;
          score = similarity * 0.7 + (1 - priceRatio * 0.5) * 0.3;
        }

        // 제약조건을 만족하고 더 좋은 대체품인 경우
        if (
          (!bestAlternative || score > bestAlternative.similarity) &&
          similarity > 0.3 // 최소 유사도
        ) {
          bestAlternative = {
            product: alt,
            vendor: bestVendor,
            similarity: score,
            reasons,
            constraintSatisfied,
          };
        }
      }

      // 최적 대체품이 있고 원본보다 저렴한 경우
      if (bestAlternative && bestAlternative.vendor.priceInKRW! < originalPrice) {
        optimizedItems.push({
          originalProductId: originalProduct.id,
          originalProductName: originalProduct.name,
          selectedProductId: bestAlternative.product.id,
          selectedProductName: bestAlternative.product.name,
          selectedVendorId: bestAlternative.vendor.vendorId,
          selectedVendorName: bestAlternative.vendor.vendor.name,
          quantity: item.quantity,
          unitPrice: bestAlternative.vendor.priceInKRW!,
          totalPrice: bestAlternative.vendor.priceInKRW! * item.quantity,
          leadTime: bestAlternative.vendor.leadTime || undefined,
          stockStatus: bestAlternative.vendor.stockStatus || undefined,
          similarity: bestAlternative.similarity,
          similarityReasons: bestAlternative.reasons,
          constraintSatisfied: bestAlternative.constraintSatisfied,
        });
        totalOptimizedCost += bestAlternative.vendor.priceInKRW! * item.quantity;

        if (!bestAlternative.constraintSatisfied) {
          constraintViolations.push(
            `${originalProduct.name}: 일부 제약조건 미충족`
          );
        }
      } else {
        // 대체품이 없거나 더 비싼 경우 원본 사용
        const originalVendor = originalProduct.vendors[0];
        optimizedItems.push({
          originalProductId: originalProduct.id,
          originalProductName: originalProduct.name,
          selectedProductId: originalProduct.id,
          selectedProductName: originalProduct.name,
          selectedVendorId: originalVendor?.vendorId || "",
          selectedVendorName: originalVendor?.vendor.name || "N/A",
          quantity: item.quantity,
          unitPrice: originalPrice,
          totalPrice: originalPrice * item.quantity,
          leadTime: originalVendor?.leadTime || undefined,
          stockStatus: originalVendor?.stockStatus || undefined,
          similarity: 1.0,
          similarityReasons: ["원본 제품"],
          constraintSatisfied: true,
        });
        totalOptimizedCost += originalPrice * item.quantity;
      }
    }

    // 예산 한도 확인
    if (budgetLimit && totalOptimizedCost > budgetLimit) {
      constraintViolations.push(
        `예산 초과: ₩${totalOptimizedCost.toLocaleString()} > ₩${budgetLimit.toLocaleString()}`
      );
    }

    // 동일 벤더 제약조건 확인
    if (globalConstraints?.requireSameVendor) {
      const vendorIds = new Set(optimizedItems.map((item) => item.selectedVendorId));
      if (vendorIds.size > 1) {
        constraintViolations.push("동일 벤더 제약조건 미충족");
      }
    }

    // 평균 납기 계산
    const leadTimes = optimizedItems
      .map((item) => item.leadTime)
      .filter((lt) => lt !== undefined) as number[];
    const averageLeadTime =
      leadTimes.length > 0
        ? leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length
        : undefined;

    const result: OptimizedCombination = {
      items: optimizedItems,
      totalCost: totalOptimizedCost,
      totalSavings: totalOriginalCost - totalOptimizedCost,
      averageLeadTime,
      allConstraintsSatisfied: constraintViolations.length === 0,
      constraintViolations,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error optimizing combination:", error);
    return NextResponse.json(
      { error: error.message || "Failed to optimize combination" },
      { status: 500 }
    );
  }
}

// 텍스트 유사도 계산
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = text1.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const commonWords = words1.filter((w) => words2.includes(w));
  return commonWords.length / Math.max(words1.length, words2.length);
}























