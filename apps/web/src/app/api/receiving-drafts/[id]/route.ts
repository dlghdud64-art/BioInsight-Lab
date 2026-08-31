import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";

/**
 * GET /api/receiving-drafts/[id]  (§receiving-detail-redesign P1)
 *
 * 입고 상세 화면의 canonical 읽기. 상세 페이지가 데모 시드(useOpsStore)를 버리고
 * ReceivingDraft 를 직접 읽게 하는 유일한 진입 경로.
 *
 *   - scope: 목록 GET 과 동일 — 본인 소유 OR 사용자 소속 조직.
 *   - 조회만(mutation 0). 판정은 /inspect, 확정은 /approve, 문서는 /api/receiving/documents/[orderId].
 *   - documents 는 order 단위(ReceivingDocument.orderId)라 함께 내려준다 — 상세 문서 카드용.
 */
/* 🛑 `lib/db.ts` 가 any 라 map 콜백 파라미터가 implicit any 로 떨어진다(noImplicitAny).
 *    sentinel·vitest 는 못 잡고 **tsc 만 잡는다** — 로컬 row 타입 명시가 필수다.
 *    `Record<string, unknown>` 으로 넘기면 값이 unknown 이 돼 `.toISOString()` 이 깨진다. */
type DraftItemRow = {
  id: string;
  name: string | null;
  productId: string | null;
  expectedQuantity: number | null;
  receivedQuantity: number | null;
  inspectedQuantity: number | null;
  unit: string | null;
  lotNumber: string | null;
  expiryDate: Date | string | null;
  lotSource: string | null;
  decision: string | null;
  decidedAt: Date | string | null;
  discrepancyAction: string | null;
  discrepancyReason: string | null;
  restockedAt: Date | string | null;
};
type DraftDocRow = {
  id: string;
  docType: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  restockId: string | null;
  createdAt: Date;
  uploadedBy: { name: string | null } | null;
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;

    const draft = await db.receivingDraft.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        vendor: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true, status: true, createdAt: true } },
      },
    });
    if (!draft) {
      return NextResponse.json({ error: "입고안을 찾을 수 없습니다." }, { status: 404 });
    }

    // 접근 스코프 — 본인 소유 또는 소속 조직
    let allowed = draft.userId === userId;
    if (!allowed && draft.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId, organizationId: draft.organizationId },
        select: { id: true },
      });
      allowed = !!membership;
    }
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const documents = await db.receivingDocument.findMany({
      where: { orderId: draft.orderId },
      select: {
        id: true,
        docType: true,
        fileName: true,
        contentType: true,
        sizeBytes: true,
        restockId: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      draft: {
        id: draft.id,
        status: draft.status,
        submittedAt: draft.submittedAt,
        reviewedAt: draft.reviewedAt,
        restockSyncedAt: draft.restockSyncedAt,
        vendorNote: draft.vendorNote,
        rejectedReason: draft.rejectedReason,
        vendorName: draft.vendor?.name ?? null,
        order: draft.order
          ? {
              id: draft.order.id,
              orderNumber: draft.order.orderNumber,
              status: draft.order.status,
              createdAt: draft.order.createdAt,
            }
          : null,
        items: draft.items.map((it: DraftItemRow) => ({
          id: it.id,
          name: it.name,
          productId: it.productId,
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
        documents: documents.map((d: DraftDocRow) => ({
          id: d.id,
          docType: d.docType,
          fileName: d.fileName,
          contentType: d.contentType,
          sizeBytes: d.sizeBytes,
          restockId: d.restockId,
          uploadedAt: d.createdAt.toISOString(),
          uploadedBy: d.uploadedBy?.name ?? null,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error, "receiving-drafts/[id]/GET");
  }
}
