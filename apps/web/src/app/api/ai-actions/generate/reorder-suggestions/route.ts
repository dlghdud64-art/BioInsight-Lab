import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRole } from "@prisma/client";
import { detectInventoryIssues } from "@/lib/ai/inventory-restock-detector";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";

/**
 * POST /api/ai-actions/generate/reorder-suggestions
 *
 * 재고 부족 및 유효기한 위험 품목을 감지하여 AiActionItem을 생성합니다.
 *
 * Body: { organizationId? }
 *
 * RBAC: MEMBER 역할 불가 (APPROVER 이상)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { organizationId } = body;

    // RBAC: MEMBER 역할 제한
    if (organizationId) {
      const teamMember = await db.teamMember.findFirst({
        where: { userId: session.user.id },
        select: { role: true },
      });
      if (teamMember?.role === TeamRole.MEMBER) {
        return NextResponse.json(
          { error: "일반 멤버는 재발주 제안을 생성할 수 없습니다." },
          { status: 403 }
        );
      }
    }

    const result = await detectInventoryIssues(session.user.id, organizationId);

    // 감사 로그
    if (result.actionsCreated > 0) {
      const { ipAddress, userAgent } = extractRequestMeta(request);
      await createAuditLog({
        userId: session.user.id,
        organizationId: organizationId || null,
        action: AuditAction.CREATE,
        entityType: AuditEntityType.AI_ACTION,
        entityId: "batch-reorder-detection",
        newData: {
          restockCount: result.restockCandidates.length,
          expiryCount: result.expiryCandidates.length,
          actionsCreated: result.actionsCreated,
          skipped: result.skippedDuplicate,
        },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({
      success: true,
      restockCandidates: result.restockCandidates.length,
      expiryCandidates: result.expiryCandidates.length,
      actionsCreated: result.actionsCreated,
      skippedDuplicate: result.skippedDuplicate,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error generating reorder suggestions:", error);
    return NextResponse.json(
      { error: "재발주 제안 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}
