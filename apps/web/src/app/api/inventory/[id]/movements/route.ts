/**
 * §inventory-brief-canonical P2 — GET /api/inventory/[id]/movements
 *
 * 품목 브리핑 "최근 입출고"의 canonical 소스. 기존 mock(generateMockTransactions,
 * 3/25·3/27·3/29 하드코딩) 대체.
 *
 * 병합 소스:
 *   - InventoryRestock(restockedAt) → type "in"(완료) / "incoming"(PENDING·PARTIAL·ISSUE)
 *   - InventoryUsage(usageDate)     → type "out" (DISPATCH | USAGE)
 *   ※ 폐기(dispose)는 canonical 소스 부재 → 미표시(허위 금지, PLAN §0 결정 3).
 *
 * ownership: 재고 기준 owner / organizationMember (기존 [id]/restock GET 정합).
 *   기존 /api/inventory/usage GET 은 user.id=본인 필터라 조직 동료 출고가 누락 →
 *   본 라우트는 재고 스코프로 통일해 조용한 누락을 해소한다.
 *
 * canonical truth = DB. 응답은 derived projection — mutation 0.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 브리핑 요약용 기본 건수(전수·출력은 이력 화면 소관). */
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/** 미완료 입고 상태 표시 라벨(내부 enum 원문 노출 금지). */
const RECEIVING_LABEL: Record<string, string> = {
  PENDING: "입고 대기",
  PARTIAL: "일부 입고",
  ISSUE: "입고 이슈",
};

export interface InventoryMovement {
  id: string;
  /** in=입고 완료 · incoming=입고 예정(미완료) · out=출고 */
  type: "in" | "incoming" | "out";
  label: string;
  detail: string;
  /** ISO. 표시 포맷은 클라이언트 소관. */
  occurredAt: string;
  quantity: number;
  unit: string | null;
  actor: string | null;
}

/**
 * db(@/lib/db)는 Prisma 미생성 fallback 위해 `any` → findMany 결과가 any 로 흘러
 * noImplicitAny(strict) 발생. 아래 select 화이트리스트에 대응하는 런타임 shape 명시.
 */
type RestockRow = {
  id: string;
  quantity: number;
  unit: string | null;
  lotNumber: string | null;
  receivingStatus: string;
  restockedAt: Date;
  user: { name: string | null } | null;
};

type UsageRow = {
  id: string;
  quantity: number;
  unit: string | null;
  type: string;
  destination: string | null;
  operator: string | null;
  usageDate: Date;
  user: { name: string | null } | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const inventory = await db.productInventory.findUnique({
      where: { id },
      select: { id: true, userId: true, organizationId: true, unit: true },
    });
    if (!inventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    const isOwner = inventory.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && inventory.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: inventory.organizationId },
        select: { id: true },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );

    // 각 소스에서 limit 건만 조회 후 병합·절단 (overfetch 방지).
    const [restocks, usages] = await Promise.all([
      db.inventoryRestock.findMany({
        where: { inventoryId: id },
        select: {
          id: true,
          quantity: true,
          unit: true,
          lotNumber: true,
          receivingStatus: true,
          restockedAt: true,
          user: { select: { name: true } },
        },
        orderBy: { restockedAt: "desc" },
        take: limit,
      }),
      db.inventoryUsage.findMany({
        where: { inventoryId: id },
        select: {
          id: true,
          quantity: true,
          unit: true,
          type: true,
          destination: true,
          operator: true,
          usageDate: true,
          user: { select: { name: true } },
        },
        orderBy: { usageDate: "desc" },
        take: limit,
      }),
    ]);

    const fallbackUnit = inventory.unit ?? null;

    const restockMovements: InventoryMovement[] = restocks.map((r: RestockRow) => {
      const pending = r.receivingStatus !== "COMPLETED";
      const detailParts = [
        r.lotNumber ? `Lot ${r.lotNumber}` : null,
        pending ? RECEIVING_LABEL[r.receivingStatus] ?? null : null,
        r.user?.name ?? null,
      ].filter(Boolean) as string[];
      return {
        id: r.id,
        type: pending ? "incoming" : "in",
        label: pending ? "입고 예정" : "입고",
        detail: detailParts.join(" · "),
        occurredAt: r.restockedAt.toISOString(),
        quantity: r.quantity,
        unit: r.unit ?? fallbackUnit,
        actor: r.user?.name ?? null,
      };
    });

    const usageMovements: InventoryMovement[] = usages.map((u: UsageRow) => {
      const actor = u.operator ?? u.user?.name ?? null;
      const detailParts = [u.destination ?? null, actor].filter(Boolean) as string[];
      return {
        id: u.id,
        type: "out",
        label: u.type === "DISPATCH" ? "출고 (불출)" : "출고 (사용)",
        detail: detailParts.join(" · "),
        occurredAt: u.usageDate.toISOString(),
        quantity: u.quantity,
        unit: u.unit ?? fallbackUnit,
        actor,
      };
    });

    const movements = [...restockMovements, ...usageMovements]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, limit);

    return NextResponse.json({ movements });
  } catch (error) {
    console.error("[inventory/movements/GET]", error);
    return NextResponse.json({ error: "Failed to fetch movements" }, { status: 500 });
  }
}
