import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/api/admin";
import { createAuditLog } from "@/lib/audit/audit-logger";
import {
  validateInviteInput,
  buildInviteLink,
  InviteValidationError,
} from "@/lib/admin/invite";
import { AuditEventType } from "@prisma/client";

/**
 * §11.116 #admin-user-invite-flow (link-only)
 *
 * POST /api/admin/users/invite
 *
 * Body shape: { email, name?, role }
 *  - email: required, normalized lowercase
 *  - name: optional
 *  - role: required, UserRole enum
 *
 * 권한:
 *  - session 부재 → 401
 *  - non-ADMIN → 403
 *  - validation 실패 → 400
 *  - email 중복 → 409
 *  - 정상 → 200 + { user, inviteLink }
 *
 * 부수효과:
 *  - User row create (emailVerified=null, organization=actor's organization)
 *  - AuditLog row insert (USER_CREATED)
 *
 * canonical truth: User 모델 직접 create — token DB store 0.
 * NextAuth jwt callback (auth.ts §11.116 patch) 가 OAuth 로그인 시 email match
 * → emailVerified 자동 set → status "pending" → "active" 전환.
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "요청 본문 JSON 파싱에 실패했습니다." },
        { status: 400 },
      );
    }

    let normalized;
    try {
      normalized = validateInviteInput((body ?? {}) as any);
    } catch (err) {
      if (err instanceof InviteValidationError) {
        return NextResponse.json(
          {
            error: err.message,
            field: err.field,
            reason: err.reason,
          },
          { status: 400 },
        );
      }
      throw err;
    }

    // 중복 검사
    const existing = await db.user.findUnique({
      where: { email: normalized.email },
      select: { id: true, emailVerified: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "이미 등록된 이메일입니다.",
          field: "email",
          reason: existing.emailVerified
            ? "active_user"
            : "pending_invite",
          existingUserId: existing.id,
        },
        { status: 409 },
      );
    }

    // actor 의 organization 상속 (없으면 null)
    const actor = await db.user.findUnique({
      where: { id: actorId },
      select: { organization: true },
    });

    const created = await db.user.create({
      data: {
        email: normalized.email,
        name: normalized.name,
        role: normalized.role,
        organization: actor?.organization ?? null,
        // emailVerified 는 default null — OAuth 로그인 시 auth.ts callback
        // (§11.116 patch) 에서 자동 set
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization: true,
        createdAt: true,
      },
    });

    // baseUrl 우선순위: NEXTAUTH_URL > request origin
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      request.headers.get("origin") ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const inviteLink = buildInviteLink(created.email, baseUrl);

    // Audit log — graceful (실패 시 endpoint 동작 영향 0)
    await createAuditLog({
      userId: actorId,
      eventType: AuditEventType.USER_CREATED,
      entityType: "User",
      entityId: created.id,
      action: "user_invite",
      metadata: {
        invitedEmail: created.email,
        invitedName: created.name,
        invitedRole: created.role,
        inviteLinkIssued: true,
      },
      success: true,
    });

    return NextResponse.json({
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role,
        organization: created.organization,
        createdAt: created.createdAt.toISOString(),
      },
      inviteLink,
    });
  } catch (error) {
    console.error("[admin/users/invite] error:", error);
    return NextResponse.json(
      { error: "사용자 초대 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
