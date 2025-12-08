import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getProductsForAdmin,
  createProduct,
  isAdmin,
} from "@/lib/api/admin";

// 제품 목록 조회 (관리자용) - 중복 정의 제거
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const params = {
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      category: searchParams.get("category") || undefined,
      search: searchParams.get("search") || undefined,
    };

    const result = await getProductsForAdmin(params);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// 제품 생성 - 중복 정의 제거