import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 재주문 추천 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 사용자 또는 조직의 재고 조회
    const inventories = await db.productInventory.findMany({
      where: {
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
          take: 30, // 최근 30개 사용 기록
        },
      },
    });

    // 재주문 추천 계산
    const recommendations = inventories
      .map((inventory) => {
        const currentQty = inventory.currentQuantity;
        const safetyStock = inventory.safetyStock || 0;

        // 안전 재고 이하인 경우
        if (currentQty <= safetyStock) {
          // 사용량 추정 (최근 30일 평균 사용량)
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
                  inventory.usageRecords[
                    inventory.usageRecords.length - 1
                  ].usageDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            estimatedMonthlyUsage = (totalUsage / days) * 30;
          }

          // 재주문 수량 계산: 안전 재고 + 예상 1개월 사용량 - 현재 재고
          const recommendedQty = Math.max(
            inventory.minOrderQty || 1,
            Math.ceil(safetyStock + estimatedMonthlyUsage - currentQty)
          );

          return {
            inventoryId: inventory.id,
            product: inventory.product,
            currentQuantity: currentQty,
            safetyStock,
            recommendedQuantity: recommendedQty,
            estimatedMonthlyUsage,
            unit: inventory.unit || "개",
            urgency: currentQty <= 0 ? "urgent" : currentQty <= safetyStock * 0.5 ? "high" : "medium",
          };
        }
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        // 긴급도 순으로 정렬
        const urgencyOrder = { urgent: 0, high: 1, medium: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error fetching reorder recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reorder recommendations" },
      { status: 500 }
    );
  }
}



import { auth } from "@/auth";
import { db } from "@/lib/db";

// 재주문 추천 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 사용자 또는 조직의 재고 조회
    const inventories = await db.productInventory.findMany({
      where: {
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
          take: 30, // 최근 30개 사용 기록
        },
      },
    });

    // 재주문 추천 계산
    const recommendations = inventories
      .map((inventory) => {
        const currentQty = inventory.currentQuantity;
        const safetyStock = inventory.safetyStock || 0;

        // 안전 재고 이하인 경우
        if (currentQty <= safetyStock) {
          // 사용량 추정 (최근 30일 평균 사용량)
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
                  inventory.usageRecords[
                    inventory.usageRecords.length - 1
                  ].usageDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            estimatedMonthlyUsage = (totalUsage / days) * 30;
          }

          // 재주문 수량 계산: 안전 재고 + 예상 1개월 사용량 - 현재 재고
          const recommendedQty = Math.max(
            inventory.minOrderQty || 1,
            Math.ceil(safetyStock + estimatedMonthlyUsage - currentQty)
          );

          return {
            inventoryId: inventory.id,
            product: inventory.product,
            currentQuantity: currentQty,
            safetyStock,
            recommendedQuantity: recommendedQty,
            estimatedMonthlyUsage,
            unit: inventory.unit || "개",
            urgency: currentQty <= 0 ? "urgent" : currentQty <= safetyStock * 0.5 ? "high" : "medium",
          };
        }
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        // 긴급도 순으로 정렬
        const urgencyOrder = { urgent: 0, high: 1, medium: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error fetching reorder recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reorder recommendations" },
      { status: 500 }
    );
  }
}



import { auth } from "@/auth";
import { db } from "@/lib/db";

// 재주문 추천 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 사용자 또는 조직의 재고 조회
    const inventories = await db.productInventory.findMany({
      where: {
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
          take: 30, // 최근 30개 사용 기록
        },
      },
    });

    // 재주문 추천 계산
    const recommendations = inventories
      .map((inventory) => {
        const currentQty = inventory.currentQuantity;
        const safetyStock = inventory.safetyStock || 0;

        // 안전 재고 이하인 경우
        if (currentQty <= safetyStock) {
          // 사용량 추정 (최근 30일 평균 사용량)
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
                  inventory.usageRecords[
                    inventory.usageRecords.length - 1
                  ].usageDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            estimatedMonthlyUsage = (totalUsage / days) * 30;
          }

          // 재주문 수량 계산: 안전 재고 + 예상 1개월 사용량 - 현재 재고
          const recommendedQty = Math.max(
            inventory.minOrderQty || 1,
            Math.ceil(safetyStock + estimatedMonthlyUsage - currentQty)
          );

          return {
            inventoryId: inventory.id,
            product: inventory.product,
            currentQuantity: currentQty,
            safetyStock,
            recommendedQuantity: recommendedQty,
            estimatedMonthlyUsage,
            unit: inventory.unit || "개",
            urgency: currentQty <= 0 ? "urgent" : currentQty <= safetyStock * 0.5 ? "high" : "medium",
          };
        }
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        // 긴급도 순으로 정렬
        const urgencyOrder = { urgent: 0, high: 1, medium: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error fetching reorder recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reorder recommendations" },
      { status: 500 }
    );
  }
}






