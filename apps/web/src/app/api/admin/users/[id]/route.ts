import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/api/admin";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { AuditEventType } from "@prisma/client";

/**
 * §11.117 #admin-user-approval-flow — reject (hard delete)
 *
 * DELETE /api/admin/users/[id]
 *
 * 운영자 use case:
 *   - invited user 가 OAuth 로그인 안 함 + 시간 경과 → cleanup
 *   - 잘못 invite 한 user 회수
 *
 * 권한:
 *   - 401 unauthorized
 *   - 403 non-admin
 *   - 400 self-reject (자기 자신 삭제 차단)
 *   - 404 target not found
 *   - 200 success
 *
 * 부수효과:
 *   - User row delete (cascade — 모든 FK relation onDelete:Cascade)
 *   - AuditLog USER_DELETED (delete 전 metadata 캡처)
 *
 * NOTE: 본 endpoint 는 hard delete. soft delete 트랙은 별도
 *   (`#admin-user-soft-delete`). pending user 외 active user 도 admin 이
 *   delete 가능하지만 audit 보존을 위해 운영자 신중 사용.
 */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actorId = session.user.id;
    if (!(await isAdmin(actorId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json(
        { error: "사용자 ID 가 필요합니다." },
        { status: 400 },
      );
    }

    // self-reject 차단
    if (session.user.id === targetUserId) {
      return NextResponse.json(
        {
          error: "본인 계정은 삭제할 수 없습니다.",
          reason: "self_reject",
        },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "대상 사용자를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // delete (cascade)
    await db.user.delete({ where: { id: targetUserId } });

    // audit (delete 후에도 actor 의 audit log 는 남음)
    await createAuditLog({
      userId: actorId,
      eventType: AuditEventType.USER_DELETED,
      entityType: "User",
      entityId: targetUserId,
      action: "user_reject",
      metadata: {
        deletedUserEmail: existing.email,
        deletedUserName: existing.name,
        deletedUserRole: existing.role,
        wasActive: !!existing.emailVerified,
        reason: "admin_reject",
      },
      success: true,
    });

    return NextResponse.json({ success: true, deletedId: targetUserId });
  } catch (error) {
    console.error("[admin/users DELETE] error:", error);
    return NextResponse.json(
      { error: "사용자 삭제에 실패했습니다." },
      { status: 500 },
    );
  }
}
