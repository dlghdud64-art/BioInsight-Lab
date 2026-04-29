import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/api/admin";

/**
 * §11.135 #admin-user-bulk-approve-reject (bulk-reject)
 *
 * POST /api/admin/users/bulk-reject
 *
 * Body: { userIds: string[] }
 *
 * sequential single-item DELETE /api/admin/users/[id] 호출 (§11.133 soft delete)
 * + partial failure tolerance. self-reject 차단 (session.user.id 가 list 에 있으면
 * skip + failed 기록). §11.102 admin-order-bulk-status 패턴.
 */

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actorId = session.user.id;
    if (!(await isAdmin(actorId))) {
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

    for (const userId of userIds) {
      // §11.117 self_reject 차단 — bulk 도 본인 ID 차단 (single-item endpoint
      // 가 차단하지만 우선 client error 로 빠르게 fail)
      if (session.user.id === userId) {
        failedItems.push({ userId, error: "본인 계정은 삭제할 수 없습니다." });
        continue;
      }
      try {
        const res = await fetch(
          `${origin}/api/admin/users/${userId}`,
          {
            method: "DELETE",
            headers: {
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
    console.error("[admin/users/bulk-reject] error:", error);
    return NextResponse.json(
      { error: "일괄 반려 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
