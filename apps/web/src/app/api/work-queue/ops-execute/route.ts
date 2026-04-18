/**
 * POST /api/work-queue/ops-execute
 *
 * Canonical ops CTA execution: looks up the CTA completion definition,
 * transitions the work item via transitionWorkItem(), triggers ownership
 * transfer if defined, and creates the next queue item.
 *
 * All state changes go through transitionWorkItem() — never direct DB update.
 */
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { transitionWorkItem, createWorkItem } from "@/lib/work-queue/work-queue-service";
import { handleApiError } from "@/lib/api-error-handler";
import {
  findCompletionDef,
  resolveOwnershipTransfer,
  OPS_QUEUE_ITEM_TYPES,
} from "@/lib/work-queue/ops-queue-semantics";

interface ExecuteBody {
  actionId: string;
  itemId: string;
  payload?: Record<string, unknown>;
}

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
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/work-queue/ops-execute',
    });
    if (!enforcement.allowed) return enforcement.deny();

        const userId = session?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ExecuteBody = await request.json();
    const { actionId, itemId, payload } = body;

    if (!actionId || !itemId) {
      return NextResponse.json(
        { error: "actionId and itemId are required" },
        { status: 400 }
      );
    }

    // 1. Load item
    const item = await db.aiActionItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        userId: true,
        taskStatus: true,
        substatus: true,
        type: true,
        relatedEntityType: true,
        relatedEntityId: true,
        organizationId: true,
        title: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Ownership check
    if (item.userId !== userId) {
      if (item.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { organizationId: item.organizationId, userId },
          select: { role: true },
        });
        if (!membership) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 2. Duplicate-click protection
    if (item.taskStatus === "COMPLETED" || item.taskStatus === "FAILED") {
      return NextResponse.json(
        { error: "DUPLICATE_ACTION", message: "이미 처리 완료된 작업입니다." },
        { status: 409 }
      );
    }

    // 3. Look up completion def
    const completionDef = findCompletionDef(actionId);
    if (!completionDef) {
      return NextResponse.json(
        { error: "UNKNOWN_ACTION", message: `알 수 없는 액션입니다: ${actionId}` },
        { status: 400 }
      );
    }

    // 4. Validate substatus (stalled handoff accepts any substatus)
    if (
      completionDef.sourceSubstatuses.length > 0 &&
      item.substatus &&
      !completionDef.sourceSubstatuses.includes(item.substatus)
    ) {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: `현재 상태(${item.substatus})에서 ${actionId}을(를) 실행할 수 없습니다.`,
        },
        { status: 400 }
      );
    }

    // 5. Execute: transition work item
    try {
      await transitionWorkItem({
        itemId: item.id,
        substatus: completionDef.successTransition,
        userId,
        metadata: {
          ctaId: actionId,
          queueItemType: completionDef.sourceQueueItemType,
          ownershipBefore: OPS_QUEUE_ITEM_TYPES[completionDef.sourceQueueItemType]?.owner ?? null,
          outcome: "success",
          ...(payload ?? {}),
        },
      });

      let nextItemId: string | null = null;

      // 6. Ownership transfer → create next queue item
      if (completionDef.ownershipTransferId && completionDef.nextQueueItemType) {
        const transfer = resolveOwnershipTransfer(completionDef.ownershipTransferId);
        const nextType = OPS_QUEUE_ITEM_TYPES[completionDef.nextQueueItemType];

        if (transfer && nextType) {
          // Determine the action type for the next queue item
          const nextActionType = nextType.sourceSubstatuses.length > 0
            ? (await getActionTypeForSubstatus(nextType.sourceSubstatuses[0]))
            : "STATUS_CHANGE_SUGGEST";

          nextItemId = await createWorkItem({
            type: nextActionType as any,
            userId: item.userId,
            organizationId: item.organizationId ?? undefined,
            title: `${nextType.label} — ${item.title || ""}`.trim(),
            summary: nextType.meaning,
            payload: {
              previousQueueItemId: item.id,
              transferId: transfer.id,
              ownershipAfter: transfer.nextOwner,
              entityType: item.relatedEntityType,
            },
            relatedEntityType: item.relatedEntityType ?? undefined,
            relatedEntityId: item.relatedEntityId ?? undefined,
            priority: "MEDIUM",
          });
        }
      }

      return NextResponse.json({
        success: true,
        closedItemId: item.id,
        nextItemId,
        actionId,
      });
    } catch (execError) {
      // Execution failure → transition to failure state
      await transitionWorkItem({
        itemId: item.id,
        substatus: completionDef.failureTransition,
        userId,
        metadata: {
          ctaId: actionId,
          outcome: "failure",
          error: String(execError),
        },
      }).catch(() => {
        // Transition itself failed — log but don't mask original error
        console.error("[ops-execute] failure transition also failed:", execError);
      });

      return NextResponse.json(
        { error: "EXECUTION_FAILED", message: String(execError) },
        { status: 500 }
      );
    }
  } catch (error) {
    return handleApiError(error, "POST /api/work-queue/ops-execute");
  }
}

/**
 * substatus → ownerActionType 매핑 헬퍼.
 * OPS_SUBSTATUS_DEFS에서 해당 substatus의 ownerActionType을 가져옵니다.
 */
async function getActionTypeForSubstatus(substatus: string): Promise<string> {
  const { OPS_SUBSTATUS_DEFS } = await import("@/lib/work-queue/ops-queue-semantics");
  return OPS_SUBSTATUS_DEFS[substatus]?.ownerActionType ?? "STATUS_CHANGE_SUGGEST";
}
