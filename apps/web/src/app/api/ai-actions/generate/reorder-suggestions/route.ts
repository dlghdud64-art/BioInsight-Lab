import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
// §inventory-org-session-authority — 쓰기의 조직은 세션에서만 온다(§invite-flow P2-5).
import { resolveOrganizationIdForMutation } from "@/lib/organizations/active-org";
import { db } from "@/lib/db";
import { TeamRole } from "@prisma/client";
import { detectInventoryIssues } from "@/lib/ai/inventory-restock-detector";
import { createDataAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";

/**
 * POST /api/ai-actions/generate/reorder-suggestions
 *
 * 재고 부족 및 유효기한 위험 품목을 감지하여 AiActionItem을 생성합니다.
 *
 * Body: 없음 (조직은 세션에서 온다 — §inventory-org-session-authority)
 *
 * RBAC: MEMBER 역할 불가 (APPROVER 이상)
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'ai_action_create',
      targetEntityType: 'order',
      // §enforcement-handle-close-sweep (ai-actions) — 'unknown' 유지.
      //   targetEntityType 은 'order' 인데 body 에는 organizationId 뿐이다(조직 전체 재고를
      //   훑어 제안을 만드는 배치라 대상 주문이 없다. 주문은 결과물조차 아니고 AiActionItem 이
      //   생성된다). ⚠️ taxonomy 후보 — §audit-taxonomy-review 에서 함께 판단.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/ai-actions/generate/reorder-suggestions',
    });
    if (!enforcement.allowed) return enforcement.deny();


    await request.json().catch(() => ({}));
    /* 🛑 §inventory-org-session-authority (호영님 2026-09-10 P0) — `organizationId` 를
     *   body 에서 **받지 않는다.** 이전 판본은 그 값을 `detectInventoryIssues` 로 그대로
     *   넘겼고, 그 함수는 `aiActionItem.create({ organizationId })` 까지 간다 →
     *   남의 조직에 처리 항목을 만들 수 있었다. 멤버십 검증은 없었다.
     *   🛑 있던 RBAC 도 이 질문에 답하지 못한다 — `teamMember.findFirst({ where: { userId } })`
     *     는 **역할만** 보고 그 조직 소속인지는 보지 않는다(조건에 organizationId 가 없다).
     *   조직의 권위 있는 출처는 세션 하나다. */
    const orgResolution = await resolveOrganizationIdForMutation({
      userId: session.user.id,
    });
    const organizationId = orgResolution.ok ? orgResolution.organizationId : null;

    // RBAC: MEMBER 역할 제한
    if (organizationId) {
      const teamMember = await db.teamMember.findFirst({
        where: { userId: session.user.id },
        select: { role: true },
      });
      if (teamMember?.role === TeamRole.MEMBER) {
        enforcement.fail();
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
      await createDataAuditLog({
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

    // detectInventoryIssues 가 db.aiActionItem.create 로 실제 생성한다 → complete().
    enforcement.complete({ organizationId: organizationId,
      beforeState: { organizationId: organizationId ?? null, actionsCreated: 0 },
      afterState: {
        organizationId: organizationId ?? null,
        actionsCreated: result.actionsCreated,
        skippedDuplicate: result.skippedDuplicate,
      },
    });

    return NextResponse.json({
      success: true,
      restockCandidates: result.restockCandidates.length,
      expiryCandidates: result.expiryCandidates.length,
      actionsCreated: result.actionsCreated,
      skippedDuplicate: result.skippedDuplicate,
      errors: result.errors,
    });
  } catch (error) {
    enforcement?.fail();
    console.error("Error generating reorder suggestions:", error);
    return NextResponse.json(
      { error: "재발주 제안 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}
