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

/** 브리핑 요약용 기본 건수(기본값 보존 — 브리핑 계약 회귀 금지). */
const DEFAULT_LIMIT = 5;
/** §inventory-history-screen — 전수 이력 화면 페이지 크기 상한. 무제한 조회 금지. */
const MAX_LIMIT = 200;
/**
 * 소스별 스캔 상한. 두 테이블을 앱에서 병합·정렬하므로, 전역 순서가 보장되는 구간은
 * "각 소스에서 가져온 건수"까지다. offset+limit 이 이 상한을 넘으면 정렬이 어긋날 수
 * 있으므로 조용히 잘린 결과를 주지 않고 truncated=true 로 알린다(기간 필터로 좁히도록 유도).
 */
const SCAN_CAP = 1000;

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
    // §inventory-history-screen — 전수 화면용 기간 필터·페이지네이션(브리핑은 미전달 → 기존 동작 유지).
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const parseDate = (v: string | null): Date | null => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const from = parseDate(fromParam);
    const to = parseDate(toParam);
    // 종료일은 해당 일자 끝까지 포함(날짜만 전달된 경우 경계 누락 방지).
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(toParam ?? "")) to.setHours(23, 59, 59, 999);
    const restockWindow = from || to
      ? { restockedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {};
    const usageWindow = from || to
      ? { usageDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {};
    // 병합 후 절단하므로 각 소스는 (offset + limit)까지만 조회 — overfetch 방지.
    const requestedDepth = offset + limit;
    const perSourceTake = Math.min(requestedDepth, SCAN_CAP);
    // 스캔 상한을 넘는 깊이는 전역 정렬을 보장할 수 없음 → 조용한 오정렬 대신 명시 신호.
    const truncated = requestedDepth > SCAN_CAP;

    // 각 소스에서 limit 건만 조회 후 병합·절단 (overfetch 방지).
    const [restocks, usages, restockTotal, usageTotal] = await Promise.all([
      db.inventoryRestock.findMany({
        where: { inventoryId: id, ...restockWindow },
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
        take: perSourceTake,
      }),
      db.inventoryUsage.findMany({
        where: { inventoryId: id, ...usageWindow },
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
        take: perSourceTake,
      }),
      db.inventoryRestock.count({ where: { inventoryId: id, ...restockWindow } }),
      db.inventoryUsage.count({ where: { inventoryId: id, ...usageWindow } }),
    ]);
    const total = restockTotal + usageTotal;

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
      .slice(offset, offset + limit);

    return NextResponse.json({ movements, total, offset, limit, truncated, scanCap: SCAN_CAP });
  } catch (error) {
    console.error("[inventory/movements/GET]", error);
    return NextResponse.json({ error: "Failed to fetch movements" }, { status: 500 });
  }
}
