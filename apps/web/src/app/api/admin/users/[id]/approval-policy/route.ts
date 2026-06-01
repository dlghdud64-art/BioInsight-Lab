import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/api/admin";
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";
import {
  normalizeApprovalPolicyInput,
  ApprovalPolicyValidationError,
} from "@/lib/admin/approval-policy";
import { AuditEventType } from "@prisma/client";

/**
 * §11.115 #admin-user-approval-policy-set-surface
 *
 * GET /api/admin/users/[id]/approval-policy — 단일 user 정책 조회.
 * PATCH /api/admin/users/[id]/approval-policy — 정책 변경.
 *
 * Body shape: { approvalLimit?, costCenter?, defaultLocation? }
 *  - approvalLimit: number | string ("100,000,000" 콤마 허용) | null
 *  - costCenter: string | null
 *  - defaultLocation: string | null
 *
 * 권한:
 *  - session 부재 → 401
 *  - non-ADMIN → 403
 *  - validation 실패 → 400 (ApprovalPolicyValidationError)
 *  - target user 부재 → 404
 *  - 그 외 success → 200 + updated user (BigInt → string serialize)
 *
 * 부수효과:
 *  - User row update (3 필드)
 *  - AuditLog row insert (USER_UPDATED, before/after 변경값 metadata)
 *
 * canonical truth: User 모델 직접 update — projection 0, snapshot 0.
 * settings 페이지 read display (`/api/user/profile`) 는 다음 fetch 시 자동 반영.
 *
 * §11.97 schema 의 admin write 분기. read-only 는 settings/page.tsx (§11.87).
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json(
        { error: "사용자 ID 가 필요합니다." },
        { status: 400 },
      );
    }
    const row = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        approvalLimit: true,
        costCenter: true,
        defaultLocation: true,
        updatedAt: true,
      },
    });
    if (!row) {
      return NextResponse.json(
        { error: "대상 사용자를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      id: row.id,
      email: row.email,
      name: row.name,
      approvalLimit: row.approvalLimit?.toString() ?? null,
      costCenter: row.costCenter,
      defaultLocation: row.defaultLocation,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[admin/users/approval-policy GET] error:", error);
    return NextResponse.json(
      { error: "운영 정책 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
      normalized = normalizeApprovalPolicyInput(
        (body ?? {}) as {
          approvalLimit?: string | number | null;
          costCenter?: string | null;
          defaultLocation?: string | null;
        },
      );
    } catch (err) {
      if (err instanceof ApprovalPolicyValidationError) {
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

    // 변경 전 값 fetch (audit log 의 before)
    const before = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        approvalLimit: true,
        costCenter: true,
        defaultLocation: true,
      },
    });

    if (!before) {
      return NextResponse.json(
        { error: "대상 사용자를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const after = await db.user.update({
      where: { id: targetUserId },
      data: {
        approvalLimit: normalized.approvalLimit,
        costCenter: normalized.costCenter,
        defaultLocation: normalized.defaultLocation,
      },
      select: {
        id: true,
        email: true,
        approvalLimit: true,
        costCenter: true,
        defaultLocation: true,
        updatedAt: true,
      },
    });

    // Audit log — graceful (실패 시 endpoint 동작에 영향 0)
    await createAuditLog({
      userId: actorId,
      eventType: AuditEventType.USER_UPDATED,
      entityType: "User",
      entityId: targetUserId,
      action: "approval_policy_update",
      ...auditRequestMeta(request), // §11.345-B — IP/UA 캡처
      changes: {
        before: {
          approvalLimit: before.approvalLimit?.toString() ?? null,
          costCenter: before.costCenter,
          defaultLocation: before.defaultLocation,
        },
        after: {
          approvalLimit: after.approvalLimit?.toString() ?? null,
          costCenter: after.costCenter,
          defaultLocation: after.defaultLocation,
        },
      },
      metadata: {
        targetUserEmail: before.email,
      },
      success: true,
    });

    // BigInt → string serialize (NextResponse.json BigInt 직접 직렬화 불가)
    return NextResponse.json({
      id: after.id,
      email: after.email,
      approvalLimit: after.approvalLimit?.toString() ?? null,
      costCenter: after.costCenter,
      defaultLocation: after.defaultLocation,
      updatedAt: after.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[admin/users/approval-policy] error:", error);
    // schema migration 미적용 시 P2022 graceful 분기
    const errMsg = error instanceof Error ? error.message : "";
    if (errMsg.includes("approvalLimit") || errMsg.includes("costCenter")) {
      return NextResponse.json(
        {
          error:
            "운영 정책 schema 가 적용되지 않았습니다. prisma migrate deploy 후 다시 시도하세요.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "운영 정책 변경에 실패했습니다." },
      { status: 500 },
    );
  }
}
