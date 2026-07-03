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
    // #api-inventory-read-org-scope-auto — auto organization scope (M2 mirror).
    //   organizationId queryString 없을 때도 user 가 속한 모든 organization 의
    //   재주문 추천 inventory 자동 노출. explicit queryString single-org override 보존.
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    // §11.236 — Prisma select implicit any narrow.
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

    const inventories = await db.productInventory.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          ...(organizationId
            ? [{ organizationId }]
            : orgIds.map((id: string) => ({ organizationId: id }))),
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
            // 타입 에러 수정: sum과 record 파라미터에 타입 명시
            const totalUsage = inventory.usageRecords.reduce(
              (sum: number, record: any) => sum + record.quantity,
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
      // 타입 에러 수정: filter와 sort 함수의 파라미터에 타입 명시
      .filter((r: any): r is NonNullable<typeof r> => r !== null)
      .sort((a: any, b: any) => {
        // ê¸´ê¸ë ìì¼ë¡ ì ë ¬
        // 타입 에러 수정: urgencyOrder 인덱싱 타입 에러 해결
        const urgencyOrder: { [key: string]: number } = { urgent: 0, high: 1, medium: 2 };
        return (urgencyOrder[a.urgency as string] || 0) - (urgencyOrder[b.urgency as string] || 0);
      });

    // §stock-risk-consolidation P2 (호영님 2026-07-03) — 재발주 차단 사유 실데이터 파생(canonical).
    //   stock-risk 폐기 흡수. (a) RFQ 진행 중: 동일 productId 활성 견적. (b) 예산 초과: 재발주비용(qty×최저가벤더) > 잔여 예산.
    //   가짜 0: 단가 미상/예산 미설정 시 예산차단 미판정. dead button(막힌 재발주) 방지의 canonical 신호.
    const productIds: string[] = recommendations
      .map((r: any) => r.product?.id)
      .filter((id: any): id is string => typeof id === "string");

    const quoteByProduct = new Map<string, string>();
    if (productIds.length > 0) {
      const activeQuotes = await db.quote.findMany({
        where: {
          status: { in: ["PENDING", "PARSED", "SENT", "RESPONDED"] },
          quoteItems: { some: { productId: { in: productIds } } },
          OR: [
            { userId: session.user.id },
            ...(orgIds.length ? [{ organizationId: { in: orgIds } }] : []),
          ],
        },
        select: {
          id: true,
          quoteNumber: true,
          quoteItems: {
            where: { productId: { in: productIds } },
            select: { productId: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      for (const q of activeQuotes as any[]) {
        const ref = q.quoteNumber ?? `RFQ-${String(q.id).slice(0, 8).toUpperCase()}`;
        for (const it of q.quoteItems as any[]) {
          if (!quoteByProduct.has(it.productId)) quoteByProduct.set(it.productId, ref);
        }
      }
    }

    const activeBudget = await db.userBudget.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { remainingAmount: true },
    });
    const budgetRemaining: number | null = activeBudget?.remainingAmount ?? null;

    const enriched = recommendations.map((r: any) => {
      const blockReasons: string[] = [];
      const rfqRef = r.product?.id ? quoteByProduct.get(r.product.id) : undefined;
      if (rfqRef) blockReasons.push(`동일 품목 견적 진행 중 (${rfqRef})`);
      const unitPrice: number | null = r.product?.vendors?.[0]?.priceInKRW ?? null;
      if (budgetRemaining != null && unitPrice != null) {
        const reorderCost = r.recommendedQuantity * unitPrice;
        if (reorderCost > budgetRemaining) {
          blockReasons.push(
            `예산 한도 초과 (재발주 ₩${reorderCost.toLocaleString("ko-KR")} > 잔여 ₩${budgetRemaining.toLocaleString("ko-KR")})`,
          );
        }
      }
      return { ...r, blocked: blockReasons.length > 0, blockReasons };
    });

    return NextResponse.json({ recommendations: enriched });
  } catch (error) {
    console.error("Error fetching reorder recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reorder recommendations" },
      { status: 500 }
    );
  }
}
