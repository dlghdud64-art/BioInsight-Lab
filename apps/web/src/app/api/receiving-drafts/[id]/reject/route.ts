import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";
import { z } from "zod";

/**
 * POST /api/receiving-drafts/:id/reject  (§11.348-A-4)
 *
 * 연구소 사람 반려 → 입고안 PENDING_REVIEW → REJECTED. 재고 mutation 0.
 * 공급사 재회신은 별도(반려 후 링크 재발송 — A 후속). 본 라우트는 상태 전이만.
 */
const RejectSchema = z.object({ reason: z.string().min(1).optional() });

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
      select: { id: true, status: true, userId: true, organizationId: true, orderId: true },
    });
    if (!draft) {
      return NextResponse.json({ error: "입고안을 찾을 수 없습니다." }, { status: 404 });
    }

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

    if (draft.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: "검토 대기 상태의 입고안만 반려할 수 있습니다.", status: draft.status },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = RejectSchema.safeParse(body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    await db.receivingDraft.update({
      where: { id: draft.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        approvedById: userId,
        rejectedReason: reason ?? null,
      },
    });

    await createAuditLog({
      userId,
      organizationId: draft.organizationId ?? undefined,
      eventType: "INGESTION_RECEIVED",
      entityType: "ORDER",
      entityId: draft.orderId,
      action: "receiving_draft_rejected",
      ...auditRequestMeta(request),
      metadata: { kind: "receiving_draft_rejected", receivingDraftId: draft.id, orderId: draft.orderId, reason: reason ?? null },
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: "REJECTED", message: "입고안이 반려되었습니다." });
  } catch (error) {
    return handleApiError(error, "receiving-drafts/[id]/reject/POST");
  }
}
