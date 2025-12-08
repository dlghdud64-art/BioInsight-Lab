import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 재고 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const lowStock = searchParams.get("lowStock") === "true"; // 안전 재고 이하만

    const where: any = {
      OR: [
        { userId: session.user.id },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    };

    if (lowStock) {
      where.AND = [
        {
          OR: [
            { safetyStock: { not: null }, currentQuantity: { lte: { safetyStock: true } } },
            { safetyStock: null, currentQuantity: { lte: 0 } },
          ],
        },
      ];
    }

    const inventories = await db.productInventory.findMany({
      where,
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
              take: 1,
              orderBy: {
                priceInKRW: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        currentQuantity: "asc",
      },
    });

    return NextResponse.json({ inventories });
  } catch (error) {
    console.error("Error fetching inventories:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventories" },
      { status: 500 }
    );
  }
}

// 재고 생성/수정