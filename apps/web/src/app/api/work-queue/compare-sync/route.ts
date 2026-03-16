/**
 * POST /api/work-queue/compare-sync
 *
 * Scans user's undecided compare sessions and ensures each has
 * a corresponding AiActionItem in the work queue.
 * Also updates substatus based on downstream lifecycle (inquiry drafts, linked quotes).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createWorkItem } from "@/lib/work-queue/work-queue-service";
import { handleApiError } from "@/lib/api-error-handler";

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ synced: 0 });
    }

    // 1. Fetch undecided compare sessions
    const compareSessions = await db.compareSession.findMany({
      where: {
        userId,
        OR: [{ decisionState: null }, { decisionState: "UNDECIDED" }],
      },
      select: {
        id: true,
        productIds: true,
        createdAt: true,
        diffResult: true,
        inquiryDrafts: {
          select: { status: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    if (compareSessions.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    // 2. Fetch existing queue items for compare sessions
    const sessionIds = compareSessions.map((s: { id: string }) => s.id);
    const existingItems = await db.aiActionItem.findMany({
      where: {
        relatedEntityType: "COMPARE_SESSION",
        relatedEntityId: { in: sessionIds },
        taskStatus: { not: "COMPLETED" },
      },
      select: {
        id: true,
        relatedEntityId: true,
        substatus: true,
      },
    });

    const existingMap = new Map<string | null, { id: string; relatedEntityId: string | null; substatus: string | null }>(
      existingItems.map((item: { id: string; relatedEntityId: string | null; substatus: string | null }) => [item.relatedEntityId, item])
    );

    // 3. Fetch product names for titles
    const allProductIds = compareSessions.flatMap((s: { productIds: unknown }) =>
      Array.isArray(s.productIds) ? (s.productIds as string[]) : []
    );
    const uniqueProductIds = [...new Set(allProductIds)];
    const products = await db.product.findMany({
      where: { id: { in: uniqueProductIds } },
      select: { id: true, name: true },
    });
    const productNameMap = new Map(products.map((p: { id: string; name: string }) => [p.id, p.name]));

    // 4. Fetch linked quotes for lifecycle detection
    const linkedQuotes = await db.quote.findMany({
      where: { comparisonId: { in: sessionIds } },
      select: { comparisonId: true, status: true },
    });
    const quotesBySession = new Map<string, string[]>();
    for (const q of linkedQuotes) {
      if (!q.comparisonId) continue;
      const arr = quotesBySession.get(q.comparisonId) || [];
      arr.push(q.status);
      quotesBySession.set(q.comparisonId, arr);
    }

    let synced = 0;

    for (const cs of compareSessions) {
      const pids = Array.isArray(cs.productIds) ? (cs.productIds as string[]) : [];
      const names = pids.map((id) => productNameMap.get(id) || "제품").slice(0, 2);
      const title = names.length >= 2
        ? `${names[0]} vs ${names[1]} 비교 판정`
        : `비교 세션 판정 대기`;

      // Determine substatus based on lifecycle
      const draftStatuses = cs.inquiryDrafts.map((d: { status: string }) => d.status);
      const hasActiveInquiry = draftStatuses.some((s: string) => s === "GENERATED" || s === "COPIED");
      const quoteStatuses = quotesBySession.get(cs.id) || [];
      const hasActiveQuote = quoteStatuses.some((s) => s === "PENDING" || s === "SENT");

      let targetSubstatus = "compare_decision_pending";
      if (hasActiveQuote) {
        targetSubstatus = "compare_quote_in_progress";
      } else if (hasActiveInquiry) {
        targetSubstatus = "compare_inquiry_followup";
      }

      // Extract verdict from diffResult
      const diffResult = cs.diffResult as any;
      const verdict = Array.isArray(diffResult) && diffResult[0]?.summary?.overallVerdict
        ? diffResult[0].summary.overallVerdict
        : null;

      const existing = existingMap.get(cs.id);

      if (!existing) {
        // Create new queue item
        await createWorkItem({
          type: "COMPARE_DECISION",
          userId,
          title,
          summary: "비교 분석 완료 — 판정을 내려주세요",
          payload: {
            productIds: pids,
            productNames: names,
            verdict,
            sessionCreatedAt: cs.createdAt.toISOString(),
          },
          relatedEntityType: "COMPARE_SESSION",
          relatedEntityId: cs.id,
          priority: "MEDIUM",
        });
        synced++;
      } else if (existing.substatus !== targetSubstatus) {
        // Update substatus if lifecycle changed
        await db.aiActionItem.update({
          where: { id: existing.id },
          data: { substatus: targetSubstatus, updatedAt: new Date() },
        });
        synced++;
      }
    }

    return NextResponse.json({ synced });
  } catch (error) {
    return handleApiError(error, "POST /api/work-queue/compare-sync");
  }
}
