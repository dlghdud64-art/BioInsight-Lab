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

// 재고 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      productId,
      currentQuantity,
      unit,
      safetyStock,
      minOrderQty,
      location,
      expiryDate,
      notes,
      autoReorderEnabled,
      autoReorderThreshold,
      organizationId,
      // 아래 필드는 스키마에 없으므로 notes에 병합 처리
      lotNumber,
      testPurpose,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "productId는 필수입니다." },
        { status: 400 }
      );
    }

    // 제품 존재 여부 확인
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json(
        { error: "존재하지 않는 제품입니다." },
        { status: 404 }
      );
    }

    // 중복 재고 확인 (동일 user/org + product)
    const existing = organizationId
      ? await db.productInventory.findFirst({
          where: { organizationId, productId },
        })
      : await db.productInventory.findFirst({
          where: { userId: session.user.id, productId },
        });

    if (existing) {
      return NextResponse.json(
        { error: "이미 등록된 재고입니다. 수정 기능을 이용해 주세요." },
        { status: 409 }
      );
    }

    // notes에 lotNumber, testPurpose 병합 (스키마 미지원 필드)
    const mergedNotes = [
      notes,
      lotNumber ? `[Lot: ${lotNumber}]` : null,
      testPurpose ? `[시험항목: ${testPurpose}]` : null,
    ]
      .filter(Boolean)
      .join("\n") || null;

    const inventory = await db.productInventory.create({
      data: {
        productId,
        userId: organizationId ? null : session.user.id,
        organizationId: organizationId || null,
        currentQuantity: parseFloat(String(currentQuantity)) || 0,
        unit: unit || "ea",
        safetyStock:
          safetyStock !== undefined && safetyStock !== null && safetyStock !== ""
            ? parseFloat(String(safetyStock))
            : null,
        minOrderQty:
          minOrderQty !== undefined && minOrderQty !== null && minOrderQty !== ""
            ? parseFloat(String(minOrderQty))
            : null,
        location: location || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: mergedNotes,
        autoReorderEnabled: Boolean(autoReorderEnabled),
        autoReorderThreshold:
          autoReorderThreshold !== undefined &&
          autoReorderThreshold !== null &&
          autoReorderThreshold !== ""
            ? parseFloat(String(autoReorderThreshold))
            : null,
      },
      include: {
        product: {
          include: {
            vendors: {
              include: { vendor: true },
              take: 1,
              orderBy: { priceInKRW: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({ inventory }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating inventory:", error);
    return NextResponse.json(
      { error: error.message || "재고 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
