import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/api/admin";
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";
import { AuditEventType } from "@prisma/client";

/**
 * §11.117 #admin-user-approval-flow — manual approve
 *
 * POST /api/admin/users/[id]/approval
 *
 * 운영자 use case:
 *   - invited user 가 OAuth 로그인 안 함 + 호영님이 다른 채널 (사내 SSO,
 *     수기 확인) 로 신원 확인 후 수동 활성화
 *   - emailVerified=null → emailVerified=now (OAuth bypass)
 *
 * 권한:
 *   - 401 unauthorized
 *   - 403 non-admin
 *   - 400 already active (emailVerified truthy)
 *   - 404 target not found
 *   - 200 success
 *
 * 부수효과:
 *   - User.emailVerified set
 *   - AuditLog USER_UPDATED (manual_approval)
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
        emailVerified: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "대상 사용자를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (existing.emailVerified) {
      return NextResponse.json(
        {
          error: "이미 활성 사용자입니다.",
          reason: "already_active",
        },
        { status: 400 },
      );
    }

    const verifiedAt = new Date();
    const updated = await db.user.update({
      where: { id: targetUserId },
      data: { emailVerified: new Date() },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      userId: actorId,
      eventType: AuditEventType.USER_UPDATED,
      entityType: "User",
      entityId: targetUserId,
      action: "manual_approval",
      ...auditRequestMeta(request), // §11.345-B3 — IP/UA 캡처
      metadata: {
        targetUserEmail: existing.email,
        targetUserName: existing.name,
        emailVerifiedAt: verifiedAt.toISOString(),
      },
      success: true,
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      emailVerified: updated.emailVerified?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[admin/users/approval POST] error:", error);
    return NextResponse.json(
      { error: "사용자 승인 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
