import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { createActivityLog, getActorRole } from "@/lib/activity-log";

/**
 * GET /api/ai-actions/[id] — 단건 상세 (payload 포함)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await db.aiActionItem.findUnique({
      where: { id: params.id },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (item.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 활동 로그: PENDING 상태 열람 시에만 기록 (중복 방지)
    if (item.status === "PENDING") {
      const { ipAddress, userAgent } = extractRequestMeta(request);
      await createActivityLog({
        activityType: "AI_TASK_OPENED",
        entityType: "AI_ACTION",
        entityId: params.id,
        taskType: item.type,
        afterStatus: item.status,
        userId: session.user.id,
        organizationId: item.organizationId,
        metadata: { title: item.title },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Error fetching AI action:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI action" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai-actions/[id] — 무시/상태 변경
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await db.aiActionItem.findUnique({
      where: { id: params.id },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (item.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !["DISMISSED", "EXPIRED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Allowed: DISMISSED, EXPIRED" },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = extractRequestMeta(request);

    const updated = await db.aiActionItem.update({
      where: { id: params.id },
      data: {
        status,
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
      },
    });

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      organizationId: item.organizationId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.AI_ACTION,
      entityId: params.id,
      previousData: { status: item.status },
      newData: { status },
      ipAddress,
      userAgent,
    });

    // 활동 로그: 검토 완료 (무시/만료)
    const actorRole = await getActorRole(session.user.id, item.organizationId);
    await createActivityLog({
      activityType: "QUOTE_DRAFT_REVIEWED",
      entityType: "AI_ACTION",
      entityId: params.id,
      taskType: item.type,
      beforeStatus: item.status,
      afterStatus: status,
      userId: session.user.id,
      organizationId: item.organizationId,
      actorRole,
      metadata: { decision: status, title: item.title },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Error updating AI action:", error);
    return NextResponse.json(
      { error: "Failed to update AI action" },
      { status: 500 }
    );
  }
}
