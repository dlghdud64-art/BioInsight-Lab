import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ì¬ì£¼ë¬¸ ì¶ì² ëª©ë¡ ì¡°í
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // ì¬ì©ì ëë ì¡°ì§ì ì¬ê³  ì¡°í
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
          take: 30, // ìµê·¼ 30ê° ì¬ì© ê¸°ë¡
        },
      },
    });

    // ì¬ì£¼ë¬¸ ì¶ì² ê³ì°
    const recommendations = inventories
      .map((inventory: any) => {
        const currentQty = inventory.currentQuantity;
        const safetyStock = inventory.safetyStock || 0;

        // ìì  ì¬ê³  ì´íì¸ ê²½ì°
        if (currentQty <= safetyStock) {
          // ì¬ì©ë ì¶ì  (ìµê·¼ 30ì¼ íê·  ì¬ì©ë)
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

          // ì¬ì£¼ë¬¸ ìë ê³ì°: ìì  ì¬ê³  + ìì 1ê°ì ì¬ì©ë - íì¬ ì¬ê³ 
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
            unit: inventory.unit || "ê°",
            urgency: currentQty <= 0 ? "urgent" : currentQty <= safetyStock * 0.5 ? "high" : "medium",
          };
        }
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        // ê¸´ê¸ë ìì¼ë¡ ì ë ¬
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
