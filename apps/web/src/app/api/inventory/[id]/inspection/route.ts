import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// 점검 이력 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inventory = await db.productInventory.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, organizationId: true },
    });

    if (!inventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    if (inventory.userId !== session.user.id && !inventory.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const inspections = await db.inspection.findMany({
      where: { inventoryId: params.id },
      orderBy: { inspectedAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({ inspections });
  } catch (error) {
    console.error("Error fetching inspections:", error);
    return NextResponse.json(
      { error: "Failed to fetch inspections" },
      { status: 500 }
    );
  }
}

// 점검 기록 생성
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'inventory_update',
      targetEntityType: 'inventory',
      targetEntityId: params.id,
      sourceSurface: 'inventory-api',
      routePath: '/api/inventory/[id]/inspection',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const inventory = await db.productInventory.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, organizationId: true },
    });

    if (!inventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    if (inventory.userId !== session.user.id && !inventory.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { result, checklist, notes } = body;

    if (!result || !["PASS", "CAUTION", "FAIL"].includes(result)) {
      return NextResponse.json({ error: "Invalid result value" }, { status: 400 });
    }

    if (!checklist || typeof checklist !== "object") {
      return NextResponse.json({ error: "Checklist is required" }, { status: 400 });
    }

    const { ipAddress, userAgent } = extractRequestMeta(request);

    const inspection = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.inspection.create({
        data: {
          inventoryId: params.id,
          userId: session.user.id,
          organizationId: inventory.organizationId,
          result,
          checklist,
          notes: notes || null,
        },
        include: {
          user: { select: { name: true } },
        },
      });

      await tx.productInventory.update({
        where: { id: params.id },
        data: { lastInspectedAt: new Date() },
      });

      await createAuditLog(
        {
          userId: session.user.id,
          organizationId: inventory.organizationId,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.INSPECTION,
          entityId: created.id,
          newData: { result, checklist, notes },
          ipAddress,
          userAgent,
        },
        tx
      );

      return created;
    });

    enforcement.complete({});
    return NextResponse.json({ inspection }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    console.error("Error creating inspection:", error);
    return NextResponse.json(
      { error: "Failed to create inspection" },
      { status: 500 }
    );
  }
}
