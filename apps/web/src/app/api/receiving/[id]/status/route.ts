import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { assertTransitionAllowed } from "@/lib/operations/state-machine";
import { logStateTransition } from "@/lib/operations/state-transition-logger";
import { onReceivingCompleted, onInventoryChanged } from "@/lib/operations/automation";
import type { ReceivingStatus } from "@/lib/operations/state-definitions";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

const VALID_STATUSES: ReceivingStatus[] = ["PENDING", "PARTIAL", "COMPLETED", "ISSUE"];

/**
 * 입고 상태 업데이트 API
 * PATCH /api/receiving/[id]/status
 *
 * Body: { status: ReceivingStatus, receivedQuantity?: number, lotNumber?: string, expiryDate?: string, issueNote?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'receiving_status_change',
      targetEntityType: 'receiving',
      targetEntityId: id,
      sourceSurface: 'receiving-status-api',
      routePath: '/api/receiving/[id]/status',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { status, receivedQuantity, lotNumber, expiryDate, issueNote } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `유효하지 않은 상태입니다. 허용: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const restock = await db.inventoryRestock.findUnique({
      where: { id },
      include: { inventory: { select: { id: true, organizationId: true, userId: true } } },
    });

    if (!restock) {
      return NextResponse.json({ error: "입고 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    // 권한 확인
    const isOwner = restock.inventory.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && restock.inventory.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: restock.inventory.organizationId },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // P7-1: 중앙화된 전이 검증
    const currentStatus = restock.receivingStatus as ReceivingStatus;
    try {
      assertTransitionAllowed("RECEIVING", currentStatus, status);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // 트랜잭션으로 상태 업데이트
    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updateData: any = {
        receivingStatus: status,
      };

      if (receivedQuantity !== undefined) {
        updateData.quantity = receivedQuantity;
      }
      if (lotNumber !== undefined) {
        updateData.lotNumber = lotNumber;
      }
      if (expiryDate !== undefined) {
        updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
      }
      if (issueNote !== undefined) {
        updateData.issueNote = issueNote;
      }

      const result = await tx.inventoryRestock.update({
        where: { id },
        data: updateData,
        include: {
          inventory: { select: { id: true, organizationId: true } },
        },
      });

      await logStateTransition(
        {
          domain: "RECEIVING",
          entityId: id,
          fromStatus: currentStatus,
          toStatus: status,
          actorId: session.user.id,
          organizationId: restock.inventory.organizationId,
        },
        tx,
      );

      return result;
    });

    // COMPLETED → 자동 재고 반영 + 상태 재계산
    if (status === "COMPLETED") {
      try {
        await onReceivingCompleted(id, session.user.id, restock.inventory.organizationId);
        await onInventoryChanged(restock.inventoryId, session.user.id, restock.inventory.organizationId);
      } catch (err) {
        console.error("[Receiving/PATCH] Automation error:", err);
      }
    }

    enforcement.complete({
      beforeState: { receivingStatus: currentStatus },
      afterState: { receivingStatus: status },
    });

    return NextResponse.json({
      success: true,
      restock: updated,
      message: `입고 상태가 "${status}"(으)로 변경되었습니다.`,
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[Receiving/PATCH]", error);
    return NextResponse.json(
      { error: "입고 상태 변경에 실패했습니다." },
      { status: 500 },
    );
  }
}
