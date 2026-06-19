import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { RETENTION_MONTHS } from "@/lib/billing/retention";

/**
 * GET /api/cron/retention-archive[?dryRun=1] — §pricing-refresh P4a
 *
 * 무료 플랜 보존 만료 데이터 soft 아카이브(archivedAt 세팅). hard delete 0.
 *   대상: FREE + 가입 cutoff(PRICING_ENFORCE_CUTOFF) 이후 사용자의
 *         quote/order/productInventory 중 createdAt < now − RETENTION_MONTHS(3) & archivedAt null.
 *   안전:
 *     - env 미설정/무효 = skip(아카이브 0, 현행 무해 — P2/P3 패턴 정합).
 *     - dryRun=1 = 카운트만 반환(write 0). 첫 실행 권장.
 *     - soft only: updateMany(archivedAt=now). 원본 보존, 업그레이드 시 archivedAt=null 복구(별도).
 *   Auth: CRON_SECRET(Bearer) 또는 x-vercel-cron-signature(user-soft-delete-purge 패턴).
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const cronHeader = request.headers.get("x-vercel-cron-signature");
      const ok = authHeader === `Bearer ${cronSecret}` || cronHeader != null;
      if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

    const result = await logCronExecution(
      "/api/cron/retention-archive",
      async () => {
        // env 미설정/무효 = 아카이브 0(현행 무해).
        const cutoffRaw = process.env.PRICING_ENFORCE_CUTOFF;
        if (!cutoffRaw) return { skipped: "PRICING_ENFORCE_CUTOFF 미설정 — 아카이브 0" };
        const cutoff = new Date(cutoffRaw);
        if (Number.isNaN(cutoff.getTime())) return { skipped: "cutoff 무효 — 아카이브 0" };

        const threshold = new Date();
        threshold.setMonth(threshold.getMonth() - RETENTION_MONTHS);

        // 유료(TEAM/ORG) org 소속 사용자 = 제외(무제한 보존).
        const paid = await db.organizationMember.findMany({
          where: { organization: { subscription: { plan: { in: ["TEAM", "ORGANIZATION"] } } } },
          select: { userId: true },
        });
        const paidIds = new Set(paid.map((m: { userId: string }) => m.userId));

        // FREE + 가입 cutoff 이후(grandfather 보호: 이전 가입자 제외).
        const freeUsers = await db.user.findMany({
          where: { createdAt: { gte: cutoff } },
          select: { id: true },
        });
        const freeIds = freeUsers.map((u: { id: string }) => u.id).filter((id: string) => !paidIds.has(id));
        if (freeIds.length === 0) {
          return { dryRun, candidates: 0, archived: 0 };
        }

        const baseWhere = {
          userId: { in: freeIds },
          createdAt: { lt: threshold },
          archivedAt: null,
        } as const;

        if (dryRun) {
          const [quotes, orders, inventory] = await Promise.all([
            db.quote.count({ where: baseWhere }),
            db.order.count({ where: baseWhere }),
            db.productInventory.count({ where: baseWhere }),
          ]);
          return { dryRun: true, threshold: threshold.toISOString(), candidates: { quotes, orders, inventory } };
        }

        const now = new Date();
        const [quotes, orders, inventory] = await Promise.all([
          db.quote.updateMany({ where: baseWhere, data: { archivedAt: now } }),
          db.order.updateMany({ where: baseWhere, data: { archivedAt: now } }),
          db.productInventory.updateMany({ where: baseWhere, data: { archivedAt: now } }),
        ]);
        return {
          dryRun: false,
          archivedAt: now.toISOString(),
          archived: { quotes: quotes.count, orders: orders.count, inventory: inventory.count },
        };
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/retention-archive] error:", error);
    return NextResponse.json(
      { error: "보존 아카이브 cron 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
