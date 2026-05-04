/**
 * apps/web/src/app/api/work-queue/purchase-conversion/route.ts
 *
 * #P02 Phase B-α step α-B (PLAN_phase-b-alpha-purchase-conversion.md).
 * Server-side composer endpoint for the /dashboard/purchases conversion
 * queue. Joins Quote + replies + vendors + vendorRequests + order +
 * AiActionItem in two batched Prisma queries, then runs each row through
 * the deterministic resolver from α-A.
 *
 * Response shape (matches /api/quotes/my style):
 *   {
 *     success: true,
 *     data: {
 *       items: PurchaseConversionItem[],
 *       stats: { total, review_required, ready_for_po, hold, confirmed, expired }
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  resolvePurchaseConversion,
  type PurchaseConversionInput,
  type PurchaseConversionItem,
} from "@/lib/ontology/purchase-conversion-resolver";

export const dynamic = "force-dynamic";

interface ConversionStats {
  total: number;
  review_required: number;
  ready_for_po: number;
  hold: number;
  confirmed: number;
  expired: number;
}

const EMPTY_STATS: ConversionStats = {
  total: 0,
  review_required: 0,
  ready_for_po: 0,
  hold: 0,
  confirmed: 0,
  expired: 0,
};

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const now = new Date();

    // Single batched Quote query — pull only the fields the resolver reads.
    // Same userId + quoteNumber!=null scope as /api/quotes/my (Phase B-β)
    // so the same set of quotes appears in both surfaces.
    const quotes = await db.quote.findMany({
      where: { userId, quoteNumber: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        totalAmount: true,
        currency: true,
        quoteNumber: true,
        validUntil: true,
        createdAt: true,
        selectedReplyId: true, // α-D, ADR §11.21
        vendors: {
          select: { id: true, vendorName: true, email: true },
        },
        vendorRequests: {
          select: {
            id: true,
            vendorName: true,
            vendorEmail: true,
            status: true,
            respondedAt: true,
          },
        },
        replies: {
          select: { id: true, vendorName: true, fromEmail: true, receivedAt: true },
        },
        order: {
          select: { id: true, orderNumber: true, status: true },
        },
      },
    });

    // §11.209b Phase 3 + §11.209c Phase 2 — user 의 workspace.plan +
    // stripePriceId 둘 다 노출 (page 의 헤더 카피 Tier 분기 + R&D
    // Operations SKU 분기 위해). billing/checkout 의 workspaceMember
    // .findFirst 패턴 정합.
    const workspaceMember = await db.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: { select: { plan: true, stripePriceId: true } } },
    });
    const workspacePlan = workspaceMember?.workspace?.plan ?? null;
    const workspaceStripePriceId = workspaceMember?.workspace?.stripePriceId ?? null;

    if (quotes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { items: [], stats: { ...EMPTY_STATS }, workspacePlan, workspaceStripePriceId },
      });
    }

    // Second batched query — AI actions related to these quotes
    const quoteIds = quotes.map((q: { id: string }) => q.id);
    const aiActions = await db.aiActionItem.findMany({
      where: {
        userId,
        relatedEntityType: "QUOTE",
        relatedEntityId: { in: quoteIds },
      },
      select: {
        id: true,
        type: true,
        status: true,
        taskStatus: true,
        relatedEntityId: true,
        // α-F (ADR §11.25): RATIONALE_SUMMARY rows carry the option
        // link in payload and the LLM rationale in result. Resolver
        // reads these in buildAiOptions.
        payload: true,
        result: true,
      },
    });

    // O(1) lookup table. α-F: payload + result added so resolver can
    // read RATIONALE_SUMMARY rows.
    const aiActionsByQuote = new Map<
      string,
      Array<{
        id: string;
        type: string;
        status: string;
        taskStatus: string;
        payload?: Record<string, unknown> | null;
        result?: Record<string, unknown> | null;
      }>
    >();
    for (const action of aiActions) {
      const qid = action.relatedEntityId;
      if (!qid) continue;
      const list = aiActionsByQuote.get(qid) ?? [];
      list.push({
        id: action.id,
        type: action.type,
        status: action.status,
        taskStatus: action.taskStatus,
        payload: (action.payload as Record<string, unknown> | null | undefined) ?? null,
        result: (action.result as Record<string, unknown> | null | undefined) ?? null,
      });
      aiActionsByQuote.set(qid, list);
    }

    // §11.209d — Third batched query: PurchaseRequest by quoteId.
    // Quote ↔ PurchaseRequest schema 역관계 0 → 별도 batched query.
    // resolver 가 internalApprovalStatus derive (latest by createdAt).
    // §11.209d-history — approver { name } + rejectedReason.
    // §11.209d-contact — approver { email, phone } 추가 (timeline contact row).
    const purchaseRequests = await db.purchaseRequest.findMany({
      where: { quoteId: { in: quoteIds } },
      select: {
        id: true,
        quoteId: true,
        status: true,
        approverId: true,
        approver: { select: { name: true, email: true, phone: true } },
        approvedAt: true,
        rejectedAt: true,
        rejectedReason: true,
        createdAt: true,
      },
    });

    // O(1) lookup table — quote 별 PurchaseRequest 목록.
    const purchaseRequestsByQuote = new Map<
      string,
      Array<{
        id: string;
        status: string;
        approverId: string | null;
        approverName: string | null;
        approverEmail: string | null;
        approverPhone: string | null;
        approvedAt: Date | null;
        rejectedAt: Date | null;
        rejectedReason: string | null;
        createdAt: Date;
      }>
    >();
    for (const pr of purchaseRequests) {
      const qid = pr.quoteId;
      if (!qid) continue;
      const list = purchaseRequestsByQuote.get(qid) ?? [];
      list.push({
        id: pr.id,
        status: pr.status,
        approverId: pr.approverId,
        approverName: pr.approver?.name ?? null,
        approverEmail: pr.approver?.email ?? null,
        approverPhone: pr.approver?.phone ?? null,
        approvedAt: pr.approvedAt,
        rejectedAt: pr.rejectedAt,
        rejectedReason: pr.rejectedReason,
        createdAt: pr.createdAt,
      });
      purchaseRequestsByQuote.set(qid, list);
    }

    const items: PurchaseConversionItem[] = quotes.map((q: any) => {
      const input: PurchaseConversionInput = {
        quote: {
          id: q.id,
          title: q.title,
          description: q.description,
          status: q.status,
          totalAmount: q.totalAmount,
          currency: q.currency,
          quoteNumber: q.quoteNumber,
          validUntil: q.validUntil,
          createdAt: q.createdAt,
          selectedReplyId: q.selectedReplyId ?? null, // α-D, ADR §11.21
        },
        vendors: q.vendors,
        vendorRequests: q.vendorRequests,
        replies: q.replies,
        order: q.order,
        aiActions: aiActionsByQuote.get(q.id) ?? [],
        // §11.209d — quote 별 PurchaseRequest 목록 forward (latest by
        // createdAt 기준 internalApprovalStatus derive).
        purchaseRequests: purchaseRequestsByQuote.get(q.id) ?? [],
        now,
      };
      return resolvePurchaseConversion(input);
    });

    const stats: ConversionStats = items.reduce<ConversionStats>(
      (acc, item) => {
        acc.total += 1;
        acc[item.conversionStatus] += 1;
        if (item.isExpired) acc.expired += 1;
        return acc;
      },
      { ...EMPTY_STATS },
    );

    return NextResponse.json({ success: true, data: { items, stats, workspacePlan, workspaceStripePriceId } });
  } catch (error) {
    // Don't leak DB error details — log + generic 500
    console.error("[purchase-conversion] Query failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "구매 전환 큐 조회 중 오류가 발생했습니다.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
