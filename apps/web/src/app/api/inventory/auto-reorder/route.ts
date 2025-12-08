import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createQuote } from "@/lib/api/quotes";

// 자동 재주문 실행 API
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, dryRun = false } = body;

    // 자동 재주문이 활성화된 재고 조회
    const inventories = await db.productInventory.findMany({
      where: {
        autoReorderEnabled: true,
        OR: [
          { userId: session.user.id },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
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
        usageRecords: {
          orderBy: {
            usageDate: "desc",
          },
          take: 30,
        },
      },
    });

    // 재주문이 필요한 항목 필터링
    const reorderItems = inventories
      .map((inventory) => {
        const currentQty = inventory.currentQuantity;
        const threshold = inventory.autoReorderThreshold || inventory.safetyStock || 0;

        // 임계값 이하인 경우 재주문 필요
        if (currentQty <= threshold) {
          // 사용량 추정
          let estimatedMonthlyUsage = 0;
          if (inventory.usageRecords.length > 0) {
            const totalUsage = inventory.usageRecords.reduce(
              (sum, record) => sum + record.quantity,
              0
            );
            const days = Math.max(
              1,
              Math.floor(
                (Date.now() -
                  inventory.usageRecords[inventory.usageRecords.length - 1].usageDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            estimatedMonthlyUsage = (totalUsage / days) * 30;
          }

          // 재주문 수량 계산
          const recommendedQty = Math.max(
            inventory.minOrderQty || 1,
            Math.ceil(threshold + estimatedMonthlyUsage - currentQty)
          );

          return {
            inventoryId: inventory.id,
            productId: inventory.productId,
            quantity: recommendedQty,
            product: inventory.product,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (reorderItems.length === 0) {
      return NextResponse.json({
        message: "재주문이 필요한 항목이 없습니다.",
        items: [],
      });
    }

    if (dryRun) {
      // 드라이런 모드: 실제로 생성하지 않고 결과만 반환
      return NextResponse.json({
        message: `${reorderItems.length}개 항목이 재주문 대상입니다.`,
        items: reorderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.inventoryId, // 실제로는 unit을 가져와야 함
        })),
      });
    }

    // 실제 재주문: 품목 리스트 생성
    const quote = await createQuote({
      userId: session.user.id,
      organizationId,
      title: `자동 재주문 - ${new Date().toLocaleDateString("ko-KR")}`,
      message: `재고가 안전 재고 이하로 떨어져 자동으로 생성된 재주문 리스트입니다.`,
      productIds: reorderItems.map((item) => item.productId),
      quantities: Object.fromEntries(
        reorderItems.map((item) => [item.productId, item.quantity])
      ),
      notes: Object.fromEntries(
        reorderItems.map((item) => [
          item.productId,
          `자동 재주문 (재고: ${item.inventoryId})`,
        ])
      ),
    });

    return NextResponse.json({
      message: `${reorderItems.length}개 항목으로 재주문 리스트가 생성되었습니다.`,
      quoteId: quote.id,
      items: reorderItems,
    });
  } catch (error: any) {
    console.error("Error executing auto-reorder:", error);
    return NextResponse.json(
      { error: error.message || "자동 재주문 실행에 실패했습니다." },
      { status: 500 }
    );
  }
}


import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createQuote } from "@/lib/api/quotes";

// 자동 재주문 실행 API
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, dryRun = false } = body;

    // 자동 재주문이 활성화된 재고 조회
    const inventories = await db.productInventory.findMany({
      where: {
        autoReorderEnabled: true,
        OR: [
          { userId: session.user.id },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
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
        usageRecords: {
          orderBy: {
            usageDate: "desc",
          },
          take: 30,
        },
      },
    });

    // 재주문이 필요한 항목 필터링
    const reorderItems = inventories
      .map((inventory) => {
        const currentQty = inventory.currentQuantity;
        const threshold = inventory.autoReorderThreshold || inventory.safetyStock || 0;

        // 임계값 이하인 경우 재주문 필요
        if (currentQty <= threshold) {
          // 사용량 추정
          let estimatedMonthlyUsage = 0;
          if (inventory.usageRecords.length > 0) {
            const totalUsage = inventory.usageRecords.reduce(
              (sum, record) => sum + record.quantity,
              0
            );
            const days = Math.max(
              1,
              Math.floor(
                (Date.now() -
                  inventory.usageRecords[inventory.usageRecords.length - 1].usageDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            estimatedMonthlyUsage = (totalUsage / days) * 30;
          }

          // 재주문 수량 계산
          const recommendedQty = Math.max(
            inventory.minOrderQty || 1,
            Math.ceil(threshold + estimatedMonthlyUsage - currentQty)
          );

          return {
            inventoryId: inventory.id,
            productId: inventory.productId,
            quantity: recommendedQty,
            product: inventory.product,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (reorderItems.length === 0) {
      return NextResponse.json({
        message: "재주문이 필요한 항목이 없습니다.",
        items: [],
      });
    }

    if (dryRun) {
      // 드라이런 모드: 실제로 생성하지 않고 결과만 반환
      return NextResponse.json({
        message: `${reorderItems.length}개 항목이 재주문 대상입니다.`,
        items: reorderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.inventoryId, // 실제로는 unit을 가져와야 함
        })),
      });
    }

    // 실제 재주문: 품목 리스트 생성
    const quote = await createQuote({
      userId: session.user.id,
      organizationId,
      title: `자동 재주문 - ${new Date().toLocaleDateString("ko-KR")}`,
      message: `재고가 안전 재고 이하로 떨어져 자동으로 생성된 재주문 리스트입니다.`,
      productIds: reorderItems.map((item) => item.productId),
      quantities: Object.fromEntries(
        reorderItems.map((item) => [item.productId, item.quantity])
      ),
      notes: Object.fromEntries(
        reorderItems.map((item) => [
          item.productId,
          `자동 재주문 (재고: ${item.inventoryId})`,
        ])
      ),
    });

    return NextResponse.json({
      message: `${reorderItems.length}개 항목으로 재주문 리스트가 생성되었습니다.`,
      quoteId: quote.id,
      items: reorderItems,
    });
  } catch (error: any) {
    console.error("Error executing auto-reorder:", error);
    return NextResponse.json(
      { error: error.message || "자동 재주문 실행에 실패했습니다." },
      { status: 500 }
    );
  }
}


import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createQuote } from "@/lib/api/quotes";

// 자동 재주문 실행 API
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, dryRun = false } = body;

    // 자동 재주문이 활성화된 재고 조회
    const inventories = await db.productInventory.findMany({
      where: {
        autoReorderEnabled: true,
        OR: [
          { userId: session.user.id },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
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
        usageRecords: {
          orderBy: {
            usageDate: "desc",
          },
          take: 30,
        },
      },
    });

    // 재주문이 필요한 항목 필터링
    const reorderItems = inventories
      .map((inventory) => {
        const currentQty = inventory.currentQuantity;
        const threshold = inventory.autoReorderThreshold || inventory.safetyStock || 0;

        // 임계값 이하인 경우 재주문 필요
        if (currentQty <= threshold) {
          // 사용량 추정
          let estimatedMonthlyUsage = 0;
          if (inventory.usageRecords.length > 0) {
            const totalUsage = inventory.usageRecords.reduce(
              (sum, record) => sum + record.quantity,
              0
            );
            const days = Math.max(
              1,
              Math.floor(
                (Date.now() -
                  inventory.usageRecords[inventory.usageRecords.length - 1].usageDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            estimatedMonthlyUsage = (totalUsage / days) * 30;
          }

          // 재주문 수량 계산
          const recommendedQty = Math.max(
            inventory.minOrderQty || 1,
            Math.ceil(threshold + estimatedMonthlyUsage - currentQty)
          );

          return {
            inventoryId: inventory.id,
            productId: inventory.productId,
            quantity: recommendedQty,
            product: inventory.product,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (reorderItems.length === 0) {
      return NextResponse.json({
        message: "재주문이 필요한 항목이 없습니다.",
        items: [],
      });
    }

    if (dryRun) {
      // 드라이런 모드: 실제로 생성하지 않고 결과만 반환
      return NextResponse.json({
        message: `${reorderItems.length}개 항목이 재주문 대상입니다.`,
        items: reorderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.inventoryId, // 실제로는 unit을 가져와야 함
        })),
      });
    }

    // 실제 재주문: 품목 리스트 생성
    const quote = await createQuote({
      userId: session.user.id,
      organizationId,
      title: `자동 재주문 - ${new Date().toLocaleDateString("ko-KR")}`,
      message: `재고가 안전 재고 이하로 떨어져 자동으로 생성된 재주문 리스트입니다.`,
      productIds: reorderItems.map((item) => item.productId),
      quantities: Object.fromEntries(
        reorderItems.map((item) => [item.productId, item.quantity])
      ),
      notes: Object.fromEntries(
        reorderItems.map((item) => [
          item.productId,
          `자동 재주문 (재고: ${item.inventoryId})`,
        ])
      ),
    });

    return NextResponse.json({
      message: `${reorderItems.length}개 항목으로 재주문 리스트가 생성되었습니다.`,
      quoteId: quote.id,
      items: reorderItems,
    });
  } catch (error: any) {
    console.error("Error executing auto-reorder:", error);
    return NextResponse.json(
      { error: error.message || "자동 재주문 실행에 실패했습니다." },
      { status: 500 }
    );
  }
}




