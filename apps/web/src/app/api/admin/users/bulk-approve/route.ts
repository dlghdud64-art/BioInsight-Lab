import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/api/admin";

/**
 * §11.135 #admin-user-bulk-approve-reject (bulk-approve)
 *
 * POST /api/admin/users/bulk-approve
 *
 * Body: { userIds: string[] }
 *
 * sequential single-item POST /api/admin/users/[id]/approval 호출 +
 * partial failure tolerance. §11.102 admin-order-bulk-status 패턴.
 *
 * 응답: { successCount, failedItems: [{ userId, error }] }
 *
 * 권한: ADMIN only.
 * 한 번 최대 50건 제한.
 */

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "요청 본문 JSON 파싱에 실패했습니다." },
        { status: 400 },
      );
    }

    const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds : [];
    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "사용자 ID 가 비어 있습니다.", field: "userIds" },
        { status: 400 },
      );
    }
    if (userIds.length > 50) {
      return NextResponse.json(
        {
          error: "한 번 최대 50명까지 일괄 처리 가능합니다.",
          field: "userIds",
        },
        { status: 400 },
      );
    }

    const cookie = request.headers.get("cookie") ?? "";
    const csrf = request.headers.get("x-csrf-token") ?? "";
    const origin =
      process.env.NEXTAUTH_URL ||
      request.headers.get("origin") ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const failedItems: { userId: string; error: string }[] = [];
    let successCount = 0;

    // sequential — partial failure tolerance, transaction 분리
    for (const userId of userIds) {
      try {
        const res = await fetch(
          `${origin}/api/admin/users/${userId}/approval`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie,
              ...(csrf ? { "x-csrf-token": csrf } : {}),
            },
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          failedItems.push({
            userId,
            error: data.error || `HTTP ${res.status}`,
          });
        } else {
          successCount++;
        }
      } catch (err) {
        failedItems.push({
          userId,
          error: err instanceof Error ? err.message : "fetch failed",
        });
      }
    }

    return NextResponse.json({
      successCount,
      failedCount: failedItems.length,
      failedItems,
    });
  } catch (error) {
    console.error("[admin/users/bulk-approve] error:", error);
    return NextResponse.json(
      { error: "일괄 승인 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
