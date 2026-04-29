import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers, isAdmin } from "@/lib/api/admin";

/**
 * §11.118 #admin-users-route-encoding-fix
 *
 * 이전 mojibake 주석 (UTF-8 → Latin-1 → UTF-8 decode 누락) 정리 +
 * 미사용 import (updateUserRole) 제거. role 변경은 §11.115/§11.117 의
 * /[id]/approval-policy + /[id]/approval 에서 별도 처리.
 *
 * GET /api/admin/users — 관리자용 사용자 목록 조회
 *
 * Query params:
 *  - page: number (default 1)
 *  - limit: number (default 20)
 *  - search: string (이름/이메일 검색)
 *  - role: UserRole (필터)
 *
 * Response: { users[], total, page, limit, totalPages }
 *
 * 권한: ADMIN only.
 */

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
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!)
        : 20,
      role: searchParams.get("role") as any,
      search: searchParams.get("search") || undefined,
      // §11.134 — onlyDeleted=true 시 soft-deleted user list (복구 surface 용)
      onlyDeleted: searchParams.get("onlyDeleted") === "true",
    };

    const result = await getUsers(params);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "사용자 목록 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}
