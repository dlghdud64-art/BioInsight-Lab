/**
 * POST /api/work-queue/compare-sync
 *
 * Idempotent reconciliation: scans user's undecided compare sessions and ensures
 * each has exactly one non-completed AiActionItem in the work queue.
 *
 * Handles:
 * - New sessions → create queue item
 * - Lifecycle changes → transition substatus via state machine
 * - Reopened sessions (UNDECIDED but COMPLETED queue item) → reactivate
 * - Stale items (active queue item for decided/deleted sessions) → complete
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createWorkItem, transitionWorkItem } from "@/lib/work-queue/work-queue-service";
import { handleApiError } from "@/lib/api-error-handler";
import { determineCompareSubstatus } from "@/lib/work-queue/compare-queue-semantics";

interface QueueItem {
  id: string;
  relatedEntityId: string | null;
  substatus: string | null;
  taskStatus: string;
}

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ synced: 0 });
    }

    // 1. Fetch undecided compare sessions (no take limit — process all)
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
    });

    if (compareSessions.length === 0) {
      // Stale cleanup: complete any active compare queue items with no matching session
      await cleanupStaleItems(userId);
      return NextResponse.json({ synced: 0 });
    }

    const sessionIds = compareSessions.map((s: { id: string }) => s.id);

    // 2. Fetch ALL existing queue items (including COMPLETED) for duplicate/reopen detection
    const existingItems = await db.aiActionItem.findMany({
      where: {
        relatedEntityType: "COMPARE_SESSION",
        relatedEntityId: { in: sessionIds },
      },
      select: {
        id: true,
        relatedEntityId: true,
        substatus: true,
        taskStatus: true,
      },
    });

    // Group by session: separate active vs completed
    const activeBySession = new Map<string, QueueItem>();
    const completedBySession = new Map<string, QueueItem>();
    for (const item of existingItems as QueueItem[]) {
      if (!item.relatedEntityId) continue;
      if (item.taskStatus === "COMPLETED") {
        // Keep the most recent completed item (last one wins since ordered by DB default)
        completedBySession.set(item.relatedEntityId, item);
      } else {
        activeBySession.set(item.relatedEntityId, item);
      }
    }

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
      const names = pids.map((id: string) => productNameMap.get(id) || "제품").slice(0, 2);
      const title = names.length >= 2
        ? `${names[0]} vs ${names[1]} 비교 판정`
        : "비교 세션 판정 대기";

      const quoteStatuses = quotesBySession.get(cs.id) || [];
      const targetSubstatus = determineCompareSubstatus({
        inquiryDrafts: cs.inquiryDrafts,
        linkedQuoteStatuses: quoteStatuses,
        isReopened: false,
      });

      // Extract verdict from diffResult
      const diffResult = cs.diffResult as Record<string, unknown>[] | null;
      const verdict = Array.isArray(diffResult) && (diffResult[0] as any)?.summary?.overallVerdict
        ? (diffResult[0] as any).summary.overallVerdict
        : null;

      const active = activeBySession.get(cs.id);
      const completed = completedBySession.get(cs.id);

      if (active) {
        // Active item exists — update substatus if changed
        if (active.substatus !== targetSubstatus) {
          await transitionWorkItem({
            itemId: active.id,
            substatus: targetSubstatus,
            userId,
          });
          synced++;
        }
      } else if (completed) {
        // Reopen: session is UNDECIDED but queue item was COMPLETED
        const reopenSubstatus = determineCompareSubstatus({
          inquiryDrafts: cs.inquiryDrafts,
          linkedQuoteStatuses: quoteStatuses,
          isReopened: true,
        });
        await transitionWorkItem({
          itemId: completed.id,
          substatus: reopenSubstatus,
          userId,
        });
        synced++;
      } else {
        // No item at all — create new
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
            inquiryCount: cs.inquiryDrafts.length,
            activeInquiryCount: cs.inquiryDrafts.filter((d: { status: string }) => d.status === "GENERATED" || d.status === "COPIED").length,
          },
          relatedEntityType: "COMPARE_SESSION",
          relatedEntityId: cs.id,
          priority: "MEDIUM",
        });
        synced++;
      }
    }

    // 5. Stale cleanup: active items for sessions not in undecided set
    await cleanupStaleItems(userId, new Set(sessionIds));

    return NextResponse.json({ synced });
  } catch (error) {
    return handleApiError(error, "POST /api/work-queue/compare-sync");
  }
}

/**
 * Stale item cleanup: find active compare queue items whose sessions are
 * no longer in the undecided set and transition them to compare_decided.
 */
async function cleanupStaleItems(userId: string, undecidedSessionIds?: Set<string>) {
  const staleItems = await db.aiActionItem.findMany({
    where: {
      userId,
      relatedEntityType: "COMPARE_SESSION",
      taskStatus: { notIn: ["COMPLETED", "FAILED"] },
      type: "COMPARE_DECISION",
    },
    select: { id: true, relatedEntityId: true },
  });

  for (const item of staleItems as { id: string; relatedEntityId: string | null }[]) {
    if (!item.relatedEntityId) continue;
    if (undecidedSessionIds && undecidedSessionIds.has(item.relatedEntityId)) continue;

    // This item's session is no longer undecided — complete it
    await transitionWorkItem({
      itemId: item.id,
      substatus: "compare_decided",
      userId,
    });
  }
}
