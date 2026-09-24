import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { resolveBudgetPeriod, pickBudgetCoveringNow } from "@/lib/budget/budget-period";
import { resolveBudgetPurchaseScopeKeys } from "@/lib/budget/purchase-scope-keys";
import {
  deriveDashboardSummary,
  canonicalBudgetQuery,
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

    // ── scope 해결 (stats route 와 동일 규칙) ──────────────────────────
    const [activeBudget, memberships, orgMemberships] = await Promise.all([
      // 🛑 §budget-canonical-pick (P1-9 · 호영님 권고 2026-09-21) — 대시보드 정본 예산은
      //   **오늘이 기간 안에 드는 것 중 가장 최근 시작분** 이다.
      //   (구) `isActive` 만 보고 정렬 없이 findFirst — 어느 것이 뜰지 미정이었다.
      //        prod 실측 2026-09-21: 활성 예산 2건 중 집행 0% 인 검증용이 뽑히고,
      //        실제 운영 예산(17% 집행)은 화면에서 사라졌다. 도넛의 지출액만 그 예산 것이었다.
      //   규칙은 summary-derive 의 canonicalBudgetQuery 한 곳에 있다 — sentinel 이 값으로 잰다.
      db.userBudget.findFirst(canonicalBudgetQuery(userId, now)),
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
      fallbackCandidates,
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
          : // §budget-canonical-pick — 폴백 경로에도 같은 규칙을 건다.
            //   scopeKey 를 여러 개(`user-…` · userId · 조직들) 로 조회하므로 **여러 건이 나올 수 있다**.
            //   정렬이 없으면 어느 것이 뜰지 미정이다 — UserBudget 쪽과 똑같은 결함이고,
            //   2026-09-21 실측 기준 **실제로 쓰이는 것은 이쪽 경로**다.
            //
            // 🛑 §budget-pick-by-period (2026-09-24 prod 실측) · `yearMonth: currentYearMonth` 로 거르면
            //   8월에 만든 하반기 예산(8.18~12.30)이 9월 대시보드에서 사라진다. yearMonth 는 만든 달이다.
            //   범위 안의 예산을 가져와 **기간이 오늘을 포함하는 것**을 pickBudgetCoveringNow 로 고른다.
            db.budget.findMany({
              where: {
                scopeKey: { in: [`user-${userId}`, userId, ...orgIds] },
              },
              orderBy: [{ createdAt: "desc" }],
              take: 200,
            }),
      ]),
    );
    // 🛑 타입 인자를 명시한다 — db 가 any 라 fallbackCandidates 도 any 이고,
    //   그러면 제네릭이 제약(BudgetPeriodInput & { createdAt })으로 떨어져 amount 를 잃는다.
    //   런타임에는 findMany 가 amount 를 내려주지만 타입 정보가 any 에서 끊긴다(2026-09-25 build exit 1).
    const fallbackBudget = fallbackCandidates
      ? pickBudgetCoveringNow<{
          yearMonth: string;
          description: string | null;
          createdAt: Date;
          amount: number;
          scopeKey: string;
          organizationId: string | null;
          workspaceId: string | null;
        }>(fallbackCandidates, now)
      : null;

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
      //
      // 🛑 §budget-period-axis 정정 (2026-09-21 실측) — 여기에 `periodEnd: null` 을 두고
      //   "yearMonth 로 질의했으니 기간 끝 = 이번 달 말일" 이라고 적었던 것은 **거짓이었다.**
      //   legacy Budget 도 `description` 에 실제 기간을 들고 있다
      //   (예: "[… ] | period:2026-09-20~2026-12-30" — yearMonth 는 2026-09 인데 12.30 까지다).
      //   예산 관리 화면은 그 기간을 파싱해 쓰고 여기만 안 읽어서, 같은 예산에 두 기간이 떴다.
      //   → 기간 해석은 resolveBudgetPeriod 하나로 통일한다(화면·합산·대시보드 같은 창).
      //   Date 가 아니라 `endCalendarDate` 를 쓰는 이유는 그 필드 주석에 있다(시간대 왕복 0).
      //
      // 🛑 지출 산식도 같이 옮긴다. 기간만 고치면 **카드 안에서 축이 갈린다** —
      //   기간은 9.20~12.30 인데 소진액은 이번 달치만 세는 카드가 된다(고치기 전보다 더 나쁘다).
      //   (구) spent = thisMonthSpend · scopeKey = [userId, ...workspaceIds]
      //   (신) 예산 관리 화면과 **같은 창 · 같은 키**로 센다:
      //        resolveBudgetPeriod 창 + resolveBudgetPurchaseScopeKeys
      //        (§budget-scope-key-mismatch — org 키와 workspace 키의 공간이 다르다).
      //   `spend.thisMonth` 는 그대로 둔다 — 그건 예산과 무관한 "이번 달 실지출" 이라는 다른 물음이다.
      const fbPeriod = resolveBudgetPeriod(fallbackBudget);
      const fbScopeKeys = await resolveBudgetPurchaseScopeKeys(fallbackBudget);
      const fbSpent = await db.purchaseRecord
        .findMany({
          where: {
            scopeKey: { in: fbScopeKeys },
            purchasedAt: { gte: fbPeriod.periodStart, lte: fbPeriod.periodEnd },
          },
          select: { amount: true },
        })
        .then((rows: { amount: number | null }[]) =>
          rows.reduce((sum, r) => sum + (r.amount || 0), 0),
        )
        .catch(() => 0);

      budgetInput = {
        limit: fallbackBudget.amount,
        spent: fbSpent,
        remaining: fallbackBudget.amount - fbSpent,
        periodEnd: fbPeriod.endCalendarDate,
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
