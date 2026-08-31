import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";

/**
 * GET /api/receiving-drafts  (§11.348-A-4b · §receiving-list-redesign P4 확장)
 * 연구소 리뷰 대상 입고안 목록. 기본 status=PENDING_REVIEW(회신 도착, 검토 대기).
 * §receiving-list-redesign — 리스트 표면이 데모 그래프에서 canonical 로 전환되며 확장:
 *   · status: 콤마 구분 다중 허용 (예: AWAITING_REPLY,PENDING_REVIEW,APPROVED)
 *   · documents: order 단위 ReceivingDocument 동봉 (일괄 처리 모달 직행 + COA 확보 파생)
 *     — draft orderId 전체를 in 1쿼리로 조회(N+1 금지)
 *   · restockSyncedAt 동봉 (반영 완료 파생)
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
    const statusParam = searchParams.get("status") ?? "PENDING_REVIEW";

    // 사용자 소속 조직 id 수집 → 조직 스코프 + 본인 소유 OR 조건.
    const memberships = await db.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

    const validStatus = ["AWAITING_REPLY", "PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED"];
    // 콤마 구분 다중 status — 유효값만 채택, 전무하면 기존 기본값(하위 호환).
    const requested = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => validStatus.includes(s));
    const statuses = requested.length > 0 ? requested : ["PENDING_REVIEW"];

    const where: any = {
      status: statuses.length === 1 ? statuses[0] : { in: statuses },
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

    // 문서: order 단위(ReceivingDocument.orderId) — 전체 orderId 1쿼리 조회 후 매핑.
    const orderIds = [...new Set(drafts.map((d: any) => d.orderId).filter(Boolean))];
    const documents = orderIds.length
      ? await db.receivingDocument.findMany({
          where: { orderId: { in: orderIds as string[] } },
          select: { id: true, orderId: true, docType: true, fileName: true },
        })
      : [];
    const docsByOrder = new Map<string, { id: string; docType: string; fileName: string }[]>();
    for (const doc of documents as any[]) {
      const list = docsByOrder.get(doc.orderId) ?? [];
      list.push({ id: doc.id, docType: doc.docType, fileName: doc.fileName });
      docsByOrder.set(doc.orderId, list);
    }

    return NextResponse.json({
      drafts: drafts.map((d: any) => ({
        id: d.id,
        status: d.status,
        submittedAt: d.submittedAt,
        restockSyncedAt: d.restockSyncedAt,
        vendorNote: d.vendorNote,
        vendorName: d.vendor?.name ?? null,
        order: d.order ? { id: d.order.id, orderNumber: d.order.orderNumber, status: d.order.status } : null,
        documents: docsByOrder.get(d.orderId) ?? [],
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
          // §scan-recognition-upgrade P1 — "COA 인식" 배지 truth(canonical lot 출처).
          lotSource: it.lotSource,
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
