import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";

/**
 * POST /api/receiving-drafts/:id/approve  (§11.348-A-4)
 *
 * 연구소 사람 승인 → "검증 대기 입고안"(PENDING_REVIEW)을 canonical 입고로 확정.
 * 공급사 회신(LOT·실수량·유효기간)을 기준으로 ProductInventory 증분 + InventoryRestock 생성.
 *
 * 폐루프에서 **처음으로 canonical 재고를 바꾸는 단계** — 다중 가드 필수:
 *   - 권한: draft.userId 또는 조직 멤버.
 *   - status === PENDING_REVIEW 만 (회신 도착분).
 *   - 이중입고 방지 ①: draft.restockSyncedAt != null 이면 거부(이미 확정).
 *   - 이중입고 방지 ②: order.status === DELIVERED 면 거부(status 경로로 이미 입고).
 *     승인 시 order → DELIVERED(terminal)로 전이해 status 경로 재sync 차단.
 *   - productId + receivedQuantity>0 품목이 없으면 422.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;

    const draft = await db.receivingDraft.findUnique({
      where: { id },
      include: { items: true, order: { select: { id: true, status: true, organizationId: true } } },
    });
    if (!draft) {
      return NextResponse.json({ error: "입고안을 찾을 수 없습니다." }, { status: 404 });
    }

    // 권한: 소유자 또는 조직 멤버
    const isOwner = draft.userId === userId;
    let isOrgMember = false;
    if (!isOwner && draft.organizationId) {
      const member = await db.organizationMember.findFirst({
        where: { userId, organizationId: draft.organizationId },
      });
      isOrgMember = !!member;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 상태 가드 — 검토 대기만 승인 가능
    if (draft.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: "검토 대기 상태의 입고안만 승인할 수 있습니다.", status: draft.status },
        { status: 409 },
      );
    }
    // 이중입고 방지 ① — 이미 동기화된 입고안
    if (draft.restockSyncedAt) {
      return NextResponse.json(
        { error: "이미 입고 확정된 입고안입니다.", code: "ALREADY_SYNCED" },
        { status: 409 },
      );
    }
    // 이중입고 방지 ② — 발주가 이미 입고 확정(status 경로) 상태
    if (draft.order?.status === "DELIVERED") {
      return NextResponse.json(
        { error: "이미 입고 확정된 발주입니다. (배송 완료 처리됨)", code: "ORDER_ALREADY_DELIVERED" },
        { status: 409 },
      );
    }

    // 입고 대상 품목 — productId 있고 실수량 > 0
    const restockable = draft.items.filter(
      (it: { productId: string | null; receivedQuantity: number | null }) => it.productId && (it.receivedQuantity ?? 0) > 0,
    );
    if (restockable.length === 0) {
      return NextResponse.json(
        { error: "입고할 품목이 없습니다. (제품 매핑·실수량 확인 필요)", code: "NO_RESTOCKABLE_ITEMS" },
        { status: 422 },
      );
    }

    const ownerKind: "organization" | "user" = draft.organizationId ? "organization" : "user";

    const result = await db.$transaction(async (tx: any) => {
      // productId 별 실수량 합산 → ProductInventory upsert(증분)
      const aggregated = new Map<string, number>();
      for (const it of restockable) {
        aggregated.set(it.productId as string, (aggregated.get(it.productId as string) ?? 0) + (it.receivedQuantity as number));
      }
      for (const [productId, qty] of aggregated.entries()) {
        const where =
          ownerKind === "organization"
            ? { organizationId_productId: { organizationId: draft.organizationId as string, productId } }
            : { userId_productId: { userId: draft.userId, productId } };
        const ownerFields =
          ownerKind === "organization"
            ? { organizationId: draft.organizationId, productId }
            : { userId: draft.userId, productId };
        await tx.productInventory.upsert({
          where,
          create: { ...ownerFields, currentQuantity: qty },
          update: { currentQuantity: { increment: qty } },
        });
      }

      // 품목별 InventoryRestock 생성 (LOT 단위 보존)
      let restockCount = 0;
      for (const it of restockable) {
        const inv = await tx.productInventory.findUnique({
          where:
            ownerKind === "organization"
              ? { organizationId_productId: { organizationId: draft.organizationId as string, productId: it.productId as string } }
              : { userId_productId: { userId: draft.userId, productId: it.productId as string } },
          select: { id: true },
        });
        if (!inv) continue;
        await tx.inventoryRestock.create({
          data: {
            inventoryId: inv.id,
            userId: draft.userId,
            orderId: draft.orderId,
            quantity: it.receivedQuantity as number,
            lotNumber: it.lotNumber ?? null,
            expiryDate: it.expiryDate ?? null,
            receivingStatus: "COMPLETED",
            notes: "§11.348-A 공급사 회신 입고(승인)",
          },
        });
        restockCount++;
      }

      // 발주 입고 확정(terminal — status 경로 재sync 차단) + PO 매칭
      await tx.order.update({
        where: { id: draft.orderId },
        data: { status: "DELIVERED", actualDelivery: new Date() },
      });

      // 입고안 승인 마감 + 이중입고 idempotent 가드
      await tx.receivingDraft.update({
        where: { id: draft.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          approvedById: userId,
          restockSyncedAt: new Date(),
        },
      });

      return { restockCount };
    });

    await createAuditLog({
      userId,
      organizationId: draft.organizationId ?? undefined,
      eventType: "INGESTION_RECEIVED", // 외부(공급사) 입력 수신·반영
      entityType: "ORDER",
      entityId: draft.orderId,
      action: "receiving_draft_approved",
      ...auditRequestMeta(request),
      metadata: {
        kind: "receiving_draft_approved",
        receivingDraftId: draft.id,
        orderId: draft.orderId,
        restockCount: result.restockCount,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      status: "APPROVED",
      restockCount: result.restockCount,
      message: "입고가 확정되어 재고에 반영되었습니다.",
    });
  } catch (error) {
    return handleApiError(error, "receiving-drafts/[id]/approve/POST");
  }
}
