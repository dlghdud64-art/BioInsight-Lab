import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/api/admin";
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";
import { AuditEventType } from "@prisma/client";

/**
 * §11.134 #admin-user-soft-delete-restore
 *
 * POST /api/admin/users/[id]/restore
 *
 * 운영자 use case:
 *   - 잘못 반려한 user 복구
 *   - cleanup 후 재가입 필요 user 활성화
 *   - §11.133 soft delete 의 inverse — deletedAt → null
 *
 * 권한:
 *   - 401 unauthorized
 *   - 403 non-admin
 *   - 400 already_active (deletedAt 부재 — 복구 불필요)
 *   - 404 target not found
 *   - 200 success
 *
 * 부수효과:
 *   - User.deletedAt = null (active 상태 회복)
 *   - AuditLog USER_UPDATED (action="user_restore", 이전 deletedAt metadata)
 */

export async function POST(
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

    const existing = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deletedAt: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "대상 사용자를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (!existing.deletedAt) {
      return NextResponse.json(
        {
          error: "이미 활성 사용자입니다.",
          reason: "already_active",
        },
        { status: 400 },
      );
    }

    const previousDeletedAt = existing.deletedAt;
    const restored = await db.user.update({
      where: { id: targetUserId },
      data: { deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      userId: actorId,
      eventType: AuditEventType.USER_UPDATED,
      entityType: "User",
      entityId: targetUserId,
      action: "user_restore",
      ...auditRequestMeta(request), // §11.345-B3 — IP/UA 캡처
      metadata: {
        targetUserEmail: existing.email,
        targetUserName: existing.name,
        targetUserRole: existing.role,
        previousDeletedAt: previousDeletedAt?.toISOString() ?? null,
      },
      success: true,
    });

    return NextResponse.json({
      id: restored.id,
      email: restored.email,
      name: restored.name,
      deletedAt: restored.deletedAt,
      updatedAt: restored.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[admin/users/restore] error:", error);
    return NextResponse.json(
      { error: "사용자 복구에 실패했습니다." },
      { status: 500 },
    );
  }
}
