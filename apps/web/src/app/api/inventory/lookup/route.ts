import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 품목명 또는 카탈로그 번호로 기존 재고 검색
 * GET /api/inventory/lookup?catalogNumber=xxx&productName=xxx
 * → 매칭되는 inventoryId 반환 (없으면 null)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const catalogNumber = searchParams.get("catalogNumber")?.trim() || null;
    const productName = searchParams.get("productName")?.trim() || null;

    if (!catalogNumber && !productName) {
      return NextResponse.json({ error: "catalogNumber or productName required" }, { status: 400 });
    }

    // catalogNumber 우선 매칭, 없으면 productName으로 검색
    const productConditions: any[] = [];
    if (catalogNumber) {
      productConditions.push({
        product: { catalogNumber: { equals: catalogNumber, mode: "insensitive" } },
      });
    }
    if (productName) {
      productConditions.push({
        product: { name: { equals: productName, mode: "insensitive" } },
      });
    }

    const inventory = await db.productInventory.findFirst({
      where: {
        OR: [
          { userId: session.user.id },
          { organization: { members: { some: { userId: session.user.id } } } },
        ],
        AND: {
          OR: productConditions,
        },
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ inventoryId: inventory?.id ?? null });
  } catch (error) {
    console.error("Error looking up inventory:", error);
    return NextResponse.json(
      { error: "Failed to lookup inventory" },
      { status: 500 }
    );
  }
}
