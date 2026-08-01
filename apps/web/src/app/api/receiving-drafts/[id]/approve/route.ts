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
    // §receiving-inspection-decision (T2) — 이중입고 방지 ①을 draft 단위 → 라인 단위로 축소.
    //   구: restockSyncedAt 있으면 전면 차단 → 부분 입고 후 잔여분 재확정이 불가능했다.
    //   신: 라인별 restockedAt 으로 판별(아래 restockable 필터). 가드 제거가 아니라 범위 조정.
    //   전 라인이 이미 반영됐으면 더 할 일이 없으므로 여기서 차단(기존 의도 보존).
    const alreadyAll =
      draft.items.length > 0 &&
      draft.items.every((it: { restockedAt: Date | null }) => it.restockedAt != null);
    if (alreadyAll) {
      return NextResponse.json(
        { error: "이미 전량 입고 확정된 입고안입니다.", code: "ALREADY_SYNCED" },
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

    // §receiving-inspection-decision (T2) — 반영 대상 = 합격(PASS) + 미반영 + 실측 수량 > 0.
    //   · decision !== "PASS" (불합격·미판정)은 재고 미반영 — 판정 없이 반영 금지.
    //   · restockedAt != null 은 이미 반영된 라인 → 재반영 0(이중 반영 가드).
    //   · 수량은 inspectedQuantity(검수 실측) 기준. 공급사 회신값(receivedQuantity)은 근거로만 보존.
    //   · 반품(RETURN)·재배송(RESHIP)분은 이번 입고에 들어오지 않았으므로 반영 대상이 아니다.
    type InspItem = {
      id: string;
      productId: string | null;
      inspectedQuantity: number | null;
      decision: string | null;
      discrepancyAction: string | null;
      restockedAt: Date | null;
      name: string;
      lotNumber: string | null;
      expiryDate: Date | null;
    };
    const allItems = draft.items as InspItem[];
    const undecided = allItems.filter((it) => it.decision == null);
    if (undecided.length > 0) {
      return NextResponse.json(
        {
          error: "판정하지 않은 품목이 있습니다. 전 품목 판정 후 확정할 수 있습니다.",
          code: "UNDECIDED_ITEMS",
          undecidedCount: undecided.length,
        },
        { status: 422 },
      );
    }
    const restockable = allItems.filter(
      (it) =>
        it.decision === "PASS" &&
        it.restockedAt == null &&
        it.productId &&
        (it.inspectedQuantity ?? 0) > 0 &&
        it.discrepancyAction !== "RETURN" &&
        it.discrepancyAction !== "RESHIP",
    );
    if (restockable.length === 0) {
      return NextResponse.json(
        { error: "입고할 품목이 없습니다. (합격 판정·제품 매핑·실측 수량 확인 필요)", code: "NO_RESTOCKABLE_ITEMS" },
        { status: 422 },
      );
    }

    const ownerKind: "organization" | "user" = draft.organizationId ? "organization" : "user";

    const result = await db.$transaction(async (tx: any) => {
      // productId 별 실수량 합산 → ProductInventory upsert(증분)
      const aggregated = new Map<string, number>();
      for (const it of restockable) {
        aggregated.set(it.productId as string, (aggregated.get(it.productId as string) ?? 0) + (it.inspectedQuantity as number));
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

      // 품목별 InventoryRestock 생성 (LOT 단위 보존) + 현장 라벨용 항목 수집(A-5)
      const restockedItems: Array<{ inventoryId: string; name: string; lotNumber: string | null; expiryDate: Date | null }> = [];
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
            quantity: it.inspectedQuantity as number,
            lotNumber: it.lotNumber ?? null,
            expiryDate: it.expiryDate ?? null,
            receivingStatus: "COMPLETED",
            notes: "§11.348-A 공급사 회신 입고(승인)",
          },
        });
        // §T2 — 라인 단위 반영 표시(이중 반영 가드의 근거). 이 시각 이후 해당 라인은 재반영·수정 불가.
        await tx.receivingDraftItem.update({
          where: { id: it.id },
          data: { restockedAt: new Date() },
        });
        restockedItems.push({ inventoryId: inv.id, name: it.name, lotNumber: it.lotNumber ?? null, expiryDate: it.expiryDate ?? null });
      }

      // §receiving-inspection-decision (T2) — 부분 입고 분기.
      //   전량 처리 완료 = 모든 라인이 (이번에 반영됐거나 이미 반영됐거나) 재배송·반품으로 종결.
      //   부분 입고(RESHIP 잔여 대기)면 발주는 SHIPPING 유지 — DELIVERED 로 찍으면 허위 표기가 된다.
      //   (OrderStatus 에 PARTIAL 이 없어 enum 확장은 별건으로 분리 — PLAN §0 결정 2)
      const restockedIds = new Set(restockable.map((it) => it.id));
      const pendingLines = allItems.filter(
        (it) =>
          !restockedIds.has(it.id) &&
          it.restockedAt == null &&
          it.discrepancyAction === "RESHIP", // 부족분 재배송 대기 = 아직 안 들어온 물량
      );
      const isFullyReceived = pendingLines.length === 0;

      if (isFullyReceived) {
        // 발주 입고 확정(terminal — status 경로 재sync 차단) + PO 매칭
        await tx.order.update({
          where: { id: draft.orderId },
          data: { status: "DELIVERED", actualDelivery: new Date() },
        });
        await tx.receivingDraft.update({
          where: { id: draft.id },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            approvedById: userId,
            restockSyncedAt: new Date(),
          },
        });
      } else {
        // 부분 입고 — 발주는 배송 중 유지, 입고안은 검토 대기로 남겨 잔여 재확정을 허용.
        //   (라인 단위 restockedAt 가드가 이미 반영된 분의 재반영을 막는다)
        await tx.receivingDraft.update({
          where: { id: draft.id },
          data: { reviewedAt: new Date(), approvedById: userId },
        });
      }

      return {
        restockCount: restockedItems.length,
        restockedItems,
        partial: !isFullyReceived,
        pendingCount: pendingLines.length,
      };
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
      // §11.348-A-5 — 현장 QR 라벨 출력용. inventoryId 를 QR 로 인코딩 → 스캔→차감(§11.355).
      restockedItems: result.restockedItems.map((r: any) => ({
        id: r.inventoryId,
        name: r.name,
        lotNumber: r.lotNumber,
        expiryDate: r.expiryDate ? r.expiryDate.toISOString().split("T")[0] : null,
      })),
      message: "입고가 확정되어 재고에 반영되었습니다.",
    });
  } catch (error) {
    return handleApiError(error, "receiving-drafts/[id]/approve/POST");
  }
}