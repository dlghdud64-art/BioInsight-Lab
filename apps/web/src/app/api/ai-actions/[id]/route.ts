import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";

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

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Error updating AI action:", error);
    return NextResponse.json(
      { error: "Failed to update AI action" },
      { status: 500 }
    );
  }
}
