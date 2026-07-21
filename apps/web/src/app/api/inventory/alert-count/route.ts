import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isReorderNeeded } from "@/lib/inventory/reorder-need";

// 뱃지 truth — 항상 DB 최신값 (정적 캐시 비활성)
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * §bottom-nav-badge P2 — 하단 내비 재고 탭 뱃지 전용 경량 카운트.
 * GET /api/inventory/alert-count → { count: number }
 *
 * canonical: 판정 = 공유 lib `isReorderNeeded` 단일 규칙(§stock-risk-consolidation P3).
 *   ❌ SQL(where) 번역 금지 — 임계 비교를 where 에 인라인하면 규칙 이원화(F8 금지 경로).
 * 스코프·상한: dashboard/stats 의 allInventories 와 동일
 *   (userId OR organizationId in orgIds, take 500) → 뱃지 = stats KPI
 *   (reorderNeededCount / lowStockAlerts) 와 동일 값 보장. stats route 무접촉.
 * overfetch 0: isReorderNeeded 입력 4필드만 select (product join 없음).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const memberships = await db.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    // §11.236 — Prisma select return implicit any narrow.
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

    const rows = await db.productInventory.findMany({
      where: {
        OR: [
          { userId },
          ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
        ],
      },
      select: {
        currentQuantity: true,
        safetyStock: true,
        averageDailyUsage: true,
        leadTimeDays: true,
      },
      take: 500, // stats allInventories 상한 동일 — 카운트 정합(초과분 drift 방지)
    });

    const count = (rows as Array<Parameters<typeof isReorderNeeded>[0]>).filter(
      (inv) => isReorderNeeded(inv)
    ).length;

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[INVENTORY_ALERT_COUNT]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
