import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isReorderNeeded } from "@/lib/inventory/reorder-need";
import { computeReorderRecommendation } from "@/lib/inventory/reorder-quantity";

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
        // §stock-risk-consolidation P3 — canonical isReorderNeeded(공유, 복합: 리드타임 OR 안전재고 OR 소진). 단순 safety-stock → 통일.
        if (isReorderNeeded({ currentQuantity: currentQty, safetyStock: inventory.safetyStock, averageDailyUsage: inventory.averageDailyUsage, leadTimeDays: inventory.leadTimeDays })) {
          // ì¬ì©ë ì¶ì  (ìµê·¼ 30ì¼ íê·  ì¬ì©ë)
          // §inventory-delta-label-kpi P1 — 일평균 소진: 저장값(averageDailyUsage) 우선, 없으면 usageRecords 파생.
          let dailyUsage = inventory.averageDailyUsage ?? 0;
          if ((!dailyUsage || dailyUsage <= 0) && inventory.usageRecords.length > 0) {
            const totalUsage = inventory.usageRecords.reduce(
              (sum: number, record: any) => sum + record.quantity,
              0,
            );
            const days = Math.max(
              1,
              Math.floor(
                (Date.now() -
                  inventory.usageRecords[inventory.usageRecords.length - 1].usageDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            );
            dailyUsage = totalUsage / days;
          }

          // §inventory-delta-label-kpi P1 — 핸드오프 §1 canonical 산식(안전재고 갭 + 납기중 소진 → MOQ 반올림).
          //   구 산식(월간소진)에서 교체. 근거 3항(breakdown) 노출 — 레일/모바일/상태카드 동일 소비.
          const reorder = computeReorderRecommendation({
            currentQuantity: currentQty,
            safetyStock: inventory.safetyStock,
            dailyUsage,
            leadTimeDays: inventory.leadTimeDays,
            minOrderQty: inventory.minOrderQty,
          });
          const estimatedMonthlyUsage = Math.round(Math.max(0, dailyUsage) * 30);

          return {
            inventoryId: inventory.id,
            product: inventory.product,
            currentQuantity: currentQty,
            safetyStock,
            recommendedQuantity: reorder.recommendedQuantity,
            recommendedQty: reorder.recommendedQuantity,
            recommendationBreakdown: reorder.breakdown,
            estimatedMonthlyUsage,
            leadTimeDays: inventory.leadTimeDays ?? null,
            averageDailyUsage: dailyUsage,
            unit: inventory.unit || "개",
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
