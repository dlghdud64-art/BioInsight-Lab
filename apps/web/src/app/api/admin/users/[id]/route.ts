import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/api/admin";
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";
import { AuditEventType } from "@prisma/client";

/**
 * §11.117 + §11.133 #admin-user-soft-delete
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
 * 부수효과 (§11.133 정형화):
 *   - User row 보존 + deletedAt set (soft delete) — cascade 회피, audit 추적
 *     강화. getUsers helper 가 deletedAt IS NULL filter 자동 적용 → admin/users
 *     list 에서 사라짐. auth.ts jwt callback 가 deletedAt truthy user OAuth 차단.
 *   - AuditLog USER_DELETED (action="user_reject", deleted user metadata 보존)
 *
 * NOTE: hard delete (§11.117 초기 버전) → soft delete (§11.133) 전환. email
 * unique constraint 유지 — 같은 email 재 invite 는 별도 트랙.
 */

export async function DELETE(
  request: NextRequest,
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

    // §11.133 — soft delete: User row 보존 + deletedAt set
    // (hard delete 가 아닌 audit 추적 강화)
    await db.user.update({
      where: { id: targetUserId },
      data: { deletedAt: new Date() },
    });

    // audit (delete 후에도 actor 의 audit log 는 남음)
    await createAuditLog({
      userId: actorId,
      eventType: AuditEventType.USER_DELETED,
      entityType: "User",
      entityId: targetUserId,
      action: "user_reject",
      ...auditRequestMeta(request), // §11.345-B3 — IP/UA 캡처
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
