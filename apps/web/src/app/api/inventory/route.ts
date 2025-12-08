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
      organizationId,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "ProductId is required" },
        { status: 400 }
      );
    }

    // 사용자별 또는 조직별 재고 업데이트/생성
    const inventory = await db.productInventory.upsert({
      where: organizationId
        ? { organizationId_productId: { organizationId, productId } }
        : { userId_productId: { userId: session.user.id, productId } },
      create: {
        userId: organizationId ? null : session.user.id,
        organizationId: organizationId || null,
        productId,
        currentQuantity: currentQuantity || 0,
        unit: unit || "개",
        safetyStock,
        minOrderQty,
        location,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        autoReorderEnabled: autoReorderEnabled || false,
        autoReorderThreshold: autoReorderThreshold || null,
        notes,
      },
      update: {
        currentQuantity,
        unit,
        safetyStock,
        minOrderQty,
        location,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        autoReorderEnabled: autoReorderEnabled !== undefined ? autoReorderEnabled : undefined,
        autoReorderThreshold: autoReorderThreshold || null,
        notes,
      },
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Error creating/updating inventory:", error);
    return NextResponse.json(
      { error: "Failed to create/update inventory" },
      { status: 500 }
    );
  }
}



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
      organizationId,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "ProductId is required" },
        { status: 400 }
      );
    }

    // 사용자별 또는 조직별 재고 업데이트/생성
    const inventory = await db.productInventory.upsert({
      where: organizationId
        ? { organizationId_productId: { organizationId, productId } }
        : { userId_productId: { userId: session.user.id, productId } },
      create: {
        userId: organizationId ? null : session.user.id,
        organizationId: organizationId || null,
        productId,
        currentQuantity: currentQuantity || 0,
        unit: unit || "개",
        safetyStock,
        minOrderQty,
        location,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        autoReorderEnabled: autoReorderEnabled || false,
        autoReorderThreshold: autoReorderThreshold || null,
        notes,
      },
      update: {
        currentQuantity,
        unit,
        safetyStock,
        minOrderQty,
        location,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        autoReorderEnabled: autoReorderEnabled !== undefined ? autoReorderEnabled : undefined,
        autoReorderThreshold: autoReorderThreshold || null,
        notes,
      },
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Error creating/updating inventory:", error);
    return NextResponse.json(
      { error: "Failed to create/update inventory" },
      { status: 500 }
    );
  }
}



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
      organizationId,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "ProductId is required" },
        { status: 400 }
      );
    }

    // 사용자별 또는 조직별 재고 업데이트/생성
    const inventory = await db.productInventory.upsert({
      where: organizationId
        ? { organizationId_productId: { organizationId, productId } }
        : { userId_productId: { userId: session.user.id, productId } },
      create: {
        userId: organizationId ? null : session.user.id,
        organizationId: organizationId || null,
        productId,
        currentQuantity: currentQuantity || 0,
        unit: unit || "개",
        safetyStock,
        minOrderQty,
        location,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        autoReorderEnabled: autoReorderEnabled || false,
        autoReorderThreshold: autoReorderThreshold || null,
        notes,
      },
      update: {
        currentQuantity,
        unit,
        safetyStock,
        minOrderQty,
        location,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        autoReorderEnabled: autoReorderEnabled !== undefined ? autoReorderEnabled : undefined,
        autoReorderThreshold: autoReorderThreshold || null,
        notes,
      },
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Error creating/updating inventory:", error);
    return NextResponse.json(
      { error: "Failed to create/update inventory" },
      { status: 500 }
    );
  }
}


