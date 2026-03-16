import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createWorkItem } from "@/lib/work-queue/work-queue-service";
import { COMPARE_SUBSTATUS_DEFS, determineHandoffStallPoint } from "@/lib/work-queue/compare-queue-semantics";
import { determineOpsStallPoint } from "@/lib/work-queue/ops-queue-semantics";

// Next.js 정적 캐시 완전 비활성화: 항상 DB에서 최신 데이터 조회
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 대시보드 통계 API
 * GET /api/dashboard/stats
 *
 * [성능 최적화] 순차 실행 → 4단계 병렬 파이프라인으로 리팩토링
 * - Phase 1: 완전 독립 쿼리 4개 동시 실행
 * - Phase 2: Phase 1 결과 의존 쿼리 6개 동시 실행
 * - Phase 3: quoteId 포함 구매 기록 4개 동시 실행
 * - Phase 4: N+1 제거용 배치 조회 2개 동시 실행
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const guestKey = request.headers.get("x-guest-key") || null;
    console.log("[DASHBOARD_STATS] userId:", userId, "guestKey:", guestKey ? "[present]" : "[none]");

    // 날짜 계산 (공통)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ── Phase 1: 완전 독립 쿼리 4개 동시 실행 ─────────────────────────
    // 이전: 순차 await 4개 (activeBudget → orders → memberships → orgMemberships)
    // 이후: Promise.all로 1번의 DB 라운드트립으로 처리
    const [activeBudget, orders, memberships, orgMemberships] = await Promise.all([
      db.userBudget.findFirst({
        where: { userId, isActive: true },
        include: {
          transactions: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      }),
      db.order.findMany({
        where: { userId },
        select: { id: true, totalAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } }),
      // 중복 제거: organizationMember를 1회만 조회 (기존 코드는 3회 중복 조회)
      db.organizationMember.findMany({ where: { userId }, select: { organizationId: true } }),
    ]);

    const workspaceIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);
    const orgIds = orgMemberships.map((m: { organizationId: string }) => m.organizationId);

    // where 조건 사전 정의 (재사용)
    const inventoryOwnerWhere: any = {
      OR: [
        { userId },
        ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
      ],
    };
    const quoteOwnerWhere: any = {
      OR: [
        { userId },
        ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
      ],
    };

    // ── Phase 2: Phase 1 결과 의존 쿼리 6개 동시 실행 ─────────────────
    // 이전: quotes → ordersWithItems → userInventories → (fallback budget) 순차 실행
    // 이후: 모두 병렬
    const [
      quotes,
      ordersWithItems,
      allInventories,
      expiringInventories,
      userInventories,
      fallbackBudget,
      undecidedCompareCount,
      activeCompareItems,
      decidedCompareSessions,
      compareLinkedQuoteSessions,
      completedCompareItems,
      sessionsWithInquiry,
      followThroughData,
      opsFunnelData,
    ] = await Promise.all([
      db.quote.findMany({
        where: quoteOwnerWhere,
        select: { id: true, status: true, totalAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      // Select only needed fields (기존: include: { items: true } → 모든 필드 로드)
      db.order.findMany({
        where: { userId },
        include: {
          items: {
            select: { productId: true, unitPrice: true, quantity: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.productInventory.findMany({
        where: inventoryOwnerWhere,
        include: {
          product: { select: { name: true, catalogNumber: true, brand: true } },
        },
        take: 500,
      }),
      db.productInventory.findMany({
        where: {
          ...inventoryOwnerWhere,
          expiryDate: { gte: now, lte: thirtyDaysLater },
          NOT: { expiryDate: null },
        },
        include: {
          product: { select: { name: true, catalogNumber: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 10,
      }),
      db.userInventory.findMany({
        where: { userId },
        // 필요 필드만 select (기존: include: { user: true } 불필요 join)
        select: { id: true, orderItemId: true, quantity: true },
      }),
      // fallback 예산: UserBudget 없을 때만 조회 (조건부 병렬)
      activeBudget
        ? Promise.resolve(null)
        : db.budget.findFirst({
            where: {
              scopeKey: { in: [`user-${userId}`, userId, ...orgIds] },
              yearMonth: currentYearMonth,
            },
          }),
      // 비교 판정 대기 건수
      db.compareSession.count({
        where: { userId, decisionState: "UNDECIDED" },
      }).catch(() => 0),
      // 활성 비교 큐 아이템 (SLA/substatus 분석용)
      db.aiActionItem.findMany({
        where: { userId, type: "COMPARE_DECISION" as any, taskStatus: { notIn: ["COMPLETED", "FAILED"] as any[] } },
        select: { substatus: true, createdAt: true, relatedEntityId: true },
      }).catch(() => [] as { substatus: string | null; createdAt: Date; relatedEntityId: string | null }[]),
      // 판정 완료 세션 (평균 소요일 계산용)
      db.compareSession.findMany({
        where: { userId, decisionState: { in: ["APPROVED", "HELD", "REJECTED"] }, decidedAt: { not: null } },
        select: { createdAt: true, decidedAt: true },
        take: 100,
        orderBy: { decidedAt: "desc" },
      }).catch(() => [] as { createdAt: Date; decidedAt: Date | null }[]),
      // 견적 연결된 비교 세션 수
      db.quote.findMany({
        where: { comparisonId: { not: null }, userId },
        select: { comparisonId: true },
        distinct: ["comparisonId" as any],
      }).catch(() => [] as { comparisonId: string | null }[]),
      // 완료된 비교 큐 아이템 (해결 경로 분포 계산용)
      db.aiActionItem.findMany({
        where: { userId, type: "COMPARE_DECISION" as any, taskStatus: "COMPLETED" as any },
        select: { payload: true },
        take: 100,
        orderBy: { completedAt: "desc" },
      }).catch(() => [] as { payload: unknown }[]),
      // 문의 초안이 있는 세션 (no-movement 감지용)
      db.compareSession.findMany({
        where: { userId, inquiryDrafts: { some: {} } },
        select: { id: true },
      }).catch(() => [] as { id: string }[]),
      // Follow-through: compare-origin quotes → orders → restocks
      db.quote.findMany({
        where: { comparisonId: { not: null }, userId },
        select: { id: true },
      }).then(async (cQuotes: { id: string }[]) => {
        if (cQuotes.length === 0) return { quoteCount: 0, orderCount: 0, receivingCount: 0, inventoryCount: 0 };
        const qIds = cQuotes.map((q) => q.id);
        const orders = await db.order.findMany({
          where: { quoteId: { in: qIds } },
          select: { id: true },
        });
        if (orders.length === 0) return { quoteCount: cQuotes.length, orderCount: 0, receivingCount: 0, inventoryCount: 0 };
        const oIds = orders.map((o: { id: string }) => o.id);
        const restocks = await db.inventoryRestock.findMany({
          where: { orderId: { in: oIds } },
          select: { receivingStatus: true },
        });
        return {
          quoteCount: cQuotes.length,
          orderCount: orders.length,
          receivingCount: restocks.length,
          inventoryCount: restocks.filter((r: { receivingStatus: string }) => r.receivingStatus === "COMPLETED").length,
        };
      }).catch(() => ({ quoteCount: 0, orderCount: 0, receivingCount: 0, inventoryCount: 0 })),
      // Ops funnel: all user quotes → purchased → orders confirmed → receiving completed
      db.quote.findMany({
        where: quoteOwnerWhere,
        select: { id: true, status: true },
      }).then(async (allQuotes: { id: string; status: string }[]) => {
        const purchased = allQuotes.filter((q) => q.status === "PURCHASED");
        if (purchased.length === 0) return { totalQuotes: allQuotes.length, purchasedQuotes: 0, confirmedOrders: 0, completedReceiving: 0 };
        const purchasedIds = purchased.map((q) => q.id);
        const ords = await db.order.findMany({
          where: { quoteId: { in: purchasedIds } },
          select: { id: true, status: true },
        });
        const confirmed = ords.filter((o: { status: string }) => ["CONFIRMED", "SHIPPING", "DELIVERED"].includes(o.status));
        if (confirmed.length === 0) return { totalQuotes: allQuotes.length, purchasedQuotes: purchased.length, confirmedOrders: 0, completedReceiving: 0 };
        const oIds = confirmed.map((o: { id: string }) => o.id);
        const restocks = await db.inventoryRestock.findMany({
          where: { orderId: { in: oIds } },
          select: { receivingStatus: true },
        });
        return {
          totalQuotes: allQuotes.length,
          purchasedQuotes: purchased.length,
          confirmedOrders: confirmed.length,
          completedReceiving: restocks.filter((r: { receivingStatus: string }) => r.receivingStatus === "COMPLETED").length,
        };
      }).catch(() => ({ totalQuotes: 0, purchasedQuotes: 0, confirmedOrders: 0, completedReceiving: 0 })),
    ]);

    // ── Phase 3: 구매 기록 쿼리 4개 동시 실행 ─────────────────────────
    // 이전: recentOrders, recentPurchases가 return문 안에서 순차 실행
    // 이후: 모두 병렬 (quoteId 의존성 해소 후 실행)
    const userQuoteIdList = quotes.map((q: { id: string }) => q.id);
    const scopeKeyValues = [userId, ...workspaceIds, ...(guestKey ? [guestKey] : [])];
    const purchaseOwnerWhere: any = {
      OR: [
        { scopeKey: { in: scopeKeyValues } },
        ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
        ...(userQuoteIdList.length > 0 ? [{ quoteId: { in: userQuoteIdList } }] : []),
      ],
    };

    console.log("[DASHBOARD_STATS] scopeKeyValues count:", scopeKeyValues.length, "| quoteIds count:", userQuoteIdList.length);

    const [recentPurchaseRecords, lastMonthRecords, recentOrders, recentPurchases] =
      await Promise.all([
        db.purchaseRecord.findMany({
          where: { ...purchaseOwnerWhere, purchasedAt: { gte: sixMonthsAgo, lte: thisMonthEnd } },
          select: { amount: true, purchasedAt: true },
          orderBy: { purchasedAt: "desc" },
          take: 1000,
        }),
        db.purchaseRecord.findMany({
          where: { ...purchaseOwnerWhere, purchasedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
          select: { amount: true },
          take: 500,
        }),
        // 기존: return문 안에서 순차 await → 이제 병렬
        db.order.findMany({
          where: { userId },
          include: { quote: { select: { title: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        db.purchaseRecord.findMany({
          where: purchaseOwnerWhere,
          orderBy: { purchasedAt: "desc" },
          take: 5,
          select: {
            id: true,
            itemName: true,
            vendorName: true,
            amount: true,
            purchasedAt: true,
            category: true,
            qty: true,
            unit: true,
          },
        }),
      ]);

    // ── Phase 4: N+1 제거 배치 조회 2개 동시 실행 ──────────────────────
    // 이전: userInventories 루프에서 매 항목마다 db.orderItem.findUnique 호출 (N+1)
    // 이후: orderItemId 목록으로 한 번에 batch 조회
    const allProductIds = ordersWithItems
      .flatMap((o: any) => o.items.map((i: any) => i.productId))
      .filter(Boolean) as string[];
    const orderItemIds = (userInventories as any[])
      .map((inv) => inv.orderItemId)
      .filter(Boolean) as string[];

    const [products, orderItems] = await Promise.all([
      allProductIds.length > 0
        ? db.product.findMany({
            where: { id: { in: allProductIds } },
            select: { id: true, category: true },
          })
        : Promise.resolve([] as { id: string; category: string | null }[]),
      orderItemIds.length > 0
        ? db.orderItem.findMany({
            where: { id: { in: orderItemIds } },
            select: { id: true, unitPrice: true },
          })
        : Promise.resolve([] as { id: string; unitPrice: number | null }[]),
    ]);

    // ── 데이터 가공 ────────────────────────────────────────────────────

    // orders 통계
    const totalPurchaseAmount = orders.reduce(
      (sum: number, order: { totalAmount: number }) => sum + order.totalAmount,
      0
    );
    const ordersByStatus = orders.reduce(
      (acc: Record<string, number>, order: { status: string }) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const thisMonthOrders = orders.filter(
      (order: { createdAt: Date | string }) => new Date(order.createdAt) >= monthStart
    );

    // quotes 통계
    const quotesByStatus = quotes.reduce(
      (acc: Record<string, number>, quote: { status: string }) => {
        acc[quote.status] = (acc[quote.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const pendingQuotes = quotesByStatus["PENDING"] || 0;
    const completedQuotes = quotesByStatus["COMPLETED"] || 0;
    const purchasedQuotes = quotesByStatus["PURCHASED"] || 0;
    const respondedQuotes = quotesByStatus["RESPONDED"] || 0;
    const pendingQuotesAmount = quotes
      .filter((q: any) => q.status === "RESPONDED" || q.status === "COMPLETED")
      .reduce((sum: number, q: any) => sum + (q.totalAmount || 0), 0);

    // 이번 달 구매 금액
    const thisMonthPurchaseAmount = recentPurchaseRecords
      .filter((p: any) => new Date(p.purchasedAt) >= monthStart)
      .reduce((s: number, p: any) => s + (p.amount || 0), 0);

    console.log("[DASHBOARD_STATS] recentPurchaseRecords count:", recentPurchaseRecords.length);
    console.log("[DASHBOARD_STATS] thisMonthPurchaseAmount:", thisMonthPurchaseAmount);

    // 전월 대비 증감률
    const lastMonthPurchaseAmount = lastMonthRecords.reduce(
      (s: number, p: any) => s + (p.amount || 0),
      0
    );
    const monthOverMonthChange =
      lastMonthPurchaseAmount > 0
        ? ((thisMonthPurchaseAmount - lastMonthPurchaseAmount) / lastMonthPurchaseAmount) * 100
        : 0;

    // 최근 6개월 월별 지출 (차트용)
    const monthlySpending: Array<{ month: string; amount: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthStr = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`;
      const monthAmount = recentPurchaseRecords
        .filter((p: any) => {
          const d = new Date(p.purchasedAt);
          return d >= mStart && d <= mEnd;
        })
        .reduce((s: number, p: any) => s + (p.amount || 0), 0);
      monthlySpending.push({ month: monthStr, amount: monthAmount });
    }

    // 예산 사용률
    let budgetUsageRate =
      activeBudget && activeBudget.totalAmount > 0
        ? (activeBudget.usedAmount / activeBudget.totalAmount) * 100
        : 0;

    // fallback 예산 처리 (UserBudget 없을 때 Budget 모델 폴백)
    let fallbackBudgetInfo: {
      id: string;
      name: string;
      totalAmount: number;
      usedAmount: number;
      remainingAmount: number;
      usageRate: string;
    } | null = null;
    if (!activeBudget && fallbackBudget) {
      // thisMonthPurchaseAmount는 이미 Phase 3에서 계산됨 → 별도 쿼리 불필요
      budgetUsageRate =
        fallbackBudget.amount > 0
          ? (thisMonthPurchaseAmount / fallbackBudget.amount) * 100
          : 0;
      let budgetName = `${currentYearMonth} Budget`;
      if (fallbackBudget.description) {
        const nm = fallbackBudget.description.match(/^\[([^\]]+)\]/);
        if (nm) budgetName = nm[1];
      }
      fallbackBudgetInfo = {
        id: fallbackBudget.id,
        name: budgetName,
        totalAmount: fallbackBudget.amount,
        usedAmount: thisMonthPurchaseAmount,
        remainingAmount: fallbackBudget.amount - thisMonthPurchaseAmount,
        usageRate: budgetUsageRate.toFixed(1),
      };
    }

    // 카테고리별 지출 (Phase 4 products 결과 활용)
    const productCategoryMap = new Map<string, string>();
    products.forEach((p: { id: string; category: string | null }) =>
      productCategoryMap.set(p.id, p.category || "기타")
    );
    const categorySpending: Record<string, number> = {};
    ordersWithItems.forEach((order: any) => {
      order.items.forEach((item: any) => {
        const category =
          (item.productId && productCategoryMap.get(item.productId)) || "기타";
        const amount = (item.unitPrice || 0) * (item.quantity || 0);
        categorySpending[category] = (categorySpending[category] || 0) + amount;
      });
    });
    const categorySpendingArray = Object.entries(categorySpending).map(
      ([category, amount]) => ({ category, amount: amount as number })
    );

    // 보유 자산 총액 (N+1 제거: orderItemMap 배치 조회 결과 활용)
    const orderItemMap = new Map(
      (orderItems as Array<{ id: string; unitPrice: unknown }>).map((item) => [
        item.id,
        Number(item.unitPrice || 0),
      ])
    );
    let totalAssetValue = 0;
    for (const inventory of userInventories as any[]) {
      if (inventory.orderItemId) {
        const unitPrice = Number(orderItemMap.get(inventory.orderItemId) || 0);
        totalAssetValue += unitPrice * Number(inventory.quantity || 0);
      }
    }

    // 재고 현황
    const reorderNeededCount = (allInventories as any[]).filter((inv) => {
      const dailyUsage = inv.averageDailyUsage ?? 0;
      const leadTime = inv.leadTimeDays ?? 0;
      if (dailyUsage > 0 && leadTime > 0) {
        if (inv.currentQuantity <= dailyUsage * leadTime) return true;
      }
      if (inv.safetyStock !== null) {
        return inv.currentQuantity <= inv.safetyStock;
      }
      return inv.currentQuantity <= 0;
    }).length;

    const lowStockItems = (allInventories as any[])
      .filter((inv) => inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock)
      .slice(0, 5)
      .map((inv) => ({
        id: inv.id,
        productName: inv.product?.name || "Unknown",
        catalogNumber: inv.product?.catalogNumber,
        currentQuantity: inv.currentQuantity,
        safetyStock: inv.safetyStock,
        unit: inv.unit || "ea",
      }));

    const resp = NextResponse.json({
      // 예산 정보
      budget: activeBudget
        ? {
            id: activeBudget.id,
            name: activeBudget.name,
            totalAmount: activeBudget.totalAmount,
            usedAmount: activeBudget.usedAmount,
            remainingAmount: activeBudget.remainingAmount,
            usageRate: budgetUsageRate.toFixed(1),
            fiscalYear: activeBudget.fiscalYear,
            recentTransactions: activeBudget.transactions,
          }
        : fallbackBudgetInfo,
      budgetUsageRate: budgetUsageRate.toFixed(1),
      totalPurchaseAmount,
      thisMonthPurchaseAmount,
      monthOverMonthChange: monthOverMonthChange.toFixed(1),
      totalAssetValue,
      reorderNeededCount,
      lowStockAlerts: reorderNeededCount,
      totalInventory: (allInventories as any[]).length,
      expiringItems: (expiringInventories as any[]).map((inv) => ({
        id: inv.id,
        productName: inv.product?.name || "Unknown",
        catalogNumber: inv.product?.catalogNumber,
        expiryDate: inv.expiryDate,
        currentQuantity: inv.currentQuantity,
        unit: inv.unit || "ea",
        daysLeft: Math.ceil(
          (new Date(inv.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      expiringCount: (expiringInventories as any[]).length,
      lowStockItems,
      categorySpending: categorySpendingArray,
      orderStats: {
        total: orders.length,
        byStatus: ordersByStatus,
        thisMonth: thisMonthOrders.length,
      },
      quoteStats: {
        total: quotes.length,
        byStatus: quotesByStatus,
        pending: pendingQuotes,
        completed: completedQuotes,
        purchased: purchasedQuotes,
        responded: respondedQuotes,
        pendingAmount: pendingQuotesAmount,
      },
      monthlySpending,
      recentOrders,
      recentPurchases,
      undecidedCompareCount,
      compareStats: computeCompareStats(
        undecidedCompareCount as number,
        activeCompareItems as { substatus: string | null; createdAt: Date; relatedEntityId: string | null }[],
        decidedCompareSessions as { createdAt: Date; decidedAt: Date | null }[],
        compareLinkedQuoteSessions as { comparisonId: string | null }[],
        completedCompareItems as { payload: unknown }[],
        sessionsWithInquiry as { id: string }[],
        followThroughData as { quoteCount: number; orderCount: number; receivingCount: number; inventoryCount: number },
      ),
      opsFunnel: (() => {
        const data = opsFunnelData as { totalQuotes: number; purchasedQuotes: number; confirmedOrders: number; completedReceiving: number };
        return {
          ...data,
          stallPoint: determineOpsStallPoint(data),
        };
      })(),
    });

    // Non-blocking: sync compare sessions into work queue
    if (undecidedCompareCount > 0) {
      syncCompareToWorkQueue(userId).catch(() => {});
    }

    return resp;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}

/**
 * Non-blocking: ensure undecided compare sessions have work queue items.
 * Lightweight create-only pass — full reconciliation handled by POST /api/work-queue/compare-sync.
 * Includes duplicate guard: checks both active AND completed items before creating.
 */
async function syncCompareToWorkQueue(userId: string) {
  const sessions = await db.compareSession.findMany({
    where: { userId, OR: [{ decisionState: null }, { decisionState: "UNDECIDED" }] },
    select: { id: true, productIds: true, createdAt: true, diffResult: true },
    take: 50,
  });
  if (sessions.length === 0) return;

  const sessionIds = sessions.map((s: { id: string }) => s.id);

  // Check ALL items (including completed) to prevent duplicates
  const existing = await db.aiActionItem.findMany({
    where: { relatedEntityType: "COMPARE_SESSION", relatedEntityId: { in: sessionIds } },
    select: { relatedEntityId: true },
  });
  const existingSet = new Set(existing.map((e: { relatedEntityId: string | null }) => e.relatedEntityId));

  const allPids = [...new Set(sessions.flatMap((s: { productIds: unknown }) => Array.isArray(s.productIds) ? s.productIds as string[] : []))];
  const products = await db.product.findMany({
    where: { id: { in: allPids } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(products.map((p: { id: string; name: string }) => [p.id, p.name]));

  for (const cs of sessions) {
    if (existingSet.has(cs.id)) continue;
    const pids = Array.isArray(cs.productIds) ? (cs.productIds as string[]) : [];
    const names = pids.map((id: string) => nameMap.get(id) || "제품").slice(0, 2);
    const title = names.length >= 2 ? `${names[0]} vs ${names[1]} 비교 판정` : "비교 세션 판정 대기";
    const diffResult = cs.diffResult as Record<string, unknown>[] | null;
    const verdict = Array.isArray(diffResult) && (diffResult[0] as any)?.summary?.overallVerdict || null;

    await createWorkItem({
      type: "COMPARE_DECISION",
      userId,
      title,
      summary: "비교 분석 완료 — 판정을 내려주세요",
      payload: { productIds: pids, productNames: names, verdict, sessionCreatedAt: cs.createdAt.toISOString() },
      relatedEntityType: "COMPARE_SESSION",
      relatedEntityId: cs.id,
      priority: "MEDIUM",
    });
  }
}

/**
 * 비교 큐 운영 메트릭 계산
 */
function computeCompareStats(
  undecidedCount: number,
  activeItems: { substatus: string | null; createdAt: Date; relatedEntityId: string | null }[],
  decidedSessions: { createdAt: Date; decidedAt: Date | null }[],
  linkedQuoteSessions: { comparisonId: string | null }[],
  completedItems: { payload: unknown }[],
  sessionsWithInquiry: { id: string }[],
  followThrough: { quoteCount: number; orderCount: number; receivingCount: number; inventoryCount: number },
) {
  const now = Date.now();
  const MS_PER_DAY = 86400000;

  let slaBreachedCount = 0;
  let inquiryFollowupCount = 0;
  const substatusBreakdown: Record<string, number> = {};

  for (const item of activeItems) {
    const key = item.substatus || "unknown";
    substatusBreakdown[key] = (substatusBreakdown[key] || 0) + 1;

    const def = COMPARE_SUBSTATUS_DEFS[item.substatus || ""];
    if (def && !def.isTerminal) {
      const ageDays = Math.floor((now - new Date(item.createdAt).getTime()) / MS_PER_DAY);
      if (def.slaWarningDays > 0 && ageDays >= def.slaWarningDays) {
        slaBreachedCount++;
      }
    }
    if (item.substatus === "compare_inquiry_followup") {
      inquiryFollowupCount++;
    }
  }

  const avgTurnaroundMs = decidedSessions.length > 0
    ? decidedSessions.reduce((sum, s) =>
        sum + (new Date(s.decidedAt!).getTime() - new Date(s.createdAt).getTime()), 0
      ) / decidedSessions.length
    : 0;
  const avgTurnaroundDays = Math.round((avgTurnaroundMs / MS_PER_DAY) * 10) / 10;

  const linkedQuoteCount = linkedQuoteSessions.length;
  const conversionRate = decidedSessions.length > 0
    ? Math.round((linkedQuoteCount / decidedSessions.length) * 1000) / 10
    : 0;

  const resolutionPathDistribution: Record<string, number> = {};
  for (const item of completedItems) {
    const path = (item.payload as Record<string, unknown>)?.resolutionPath as string || "unknown";
    resolutionPathDistribution[path] = (resolutionPathDistribution[path] || 0) + 1;
  }

  // no-movement: decision_pending 아이템 중 문의/견적 없이 3일+ 경과
  const inquirySessionIds = new Set(sessionsWithInquiry.map((s) => s.id));
  const quoteSessionIds = new Set(linkedQuoteSessions.map((q) => q.comparisonId).filter(Boolean));
  let noMovementCount = 0;
  for (const item of activeItems) {
    if (item.substatus !== "compare_decision_pending") continue;
    const hasInquiry = item.relatedEntityId ? inquirySessionIds.has(item.relatedEntityId) : false;
    const hasQuote = item.relatedEntityId ? quoteSessionIds.has(item.relatedEntityId) : false;
    if (hasInquiry || hasQuote) continue;
    const ageDays = Math.floor((now - new Date(item.createdAt).getTime()) / MS_PER_DAY);
    if (ageDays >= 3) noMovementCount++;
  }

  const inquiryFollowupRate = undecidedCount > 0
    ? Math.round((inquiryFollowupCount / undecidedCount) * 1000) / 10
    : 0;

  return {
    undecidedCount,
    slaBreachedCount,
    inquiryFollowupCount,
    linkedQuoteCount,
    avgTurnaroundDays,
    substatusBreakdown,
    conversionRate,
    resolutionPathDistribution,
    noMovementCount,
    inquiryFollowupRate,
    compareToQuoteCount: followThrough.quoteCount,
    quoteToPurchaseCount: followThrough.orderCount,
    purchaseToReceivingCount: followThrough.receivingCount,
    receivingToInventoryCount: followThrough.inventoryCount,
    handoffStallPoint: determineHandoffStallPoint({
      compareToQuoteCount: followThrough.quoteCount,
      quoteToPurchaseCount: followThrough.orderCount,
      purchaseToReceivingCount: followThrough.receivingCount,
      receivingToInventoryCount: followThrough.inventoryCount,
    }),
  };
}
