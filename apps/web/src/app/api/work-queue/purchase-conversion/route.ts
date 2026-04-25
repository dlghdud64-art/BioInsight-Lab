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

    if (quotes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { items: [], stats: { ...EMPTY_STATS } },
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
      },
    });

    // O(1) lookup table
    const aiActionsByQuote = new Map<
      string,
      Array<{ id: string; type: string; status: string; taskStatus: string }>
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
      });
      aiActionsByQuote.set(qid, list);
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
        },
        vendors: q.vendors,
        vendorRequests: q.vendorRequests,
        replies: q.replies,
        order: q.order,
        aiActions: aiActionsByQuote.get(q.id) ?? [],
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

    return NextResponse.json({ success: true, data: { items, stats } });
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
