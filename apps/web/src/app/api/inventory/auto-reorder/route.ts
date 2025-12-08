import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createQuote } from "@/lib/api/quotes";

// ìë ì¬ì£¼ë¬¸ ì¤í API
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, dryRun = false } = body;

    // ìë ì¬ì£¼ë¬¸ì´ íì±íë ì¬ê³  ì¡°í
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

    // ì¬ì£¼ë¬¸ì´ íìí í­ëª© íí°ë§
    const reorderItems = inventories
      .map((inventory: any) => {
        const currentQty = inventory.currentQuantity;
        const threshold = inventory.autoReorderThreshold || inventory.safetyStock || 0;

        // ìê³ê° ì´íì¸ ê²½ì° ì¬ì£¼ë¬¸ íì
        if (currentQty <= threshold) {
          // ì¬ì©ë ì¶ì 
          let estimatedMonthlyUsage = 0;
          if (inventory.usageRecords.length > 0) {
            // 타입 에러 수정: sum과 record 파라미터에 타입 명시
            const totalUsage = inventory.usageRecords.reduce(
              (sum: number, record: any) => sum + record.quantity,
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

          // ì¬ì£¼ë¬¸ ìë ê³ì°
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
      // 타입 에러 수정: item 파라미터에 타입 명시
      .filter((item: any): item is NonNullable<typeof item> => item !== null);

    if (reorderItems.length === 0) {
      return NextResponse.json({
        message: "ì¬ì£¼ë¬¸ì´ íìí í­ëª©ì´ ììµëë¤.",
        items: [],
      });
    }

    if (dryRun) {
      // ëë¼ì´ë° ëª¨ë: ì¤ì ë¡ ìì±íì§ ìê³  ê²°ê³¼ë§ ë°í
      return NextResponse.json({
        message: `${reorderItems.length}ê° í­ëª©ì´ ì¬ì£¼ë¬¸ ëììëë¤.`,
        items: reorderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.inventoryId, // ì¤ì ë¡ë unitì ê°ì ¸ìì¼ í¨
        })),
      });
    }

    // ì¤ì  ì¬ì£¼ë¬¸: íëª© ë¦¬ì¤í¸ ìì±
    const quote = await createQuote({
      userId: session.user.id,
      organizationId,
      title: `ìë ì¬ì£¼ë¬¸ - ${new Date().toLocaleDateString("ko-KR")}`,
      message: `ì¬ê³ ê° ìì  ì¬ê³  ì´íë¡ ë¨ì´ì ¸ ìëì¼ë¡ ìì±ë ì¬ì£¼ë¬¸ ë¦¬ì¤í¸ìëë¤.`,
      productIds: reorderItems.map((item) => item.productId),
      quantities: Object.fromEntries(
        reorderItems.map((item) => [item.productId, item.quantity])
      ),
      notes: Object.fromEntries(
        reorderItems.map((item) => [
          item.productId,
          `ìë ì¬ì£¼ë¬¸ (ì¬ê³ : ${item.inventoryId})`,
        ])
      ),
    });

    return NextResponse.json({
      message: `${reorderItems.length}ê° í­ëª©ì¼ë¡ ì¬ì£¼ë¬¸ ë¦¬ì¤í¸ê° ìì±ëììµëë¤.`,
      quoteId: quote.id,
      items: reorderItems,
    });
  } catch (error: any) {
    console.error("Error executing auto-reorder:", error);
    return NextResponse.json(
      { error: error.message || "ìë ì¬ì£¼ë¬¸ ì¤íì ì¤í¨íìµëë¤." },
      { status: 500 }
    );
  }
}
