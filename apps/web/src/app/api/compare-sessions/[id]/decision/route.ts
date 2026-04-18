/**
 * PATCH /api/compare-sessions/[id]/decision — 비교 세션 판정 기록
 *
 * 판정 저장 + 큐 아이템 상태 동기화 (awaited).
 * 재개(reopen) 시 큐 아이템을 재활성화합니다.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createActivityLog } from "@/lib/activity-log";
import { handleApiError } from "@/lib/api-error-handler";
import { transitionWorkItem, createWorkItem } from "@/lib/work-queue/work-queue-service";
import { determineCompareSubstatus, determineResolutionPath } from "@/lib/work-queue/compare-queue-semantics";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

const VALID_DECISION_STATES = ["UNDECIDED", "APPROVED", "HELD", "REJECTED"] as const;
const TERMINAL_STATES = ["APPROVED", "HELD", "REJECTED"];

/**
 * Security: enforceAction (compare_decision)
 * - server-authoritative role check
 * - concurrency lock (동일 세션 동시 판정 차단)
 * - audit envelope 기록
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId,
      userRole: session?.user?.role ?? undefined,
      action: 'compare_decision',
      targetEntityType: 'compare_session',
      targetEntityId: id,
      sourceSurface: 'compare-decision-api',
      routePath: '/api/compare-sessions/[id]/decision',
    });

    if (!enforcement.allowed) {
      return enforcement.deny();
    }

    const body = await request.json();
    const { decisionState, decisionNote } = body;

    if (!decisionState || !VALID_DECISION_STATES.includes(decisionState)) {
      return NextResponse.json(
        { error: `decisionState는 ${VALID_DECISION_STATES.join(", ")} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    const existing = await db.compareSession.findUnique({
      where: { id },
      select: {
        decisionState: true,
        organizationId: true,
        productIds: true,
        inquiryDrafts: { select: { status: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "비교 세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const updated = await db.compareSession.update({
      where: { id },
      data: {
        decisionState,
        decisionNote: decisionNote ?? null,
        decidedBy: userId,
        decidedAt: new Date(),
      },
    });

    // 재개(reopen) 여부 판단: 터미널 상태 → UNDECIDED
    const isReopen =
      TERMINAL_STATES.includes(existing.decisionState ?? "") &&
      decisionState === "UNDECIDED";

    // ── Work Queue 상태 동기화 (awaited) ──

    if (TERMINAL_STATES.includes(decisionState)) {
      // 터미널 판정 → 큐 아이템 완료 + 해결 경로 기록
      const activeItem = await db.aiActionItem.findFirst({
        where: {
          relatedEntityType: "COMPARE_SESSION",
          relatedEntityId: id,
          taskStatus: { not: "COMPLETED" },
        },
        select: { id: true, payload: true },
      });

      if (activeItem) {
        const linkedQuotes = await db.quote.findMany({
          where: { comparisonId: id },
          select: { status: true },
        });
        const resolutionPath = determineResolutionPath({
          hasLinkedQuote: linkedQuotes.length > 0,
          hasInquiryDraft: existing.inquiryDrafts.length > 0,
          isReopened: false,
        });

        // resolutionPath를 payload에 저장 (완료 카드에서 표시용)
        await db.aiActionItem.update({
          where: { id: activeItem.id },
          data: {
            payload: {
              ...((activeItem.payload as Record<string, unknown>) ?? {}),
              resolutionPath,
              decisionState,
            },
          },
        });

        await transitionWorkItem({
          itemId: activeItem.id,
          substatus: "compare_decided",
          userId,
          metadata: { resolutionPath, decisionState },
        });
      }
    } else if (isReopen) {
      // 재개 → 완료된 큐 아이템 재활성화 또는 새 생성
      const completedItem = await db.aiActionItem.findFirst({
        where: {
          relatedEntityType: "COMPARE_SESSION",
          relatedEntityId: id,
          taskStatus: "COMPLETED",
        },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
      });

      // 연결된 견적/문의 상태에 따라 적절한 substatus 결정
      const linkedQuotes = await db.quote.findMany({
        where: { comparisonId: id },
        select: { status: true },
      });

      const targetSubstatus = determineCompareSubstatus({
        inquiryDrafts: existing.inquiryDrafts,
        linkedQuoteStatuses: linkedQuotes.map((q: { status: string }) => q.status),
        isReopened: true,
      });

      if (completedItem) {
        await transitionWorkItem({
          itemId: completedItem.id,
          substatus: targetSubstatus,
          userId,
        });
      } else {
        // 큐 아이템이 없으면 새로 생성
        const pids = Array.isArray(existing.productIds) ? (existing.productIds as string[]) : [];
        const products = await db.product.findMany({
          where: { id: { in: pids } },
          select: { id: true, name: true },
        });
        const nameMap = new Map(products.map((p: { id: string; name: string }) => [p.id, p.name]));
        const names = pids.map((pid: string) => nameMap.get(pid) || "제품").slice(0, 2);
        const title = names.length >= 2
          ? `${names[0]} vs ${names[1]} 비교 판정`
          : "비교 세션 판정 대기";

        await createWorkItem({
          type: "COMPARE_DECISION",
          userId,
          title,
          summary: "비교 판정이 재개되었습니다 — 재검토가 필요합니다",
          payload: { productIds: pids, productNames: names, isReopened: true },
          relatedEntityType: "COMPARE_SESSION",
          relatedEntityId: id,
          priority: "MEDIUM",
        });
      }
    }

    // ── Activity Log ──

    await createActivityLog({
      activityType: isReopen
        ? "COMPARE_SESSION_REOPENED"
        : TERMINAL_STATES.includes(decisionState)
          ? "AI_TASK_COMPLETED"
          : "QUOTE_STATUS_CHANGED",
      entityType: "COMPARE_SESSION",
      entityId: id,
      beforeStatus: existing.decisionState ?? null,
      afterStatus: decisionState,
      userId,
      organizationId: existing.organizationId,
      metadata: {
        decisionNote: decisionNote ?? null,
        isReopen,
      },
    });

    enforcement.complete({
      beforeState: { decisionState: existing.decisionState },
      afterState: { decisionState, isReopen },
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    enforcement?.fail();
    return handleApiError(error, "PATCH /api/compare-sessions/[id]/decision");
  }
}
