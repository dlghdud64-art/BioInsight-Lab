import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createQuote } from "@/lib/api/quotes";

// ìë ì¬ì£¼ë¬¸ ì¤í API
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'order',
      // §enforcement-handle-close-sweep (inventory) — 'unknown' **유지**. 이 라우트는 조직의
      //   미달 재고 전체를 훑어 견적을 만드는 배치라 targetEntityType('order') 에 해당하는
      //   대상 엔티티가 호출 시점에 없다(주문은 이 호출의 결과물). 억지 id 를 넣으면
      //   per-call unique 가 되어 double-submit 보호가 사라진다 — 'unknown' 은 전역 공용 키가
      //   아니라 userId 폴백(§11.369-3 deriveConcurrencyKey)이라 per-user 보호가 유지된다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/inventory/auto-reorder',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { organizationId, dryRun = false } = body;

    // ìë ì¬ì£¼ë¬¸ì´ íì±íë ì¬ê³  ì¡°í
    // #api-inventory-read-org-scope-auto — auto organization scope (M2 mirror).
    //   organizationId body 없을 때도 user 가 속한 모든 organization 의 자동
    //   재주문 inventory 가 자동 노출 — 조직 멤버 collaboration 정합 + pilot
    //   row 가시성. explicit organizationId body 는 single-org override 보존.
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    // §11.236 — Prisma select implicit any narrow.
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

    const inventories = await db.productInventory.findMany({
      where: {
        autoReorderEnabled: true,
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
      enforcement.fail();
      return NextResponse.json({
        message: "ì¬ì£¼ë¬¸ì´ íìí í­ëª©ì´ ììµëë¤.",
        items: [],
      });
    }

    if (dryRun) {
      // dryRun 은 쓰기 0 — 성공 audit 대상이 아니므로 fail() 로 lock 만 해제한다.
      enforcement.fail();
      // ëë¼ì´ë° ëª¨ë: ì¤ì ë¡ ìì±íì§ ìê³  ê²°ê³¼ë§ ë°í
      return NextResponse.json({
        message: `${reorderItems.length}ê° í­ëª©ì´ ì¬ì£¼ë¬¸ ëììëë¤.`,
        // 타입 에러 수정: map 함수의 item 파라미터에 타입 명시
        items: reorderItems.map((item: any) => ({
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
      // 타입 에러 수정: item 파라미터에 타입 명시
      productIds: reorderItems.map((item: any) => item.productId),
      quantities: Object.fromEntries(
        reorderItems.map((item: any) => [item.productId, item.quantity])
      ),
      notes: Object.fromEntries(
        reorderItems.map((item: any) => [
          item.productId,
          `ìë ì¬ì£¼ë¬¸ (ì¬ê³ : ${item.inventoryId})`,
        ])
      ),
    });

    enforcement.complete({
      beforeState: { organizationId: organizationId ?? null, quoteId: null },
      afterState: { organizationId: organizationId ?? null, quoteId: quote.id, itemCount: reorderItems.length },
    });

    return NextResponse.json({
      message: `${reorderItems.length}ê° í­ëª©ì¼ë¡ ì¬ì£¼ë¬¸ ë¦¬ì¤í¸ê° ìì±ëììµëë¤.`,
      quoteId: quote.id,
      items: reorderItems,
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error executing auto-reorder:", error);
    return NextResponse.json(
      { error: error.message || "ìë ì¬ì£¼ë¬¸ ì¤íì ì¤í¨íìµëë¤." },
      { status: 500 }
    );
  }
}
