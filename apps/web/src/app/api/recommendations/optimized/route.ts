import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateOptimizedRecommendations, generateBudgetOptimizedCombination } from "@/lib/ai/optimized-recommendations";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

/**
 * 예산/납기 관점 최적화 추천 API
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    
    const {
      productIds, // 추천할 제품 후보 ID 목록
      budget, // 예산 제약
      maxLeadTime, // 최대 납기일 (일 단위)
      preferredVendors, // 선호 벤더 ID 목록
      requiredCategories, // 필수 카테고리
      excludeProductIds, // 제외할 제품 ID 목록
      mode = "recommendations", // "recommendations" | "combination"
      limit = 10,
    } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "productIds array is required" },
        { status: 400 }
      );
    }

    const optimizationParams = {
      budget,
      maxLeadTime,
      preferredVendors: preferredVendors || [],
      requiredCategories: requiredCategories || [],
      excludeProductIds: excludeProductIds || [],
    };

    if (mode === "combination" && budget) {
      // 예산 내 최적 조합 추천
      const combination = await generateBudgetOptimizedCombination({
        productIds,
        budget,
        optimizationParams,
      });

      return NextResponse.json({
        mode: "combination",
        ...combination,
      });
    } else {
      // 개별 제품 최적화 추천
      const recommendations = await generateOptimizedRecommendations({
        productIds,
        optimizationParams,
        limit,
      });

      return NextResponse.json({
        mode: "recommendations",
        recommendations,
      });
    }
  } catch (error) {
    console.error("Error generating optimized recommendations:", error);
    
    // 데모 모드에서는 더미 응답 반환
    if (isDemoMode() || !isPrismaAvailable) {
      return NextResponse.json({
        mode: "recommendations",
        recommendations: [],
        demo: true,
      });
    }
    
    return NextResponse.json(
      { error: "Failed to generate optimized recommendations" },
      { status: 500 }
    );
  }
}



