import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

const UseInventorySchema = z.object({
  quantity: z.number().positive("수량은 0보다 커야 합니다."),
  unit: z.string().optional(),
  type: z.enum(["DISPATCH", "USAGE"]).default("USAGE"),
  lotNumber: z.string().optional(),
  destination: z.string().optional(),
  operator: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/inventory/[id]/use
 * 재고 출고/사용 처리
 * - type: "DISPATCH" (출고) | "USAGE" (사용)
 * - currentQuantity 감소 (트랜잭션)
 * - InventoryUsage 이력 기록 + 감사 로그
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      action: 'inventory_use',
      targetEntityType: 'inventory',
      targetEntityId: id,
      sourceSurface: 'inventory-use-api',
      routePath: '/api/inventory/[id]/use',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const inventory = await db.productInventory.findUnique({
      where: { id },
      include: { product: { select: { name: true } } },
    });

    if (!inventory) {
      return NextResponse.json({ error: "재고를 찾을 수 없습니다." }, { status: 404 });
    }

    // 권한 확인
    if (inventory.userId !== session.user.id) {
      if (inventory.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { userId: session.user.id, organizationId: inventory.organizationId },
        });
        if (!membership) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const validation = UseInventorySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "입력값 오류", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { quantity, unit, type, lotNumber, destination, operator, notes } = validation.data;

    const quantityBefore = inventory.currentQuantity;
    const willBeNegative = quantityBefore - quantity < 0;

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;

    const [updatedInventory, usageRecord] = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updated = await tx.productInventory.update({
          where: { id },
          data: {
            currentQuantity: { decrement: quantity },
          },
          include: {
            product: {
              select: { name: true, catalogNumber: true, brand: true },
            },
          },
        });

        const usage = await tx.inventoryUsage.create({
          data: {
            inventoryId: id,
            userId: session.user.id,
            quantity,
            unit: unit ?? inventory.unit ?? undefined,
            type,
            lotNumber: lotNumber ?? null,
            destination: destination ?? null,
            operator: operator ?? null,
            notes: notes ?? null,
          },
        });

        await createAuditLog(
          {
            userId: session.user.id,
            organizationId: inventory.organizationId,
            action: AuditAction.CREATE,
            entityType: AuditEntityType.INVENTORY_USE,
            entityId: usage.id,
            previousData: { currentQuantity: quantityBefore },
            newData: {
              usageId: usage.id,
              inventoryId: id,
              type,
              quantity,
              lotNumber: lotNumber || null,
              destination: destination || null,
              operator: operator || null,
              notes: notes || null,
              currentQuantityAfter: updated.currentQuantity,
            },
            ipAddress,
            userAgent,
          },
          tx
        );

        return [updated, usage];
      }
    );

    enforcement.complete({
      beforeState: { currentQuantity: quantityBefore },
      afterState: { currentQuantity: updatedInventory.currentQuantity, usageRecordId: usageRecord.id },
    });

    return NextResponse.json({
      success: true,
      type,
      updatedQuantity: updatedInventory.currentQuantity,
      usageRecordId: usageRecord.id,
      warning: willBeNegative ? "재고가 0 이하가 되었습니다. 재고를 보충해주세요." : null,
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[inventory/use POST]", error);
    return NextResponse.json({ error: "처리에 실패했습니다." }, { status: 500 });
  }
}

/**
 * GET /api/inventory/[id]/use
 * 출고/사용 이력 조회 (최근 20건)
 * ?type=DISPATCH|USAGE 로 필터 가능
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");

    const where: Prisma.InventoryUsageWhereInput = { inventoryId: id };
    if (typeFilter === "DISPATCH" || typeFilter === "USAGE") {
      where.type = typeFilter;
    }

    const usageRecords = await db.inventoryUsage.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { usageDate: "desc" },
      take: 20,
    });

    return NextResponse.json({ usageRecords });
  } catch (error) {
    console.error("[inventory/use GET]", error);
    return NextResponse.json({ error: "이력 조회에 실패했습니다." }, { status: 500 });
  }
}
