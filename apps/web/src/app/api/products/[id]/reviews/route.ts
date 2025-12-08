import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProductReviews, createReview } from "@/lib/api/reviews";

// 제품 리뷰 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    const params_obj = {
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      sortBy: (searchParams.get("sortBy") as any) || "recent",
    };

    const result = await getProductReviews(id, params_obj);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// 리뷰 생성/업데이트