import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";

/**
 * GET /api/receiving-drafts  (§11.348-A-4b)
 * 연구소 리뷰 대상 입고안 목록. 기본 status=PENDING_REVIEW(회신 도착, 검토 대기).
 * scope: 사용자 소속 조직(들) + 본인 소유. canonical 조회만(mutation 0).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "PENDING_REVIEW";

    // 사용자 소속 조직 id 수집 → 조직 스코프 + 본인 소유 OR 조건.
    const memberships = await db.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

    const validStatus = ["AWAITING_REPLY", "PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED"];
    const where: any = {
      ...(validStatus.includes(status) ? { status } : { status: "PENDING_REVIEW" }),
      OR: [{ userId }, ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : [])],
    };

    const drafts = await db.receivingDraft.findMany({
      where,
      include: {
        items: true,
        vendor: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      drafts: drafts.map((d: any) => ({
        id: d.id,
        status: d.status,
        submittedAt: d.submittedAt,
        vendorNote: d.vendorNote,
        vendorName: d.vendor?.name ?? null,
        order: d.order ? { id: d.order.id, orderNumber: d.order.orderNumber, status: d.order.status } : null,
        items: d.items.map((it: any) => ({
          id: it.id,
          name: it.name,
          productId: it.productId,
          // §receiving-inspection-decision (T2) — 검수 표에 필요한 계약 확장.
          //   expectedQuantity(발주) ↔ inspectedQuantity(실측) 대조로 불일치를 파생한다.
          //   receivedQuantity(공급사 회신)는 근거로 함께 노출(덮어쓰지 않음).
          expectedQuantity: it.expectedQuantity,
          receivedQuantity: it.receivedQuantity,
          inspectedQuantity: it.inspectedQuantity,
          unit: it.unit,
          lotNumber: it.lotNumber,
          expiryDate: it.expiryDate,
          decision: it.decision,
          decidedAt: it.decidedAt,
          discrepancyAction: it.discrepancyAction,
          discrepancyReason: it.discrepancyReason,
          restockedAt: it.restockedAt,
        })),
      })),
      total: drafts.length,
    });
  } catch (error) {
    return handleApiError(error, "receiving-drafts/GET");
  }
}
