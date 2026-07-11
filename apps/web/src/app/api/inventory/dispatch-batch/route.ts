import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { validateUsageForTrackingMode } from "@/lib/inventory/tracking-mode";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

/**
 * POST /api/inventory/dispatch-batch
 * #inventory-batch-dispatch — 다건 lot 원자적 배치출고.
 *
 * ⛔ 원자성 절대: 단일 db.$transaction all-or-nothing. 어느 item 하나라도
 *    실패(미존재/권한/재고음수/GMP 누락)하면 전체 롤백 → write 0.
 *    N회 반복 단건 호출 안티패턴 금지(부분 출고 = GMP truth 위반).
 *
 * body: {
 *   items: [{ inventoryId, lotNumber?, quantity>0, unit?, notes? }],
 *   destination?, operator?, notes?   // 배치 공유 GMP 필드(호영님 2026-07-10 결정 a)
 * }
 * type 은 항상 "DISPATCH".
 */

const BatchItemSchema = z.object({
  inventoryId: z.string().min(1),
  lotNumber: z.string().optional(),
  quantity: z.number().positive("수량은 0보다 커야 합니다."),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

const BatchDispatchSchema = z.object({
  items: z.array(BatchItemSchema).min(1, "출고할 lot 을 1개 이상 선택하세요."),
  // 배치 공유 GMP 필드
  destination: z.string().optional(),
  operator: z.string().optional(),
  notes: z.string().optional(),
});

const FIELD_LABEL_KO: Record<string, string> = {
  lotNumber: "로트번호",
  operator: "담당자",
  destination: "사용처",
};

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    enforcement = enforceAction({
      userId,
      userRole: session.user.role ?? undefined,
      action: "inventory_use",
      targetEntityType: "inventory",
      targetEntityId: "batch",
      sourceSurface: "inventory-batch-dispatch-api",
      routePath: "/api/inventory/dispatch-batch",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const validation = BatchDispatchSchema.safeParse(body);
    if (!validation.success) {
      enforcement.fail();
      return NextResponse.json(
        { error: "입력값 오류", details: validation.error.errors },
        { status: 400 }
      );
    }
    const { items, destination, operator, notes: batchNotes } = validation.data;

    // ── 대상 재고 일괄 조회 ──
    const ids = Array.from(new Set(items.map((i) => i.inventoryId)));
    const inventories = await db.productInventory.findMany({
      where: { id: { in: ids } },
      include: { product: { select: { name: true, catalogNumber: true, brand: true } } },
    });
    const invById = new Map<string, (typeof inventories)[number]>(
      inventories.map((inv: (typeof inventories)[number]) => [inv.id, inv] as const),
    );

    // 사용자 조직 멤버십(권한 검증용)
    const memberships = await db.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = new Set(memberships.map((m: (typeof memberships)[number]) => m.organizationId));

    // ── 사전검증(pre-flight): 하나라도 실패하면 write 0 ──
    const errors: Array<{ inventoryId: string; reason: string; missing?: string[] }> = [];
    for (const item of items) {
      const inv = invById.get(item.inventoryId);
      if (!inv) {
        errors.push({ inventoryId: item.inventoryId, reason: "재고를 찾을 수 없습니다." });
        continue;
      }
      // 권한: 소유자 또는 조직 멤버
      const owned = inv.userId === userId;
      const orgOk = inv.organizationId != null && orgIds.has(inv.organizationId);
      if (!owned && !orgOk) {
        errors.push({ inventoryId: item.inventoryId, reason: "권한이 없습니다." });
        continue;
      }
      // 재고 초과 출고 거부 — 보유량 초과 시 음수 재고 방지(GMP 무결성, 호영님 2026-07-10 결정).
      //   all-or-nothing 유지: 하나라도 초과면 write 0. usage/route.ts 의 Math.max(0) 조용한 클램프와 달리
      //   배치는 명시 거부(출고량 왜곡 방지).
      if (item.quantity > inv.currentQuantity) {
        errors.push({
          inventoryId: item.inventoryId,
          reason: `보유량(${inv.currentQuantity}${inv.unit ?? ""}) 초과 출고 — 요청 ${item.quantity}${item.unit ?? inv.unit ?? ""}.`,
        });
        continue;
      }
      // GMP 추적 게이트(per-item, 공유 destination/operator + item.lotNumber)
      const gate = validateUsageForTrackingMode(inv.trackingMode, {
        lotNumber: item.lotNumber,
        destination,
        operator,
      });
      if (!gate.ok) {
        errors.push({
          inventoryId: item.inventoryId,
          reason: `GMP 추적 필수 항목 누락: ${gate.missing.map((k) => FIELD_LABEL_KO[k] ?? k).join(", ")}`,
          missing: gate.missing,
        });
      }
    }
    if (errors.length > 0) {
      enforcement.fail();
      return NextResponse.json(
        { error: "배치 출고 사전검증 실패 — 처리되지 않았습니다.", itemErrors: errors },
        { status: 422 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;

    // ── 원자적 배치 처리: 단일 트랜잭션 all-or-nothing ──
    const results = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const out: Array<{ inventoryId: string; usageRecordId: string; updatedQuantity: number }> = [];
      for (const item of items) {
        const inv = invById.get(item.inventoryId)!;
        const quantityBefore = inv.currentQuantity;

        const updated = await tx.productInventory.update({
          where: { id: item.inventoryId },
          data: { currentQuantity: { decrement: item.quantity } },
        });

        const usage = await tx.inventoryUsage.create({
          data: {
            inventoryId: item.inventoryId,
            userId,
            quantity: item.quantity,
            unit: item.unit ?? inv.unit ?? undefined,
            type: "DISPATCH",
            lotNumber: item.lotNumber ?? null,
            destination: destination ?? null,
            operator: operator ?? null,
            notes: item.notes ?? batchNotes ?? null,
          },
        });

        await createAuditLog(
          {
            userId,
            organizationId: inv.organizationId,
            action: AuditAction.CREATE,
            entityType: AuditEntityType.INVENTORY_USE,
            entityId: usage.id,
            previousData: { currentQuantity: quantityBefore },
            newData: {
              usageId: usage.id,
              inventoryId: item.inventoryId,
              type: "DISPATCH",
              batch: true,
              trackingMode: inv.trackingMode,
              quantity: item.quantity,
              lotNumber: item.lotNumber || null,
              destination: destination || null,
              operator: operator || null,
              currentQuantityAfter: updated.currentQuantity,
            },
            ipAddress,
            userAgent,
          },
          tx
        );

        out.push({
          inventoryId: item.inventoryId,
          usageRecordId: usage.id,
          updatedQuantity: updated.currentQuantity,
        });
      }
      return out;
    });

    enforcement.complete({
      beforeState: { itemCount: items.length },
      afterState: { dispatched: results.length },
    });

    return NextResponse.json({
      success: true,
      dispatchedCount: results.length,
      results,
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[inventory/dispatch-batch POST]", error);
    return NextResponse.json({ error: "배치 출고에 실패했습니다." }, { status: 500 });
  }
}
