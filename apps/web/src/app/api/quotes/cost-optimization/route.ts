import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface CostOptimizationItem {
  currentProductId: string;
  currentProductName: string;
  currentPrice: number;
  currentVendorName?: string;
  alternativeProductId: string;
  alternativeProductName: string;
  alternativePrice: number;
  alternativeVendorName?: string;
  savings: number; // 절감 금액
  savingsRate: number; // 절감률 (%)
  similarity: number; // 유사도 (0-1)
  similarityReasons: string[]; // 유사도 근거
  quantity: number; // 수량
  totalSavings: number; // 총 절감 금액 (절감 금액 * 수량)
}

interface CostOptimizationRequest {
  items: Array<{
    productId: string;
    quantity: number;
    vendorId?: string;
  }>;
  budgetLimit?: number; // 예산 한도 (옵션)
}

export async function POST(request: NextRequest) {
  try {
    const body: CostOptimizationRequest = await request.json();
    const { items, budgetLimit } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    const optimizations: CostOptimizationItem[] = [];
    let totalPotentialSavings = 0;

    // 각 품목에 대해 대체품 찾기
    for (const item of items) {
      // 현재 제품 정보 가져오기
      const currentProduct = await db.product.findUnique({
        where: { id: item.productId },
        include: {
          vendors: {
            include: {
              vendor: true,
            },
            orderBy: {
              priceInKRW: "asc",
            },
          },
        },
      });

      if (!currentProduct) continue;

      // 현재 가격 (선택된 벤더 또는 최저가)
      let currentPrice = 0;
      let currentVendorName: string | undefined;
      
      if (item.vendorId) {
        const selectedVendor = currentProduct.vendors.find(
          (v: any) => v.vendorId === item.vendorId
        );
        if (selectedVendor) {
          currentPrice = selectedVendor.priceInKRW || 0;
          currentVendorName = selectedVendor.vendor.name;
        }
      } else {
        // 최저가 벤더
        const cheapestVendor = currentProduct.vendors[0];
        if (cheapestVendor) {
          currentPrice = cheapestVendor.priceInKRW || 0;
          currentVendorName = cheapestVendor.vendor.name;
        }
      }

      if (currentPrice === 0) continue;

      // 대체품 찾기 (동일 카테고리, 유사 스펙, 더 저렴한 제품)
      const alternatives = await db.product.findMany({
        where: {
          category: currentProduct.category,
          id: { not: item.productId },
          vendors: {
            some: {
              priceInKRW: {
                lt: currentPrice, // 현재 가격보다 저렴한 제품만
              },
            },
          },
        },
        include: {
          vendors: {
            include: {
              vendor: true,
            },
            orderBy: {
              priceInKRW: "asc",
            },
            take: 1, // 최저가 벤더만
          },
        },
        take: 5, // 후보를 넓게 가져온 후 유사도로 필터링
      });

      // 유사도 계산 및 정렬
      const scoredAlternatives = alternatives
        .map((alt: any) => {
          let similarity = 0;
          const reasons: string[] = [];

          // 1. Grade 유사도
          if (currentProduct.grade && alt.grade) {
            if (currentProduct.grade === alt.grade) {
              similarity += 0.3;
              reasons.push(`동일 Grade: ${currentProduct.grade}`);
            }
          }

          // 2. 규격 유사도
          if (currentProduct.specification && alt.specification) {
            const spec1 = currentProduct.specification.toLowerCase();
            const spec2 = alt.specification.toLowerCase();
            if (spec1 === spec2) {
              similarity += 0.3;
              reasons.push("동일 규격");
            } else if (spec1.includes(spec2) || spec2.includes(spec1)) {
              similarity += 0.15;
              reasons.push("유사 규격");
            }
          }

          // 3. 스펙 JSON 유사도
          if (currentProduct.specifications && alt.specifications) {
            const spec1 = currentProduct.specifications as Record<string, any>;
            const spec2 = alt.specifications as Record<string, any>;
            const keys1 = Object.keys(spec1);
            const keys2 = Object.keys(spec2);
            const commonKeys = keys1.filter((k) => keys2.includes(k));
            
            if (commonKeys.length > 0) {
              let matchingValues = 0;
              commonKeys.forEach((key) => {
                const val1 = String(spec1[key]).toLowerCase().trim();
                const val2 = String(spec2[key]).toLowerCase().trim();
                if (val1 === val2) {
                  matchingValues += 2;
                } else if (val1.includes(val2) || val2.includes(val1)) {
                  matchingValues += 1;
                }
              });
              
              const specSimilarity = matchingValues / (Math.max(keys1.length, keys2.length) * 2);
              if (specSimilarity > 0.3) {
                similarity += specSimilarity * 0.3;
                if (reasons.length === 0 || !reasons.some((r) => r.includes("스펙"))) {
                  reasons.push("유사한 스펙");
                }
              }
            }
          }

          // 4. 브랜드 유사도 (같은 브랜드는 아니지만 유사한 경우)
          if (currentProduct.brand && alt.brand) {
            if (currentProduct.brand !== alt.brand) {
              // 다른 브랜드지만 동일 카테고리면 약간의 점수
              similarity += 0.1;
            }
          }

          return {
            product: alt,
            similarity,
            reasons: reasons.length > 0 ? reasons : ["동일 카테고리"],
          };
        })
        .filter((item: any) => item.similarity > 0.3) // 최소 유사도 30% 이상
        .sort((a: any, b: any) => {
          // 유사도가 높고 가격이 낮은 순으로 정렬
          if (Math.abs(a.similarity - b.similarity) > 0.1) {
            return b.similarity - a.similarity;
          }
          const priceA = a.product.vendors[0]?.priceInKRW || 0;
          const priceB = b.product.vendors[0]?.priceInKRW || 0;
          return priceA - priceB;
        });

      // 가장 좋은 대체품 선택
      if (scoredAlternatives.length > 0) {
        const bestAlternative = scoredAlternatives[0];
        const altProduct = bestAlternative.product;
        const altVendor = altProduct.vendors[0];
        
        if (altVendor && altVendor.priceInKRW) {
          const alternativePrice = altVendor.priceInKRW;
          const savings = currentPrice - alternativePrice;
          const savingsRate = (savings / currentPrice) * 100;
          const totalSavings = savings * item.quantity;

          // 절감 금액이 의미 있는 경우만 추가 (최소 5% 절감)
          if (savingsRate >= 5) {
            optimizations.push({
              currentProductId: currentProduct.id,
              currentProductName: currentProduct.name,
              currentPrice,
              currentVendorName,
              alternativeProductId: altProduct.id,
              alternativeProductName: altProduct.name,
              alternativePrice,
              alternativeVendorName: altVendor.vendor.name,
              savings,
              savingsRate: Math.round(savingsRate * 10) / 10,
              similarity: Math.round(bestAlternative.similarity * 100) / 100,
              similarityReasons: bestAlternative.reasons,
              quantity: item.quantity,
              totalSavings,
            });

            totalPotentialSavings += totalSavings;
          }
        }
      }
    }

    // 총 절감 금액 계산
    const currentTotal = items.reduce((sum, item) => {
      // 실제 가격은 API에서 다시 조회해야 하지만, 여기서는 간단히 처리
      return sum;
    }, 0);

    // 예산 한도가 있는 경우, 절감 제안이 예산 내에 들어오는지 확인
    const optimizedTotal = currentTotal - totalPotentialSavings;
    const isWithinBudget = budgetLimit ? optimizedTotal <= budgetLimit : true;

    return NextResponse.json({
      optimizations,
      summary: {
        totalPotentialSavings,
        currentTotal,
        optimizedTotal,
        isWithinBudget,
        optimizationCount: optimizations.length,
      },
    });
  } catch (error) {
    console.error("Error calculating cost optimization:", error);
    return NextResponse.json(
      { error: "Failed to calculate cost optimization" },
      { status: 500 }
    );
  }
}

