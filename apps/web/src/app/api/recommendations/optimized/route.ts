import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateOptimizedRecommendations, generateBudgetOptimizedCombination } from "@/lib/ai/optimized-recommendations";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

/**
 * 예산/납기 관점 최적화 추천 API
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'order_create',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (recommendations) — 'unknown' 유지.
      //   productIds 배열을 받아 최적 조합을 **계산해서 반환**할 뿐 쓰기가 없다.
      //   ⚠️ action 'order_create' 도 실제 동작(조회)과 어긋난다 → §audit-taxonomy-review.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/recommendations/optimized',
    });
    if (!enforcement.allowed) return enforcement.deny();

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
      enforcement.fail();
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

      // 조회/계산 전용: DB 쓰기 0 → audit envelope 없이 lock 만 해제한다.
      enforcement.fail();
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

      // 조회/계산 전용: DB 쓰기 0.
      enforcement.fail();
      return NextResponse.json({
        mode: "recommendations",
        recommendations,
      });
    }
  } catch (error) {
    // 데모 모드 분기도 이 catch 안에서 return 하므로 최상단에서 한 번만 닫는다.
    enforcement?.fail();
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



