import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 사용자 행동 추적 (클릭, 비교 추가, 견적 요청 등)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { action, productId, metadata } = body;

    if (!action || !productId) {
      return NextResponse.json({ error: "Action and productId are required" }, { status: 400 });
    }

    // 행동 타입: 'view', 'click', 'compare_add', 'compare_remove', 'quote_add', 'favorite_add'
    // 현재는 검색 기록에 통합하여 저장 (향후 별도 UserBehavior 모델로 확장 가능)
    
    // 클릭 행동은 SearchHistory의 clickedProductId로 저장
    if (action === "click" && session?.user?.id) {
      // 가장 최근 검색 기록에 클릭 정보 업데이트
      const recentSearch = await db.searchHistory.findFirst({
        where: {
          userId: session.user.id,
          query: metadata?.query || "",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (recentSearch) {
        await db.searchHistory.update({
          where: { id: recentSearch.id },
          data: { clickedProductId: productId },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking user behavior:", error);
    return NextResponse.json(
      { error: "Failed to track user behavior" },
      { status: 500 }
    );
  }
}


import { db } from "@/lib/db";

// 사용자 행동 추적 (클릭, 비교 추가, 견적 요청 등)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { action, productId, metadata } = body;

    if (!action || !productId) {
      return NextResponse.json({ error: "Action and productId are required" }, { status: 400 });
    }

    // 행동 타입: 'view', 'click', 'compare_add', 'compare_remove', 'quote_add', 'favorite_add'
    // 현재는 검색 기록에 통합하여 저장 (향후 별도 UserBehavior 모델로 확장 가능)
    
    // 클릭 행동은 SearchHistory의 clickedProductId로 저장
    if (action === "click" && session?.user?.id) {
      // 가장 최근 검색 기록에 클릭 정보 업데이트
      const recentSearch = await db.searchHistory.findFirst({
        where: {
          userId: session.user.id,
          query: metadata?.query || "",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (recentSearch) {
        await db.searchHistory.update({
          where: { id: recentSearch.id },
          data: { clickedProductId: productId },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking user behavior:", error);
    return NextResponse.json(
      { error: "Failed to track user behavior" },
      { status: 500 }
    );
  }
}


import { db } from "@/lib/db";

// 사용자 행동 추적 (클릭, 비교 추가, 견적 요청 등)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { action, productId, metadata } = body;

    if (!action || !productId) {
      return NextResponse.json({ error: "Action and productId are required" }, { status: 400 });
    }

    // 행동 타입: 'view', 'click', 'compare_add', 'compare_remove', 'quote_add', 'favorite_add'
    // 현재는 검색 기록에 통합하여 저장 (향후 별도 UserBehavior 모델로 확장 가능)
    
    // 클릭 행동은 SearchHistory의 clickedProductId로 저장
    if (action === "click" && session?.user?.id) {
      // 가장 최근 검색 기록에 클릭 정보 업데이트
      const recentSearch = await db.searchHistory.findFirst({
        where: {
          userId: session.user.id,
          query: metadata?.query || "",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (recentSearch) {
        await db.searchHistory.update({
          where: { id: recentSearch.id },
          data: { clickedProductId: productId },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking user behavior:", error);
    return NextResponse.json(
      { error: "Failed to track user behavior" },
      { status: 500 }
    );
  }
}

