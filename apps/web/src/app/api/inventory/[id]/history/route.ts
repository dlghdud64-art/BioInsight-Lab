/**
 * §inventory-brief-canonical P2 — GET /api/inventory/[id]/history
 *
 * 품목 브리핑 "최근 수정 이력"의 canonical 소스. 기존 하드코딩 JSX
 * (2026-03-28 14:22 · 김연구원 · 수량 조정 5→3) 대체.
 *
 * 소스: DataAuditLog(entityType=INVENTORY, entityId=재고 id).
 *   재고 PATCH(/api/inventory/[id])가 lib/audit.ts 경유로 previousData/newData 스냅샷 기록.
 *   ※ AuditLog(changes) 는 별 계열(감사 이벤트) — 재고 수정 이력 아님.
 *
 * ownership: 재고 기준 owner / organizationMember ([id]/restock GET 정합).
 *   기존 /api/audit-logs 는 ADMIN·org-admin·self 전용이라 일반 연구원이 403 →
 *   본 라우트는 "해당 재고" 이력만 entity-scoped 로 노출(전사 감사 노출 아님, 거버넌스 유지).
 *
 * canonical truth = DB. 응답은 derived projection — mutation 0.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/** 브리핑에 표시할 필드 화이트리스트(내부 키·민감 필드 원문 노출 금지). */
const FIELD_LABEL: Record<string, string> = {
  currentQuantity: "수량",
  location: "위치",
  lotNumber: "Lot",
  expiryDate: "유효기간",
  minOrderQty: "최소 주문 수량",
  notes: "메모",
  safetyStock: "안전재고",
};

export interface InventoryHistoryChange {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

export interface InventoryHistoryEntry {
  id: string;
  action: string;
  /** ISO */
  occurredAt: string;
  actor: string | null;
  changes: InventoryHistoryChange[];
}

/**
 * db(@/lib/db)는 Prisma 미생성 fallback 위해 `any` 타입 →
 * findMany 결과가 any 로 흘러 noImplicitAny(strict) 발생.
 * 아래 select 화이트리스트에 대응하는 런타임 shape 를 명시(파생 projection 용).
 */
type DataAuditLogRow = {
  id: string;
  action: string;
  previousData: unknown;
  newData: unknown;
  createdAt: Date;
  user: { name: string | null } | null;
};

/** 표시용 스칼라 변환. 객체/배열 등 표시 불가 값은 null 로 스킵(허위 표시 금지). */
function toDisplay(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value.trim() === "" ? null : value;
  return null;
}

function diffSnapshots(previous: unknown, next: unknown): InventoryHistoryChange[] {
  if (!previous || !next || typeof previous !== "object" || typeof next !== "object") {
    return [];
  }
  const prev = previous as Record<string, unknown>;
  const curr = next as Record<string, unknown>;
  const changes: InventoryHistoryChange[] = [];

  for (const [field, label] of Object.entries(FIELD_LABEL)) {
    if (!(field in curr)) continue;
    const before = toDisplay(prev[field]);
    const after = toDisplay(curr[field]);
    if (before === after) continue;
    // 양쪽 모두 표시 불가면 스킵(파싱 실패를 가짜 값으로 메우지 않음).
    if (before === null && after === null) continue;
    changes.push({ field, label, before, after });
  }

  return changes;
}

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
      select: { id: true, userId: true, organizationId: true },
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

    const logs = await db.dataAuditLog.findMany({
      where: { entityType: "INVENTORY", entityId: id },
      select: {
        id: true,
        action: true,
        previousData: true,
        newData: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const entries: InventoryHistoryEntry[] = logs.map((log: DataAuditLogRow) => ({
      id: log.id,
      action: log.action,
      occurredAt: log.createdAt.toISOString(),
      actor: log.user?.name ?? null,
      changes: log.action === "UPDATE" ? diffSnapshots(log.previousData, log.newData) : [],
    }));

    return NextResponse.json({ history: entries });
  } catch (error) {
    console.error("[inventory/history/GET]", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
