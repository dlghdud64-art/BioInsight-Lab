import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const UseInventorySchema = z.object({
  quantity: z.number().positive("사용 수량은 0보다 커야 합니다."),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/inventory/[id]/use
 * 재고 사용(차감) 처리
 * - currentQuantity 감소 (트랜잭션)
 * - InventoryUsage 이력 기록
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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

    const { quantity, unit, notes } = validation.data;

    // 재고 부족 경고 (차단하지는 않음 — 음수 재고 허용, 경고만)
    const willBeNegative = inventory.currentQuantity - quantity < 0;

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
            notes: notes ?? null,
          },
        });

        return [updated, usage];
      }
    );

    return NextResponse.json({
      success: true,
      updatedQuantity: updatedInventory.currentQuantity,
      usageRecordId: usageRecord.id,
      warning: willBeNegative ? "재고가 0 이하가 되었습니다. 재고를 보충해주세요." : null,
    });
  } catch (error) {
    console.error("[inventory/use POST]", error);
    return NextResponse.json({ error: "차감 처리에 실패했습니다." }, { status: 500 });
  }
}

/**
 * GET /api/inventory/[id]/use
 * 사용 이력 조회 (최근 20건)
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

    const usageRecords = await db.inventoryUsage.findMany({
      where: { inventoryId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { usageDate: "desc" },
      take: 20,
    });

    return NextResponse.json({ usageRecords });
  } catch (error) {
    console.error("[inventory/use GET]", error);
    return NextResponse.json({ error: "사용 이력 조회에 실패했습니다." }, { status: 500 });
  }
}
