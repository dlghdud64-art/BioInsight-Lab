import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import {
  deriveDashboardSummary,
  type DashboardSummaryInput,
} from "@/lib/dashboard/summary-derive";

/**
 * §main-dashboard-redesign P1 — 대시보드 단일 진실 API (읽기)
 * GET /api/dashboard/summary
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md
 *
 * 시안 8모듈 단일 진실: MODULES{quote,po,receive,stock} + BUDGET + 파생
 *   (allEmpty/budTone). 현행 /api/dashboard/stats 와 동일 scope 규칙으로 derive
 *   (계약 보존 점진 이관) — 분산 fetch → 단일 진실. 읽기 전용(prod write 0).
 *
 * 가드②: 목업 분포/가짜 차트 데이터 0 — 실데이터/0만.
 * 가드③: 전이맵 로컬 재정의 0 — 카운트 표시만(Pipeline 전이는 P4에서 state-machine 상속).
 *
 * Rollback: 본 endpoint + helper revert 시 현행 분산 stats fetch 그대로 동작.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    // 🛑 §guest-scope-leak (2026-09-16) — `x-guest-key` 를 범위에 넣지 않는다.
    //   근거·계약은 api/dashboard/stats/route.ts 주석 · regression/guest-scope-leak.test.ts

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ── scope 해결 (stats route 와 동일 규칙) ──────────────────────────
    const [activeBudget, memberships, orgMemberships] = await Promise.all([
      db.userBudget.findFirst({ where: { userId, isActive: true } }),
      db.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } }),
      db.organizationMember.findMany({ where: { userId }, select: { organizationId: true } }),
    ]);
    const workspaceIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);
    const orgIds = orgMemberships.map((m: { organizationId: string }) => m.organizationId);

    const quoteOwnerWhere: any = {
      OR: [{ userId }, ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : [])],
    };
    const inventoryOwnerWhere: any = {
      OR: [{ userId }, ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : [])],
    };
    // §receive-canonical — 입고 칩이 여는 /dashboard/receiving 과 **같은 범위**를 센다.
    //   그 화면은 api/receiving-drafts 를 통해 본인 + 소속 조직을 본다. 여기서 userId 만 세면
    //   조직 건이 남아 있는데도 칩이 '이상 없음'(emerald)을 띄운다 — 거짓 안심이다.
    const receivingOwnerWhere: any = {
      OR: [{ userId }, ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : [])],
    };

    // ── MODULES 카운트 (scope 필터 적용) ─────────────────────────────────
    const [
      quotes,
      orders,
      allInventories,
      expiringInventoryCount,
      receivingDraftGroups,
      receivingDraftTotal,
      fallbackBudget,
    ] = await withDbRetry(() =>
      Promise.all([
        db.quote.findMany({
          where: quoteOwnerWhere,
          select: { status: true, totalAmount: true },
          take: 1000,
        }),
        db.order.findMany({
          where: { userId },
          select: { status: true, totalAmount: true, createdAt: true },
          take: 1000,
        }),
        db.productInventory.findMany({
          where: inventoryOwnerWhere,
          select: {
            currentQuantity: true,
            safetyStock: true,
            averageDailyUsage: true,
            leadTimeDays: true,
          },
          take: 1000,
        }),
        db.productInventory.count({
          where: {
            ...inventoryOwnerWhere,
            expiryDate: { gte: now, lte: thirtyDaysLater },
            NOT: { expiryDate: null },
          },
        }),
        // 🛑 §receive-canonical (호영님 판정 2026-09-20 · CLAUDE.md) — 입고 정본은 ReceivingDraft.
        //   (구) 입고 적재 테이블 전량을 셌다. 칩이 여는 /dashboard/receiving 은 ReceivingDraft 를 읽는데
        //        두 테이블이 달라서, 적재분이 N건이어도 Draft 가 0이면 "이상 없음" 을 누르면 빈 화면이었다.
        //   🛑 은퇴한 테이블 이름을 주석에도 남기지 않는다 — 살아 있으면 다음 사람이 그리로 돌아간다((F)① 이 막는다).
        //   (신) 화면이 거는 것과 **같은 3상태 · 같은 범위**를 센다(api/receiving-drafts?status=... 와 동일 집합).
        db.receivingDraft.groupBy({
          by: ["status"],
          where: { ...receivingOwnerWhere, status: { in: ["AWAITING_REPLY", "PENDING_REVIEW", "APPROVED"] } },
          _count: { _all: true },
        }),
        db.receivingDraft.count({
          where: { ...receivingOwnerWhere, status: { in: ["AWAITING_REPLY", "PENDING_REVIEW", "APPROVED"] } },
        }),
        // 활성 UserBudget 부재 시에만 Budget 폴백
        activeBudget
          ? Promise.resolve(null)
          : db.budget.findFirst({
              where: {
                scopeKey: { in: [`user-${userId}`, userId, ...orgIds] },
                yearMonth: currentYearMonth,
              },
            }),
      ]),
    );

    // ── quote 모듈 ──────────────────────────────────────────────────────
    const qByStatus: Record<string, number> = {};
    for (const q of quotes as { status: string; totalAmount: number | null }[]) {
      qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
    }
    const pendingAmount = (quotes as { status: string; totalAmount: number | null }[])
      .filter((q) => q.status === "RESPONDED" || q.status === "COMPLETED")
      .reduce((s, q) => s + (q.totalAmount || 0), 0);

    // ── po(order) 모듈 ──────────────────────────────────────────────────
    const oByStatus: Record<string, number> = {};
    for (const o of orders as { status: string; totalAmount: number; createdAt: Date }[]) {
      oByStatus[o.status] = (oByStatus[o.status] || 0) + 1;
    }
    const confirmedAmount = (orders as { status: string; totalAmount: number }[])
      .filter((o) => ["CONFIRMED", "SHIPPING", "DELIVERED"].includes(o.status))
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    const thisMonthOrders = (orders as { createdAt: Date | string }[]).filter(
      (o) => new Date(o.createdAt) >= monthStart,
    ).length;

    // ── receive 모듈 ────────────────────────────────────────────────────
    // §receive-canonical — 필드명을 ReceivingDraft 상태 그대로 쓴다.
    //   옛 이름(pending/partial/completed/issue)은 InventoryRestock 어휘였다.
    //   이름이 실제와 다르면 다음 사람이 같은 자리에서 또 틀린다 — 이번 결함의 뿌리가 그것이었다.
    const rByStatus: Record<string, number> = {};
    for (const g of receivingDraftGroups as { status: string; _count: { _all: number } }[]) {
      rByStatus[g.status] = g._count._all;
    }

    // ── stock 모듈 ──────────────────────────────────────────────────────
    const inv = allInventories as Array<{
      currentQuantity: number;
      safetyStock: number | null;
      averageDailyUsage: number | null;
      leadTimeDays: number | null;
    }>;
    const reorderNeeded = inv.filter((i) => {
      const dailyUsage = i.averageDailyUsage ?? 0;
      const leadTime = i.leadTimeDays ?? 0;
      if (dailyUsage > 0 && leadTime > 0) {
        if (i.currentQuantity <= dailyUsage * leadTime) return true;
      }
      if (i.safetyStock !== null) return i.currentQuantity <= i.safetyStock;
      return i.currentQuantity <= 0;
    }).length;
    const lowStock = inv.filter(
      (i) => i.safetyStock !== null && i.currentQuantity <= i.safetyStock,
    ).length;

    // ── 이번 달 실 구매액(예산 무관, scope 동일) — StatLine "이번달 지출" + 폴백예산 spent ──
    const scopeKeyValues = [userId, ...workspaceIds];
    const thisMonthSpend = await db.purchaseRecord
      .aggregate({
        where: {
          OR: [
            { scopeKey: { in: scopeKeyValues } },
            ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
          ],
          purchasedAt: { gte: monthStart },
        },
        _sum: { amount: true },
      })
      .then((r: { _sum: { amount: number | null } }) => r._sum.amount || 0)
      .catch(() => 0);

    // ── BUDGET ──────────────────────────────────────────────────────────
    // §budget-period-axis (P1-5) — 시간대 변환은 **여기서 한 번만** 한다.
    //   DateTime 을 KST 달력 날짜(YYYY-MM-DD)로 굳혀 내려보내면, 소비측은 달력 비교만 하면 된다.
    //   운영자 전원 한국 기반(silence-window.ts 와 같은 전제). resolvePeriodYearMonth 와 같은 en-CA 패턴.
    const toKstCalendarDate = (d: Date | null | undefined): string | null =>
      d
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(d)
        : null;

    let budgetInput: DashboardSummaryInput["budget"] = null;
    if (activeBudget && activeBudget.totalAmount > 0) {
      budgetInput = {
        limit: activeBudget.totalAmount,
        spent: activeBudget.usedAmount,
        remaining: activeBudget.remainingAmount,
        // 선언이 없으면 null — 소비측이 이번 달 말일로 폴백한다(종전 동작).
        periodEnd: toKstCalendarDate(activeBudget.endDate as Date | null),
      };
    } else if (fallbackBudget && fallbackBudget.amount > 0) {
      // 폴백 예산: 이번 달 구매액 합으로 spent derive(위 thisMonthSpend 재사용)
      budgetInput = {
        limit: fallbackBudget.amount,
        spent: thisMonthSpend,
        remaining: fallbackBudget.amount - thisMonthSpend,
        // 이 예산은 `yearMonth: currentYearMonth` 로 질의된 **이번 달** 예산이다.
        //   기간 끝 = 이번 달 말일 = 폴백 규칙의 답. 둘이 같으므로 null 로 둔다.
        periodEnd: null,
      };
    }

    const input: DashboardSummaryInput = {
      quote: {
        total: quotes.length,
        pending: qByStatus["PENDING"] || 0,
        responded: qByStatus["RESPONDED"] || 0,
        completed: qByStatus["COMPLETED"] || 0,
        purchased: qByStatus["PURCHASED"] || 0,
        pendingAmount,
      },
      po: {
        total: orders.length,
        ordered: oByStatus["ORDERED"] || 0,
        confirmed: oByStatus["CONFIRMED"] || 0,
        shipping: oByStatus["SHIPPING"] || 0,
        delivered: oByStatus["DELIVERED"] || 0,
        cancelled: oByStatus["CANCELLED"] || 0,
        confirmedAmount,
        thisMonth: thisMonthOrders,
      },
      receive: {
        total: receivingDraftTotal as number,
        awaitingReply: rByStatus["AWAITING_REPLY"] || 0,
        pendingReview: rByStatus["PENDING_REVIEW"] || 0,
        approved: rByStatus["APPROVED"] || 0,
        expiringCount: expiringInventoryCount as number,
      },
      stock: {
        total: inv.length,
        reorderNeeded,
        lowStock,
        expiringCount: expiringInventoryCount as number,
        // assetValue 는 orderItem 단가 linkage(N+1) 필요 — StatLine KPI3
        //   (이번달 지출·잔여 예산·확정 발주액)에 불요 → P1 0. stats endpoint 가 보유.
        assetValue: 0,
      },
      budget: budgetInput,
      spend: { thisMonth: thisMonthSpend },
    };

    return NextResponse.json(deriveDashboardSummary(input));
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard summary" },
      { status: 500 },
    );
  }
}
