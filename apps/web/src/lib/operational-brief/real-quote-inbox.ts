/**
 * §brief-realdata-quotes (호영님 2026-06-29) — 실 DB 견적 → 운영 브리핑 inbox.
 *   §brief-realdata-responded — RESPONDED(응답 도착) 아이템 추가(호영님 ③).
 *
 * honesty:
 *   - SENT(공급사 발송·응답 대기) → contract 'sent' → buildInboxFromQuotes(…, []) → quote_response_pending.
 *   - RESPONDED(응답 도착·완료 대기) → quote_review_required 직접 emit("응답 도착 — 검토 후 완료/취소").
 *       canonical helper(resolveDueState / calculateInboxPriority / calculateTriageGroup) 재사용 → drift 0.
 *   - draft(PENDING/PARSED)·terminal(COMPLETED/PURCHASED/CANCELLED) 제외.
 *   - comparisons=[] → 비교 검토 아이템(QuoteComparison Prisma 모델 없음) 미생성. 가짜 카드 0.
 *
 * server-only: db 사용. GET /api/operational-brief/inbox 에서만 import.
 */

import { db } from "@/lib/db";
import { QuoteStatus } from "@prisma/client";
import {
  buildInboxFromQuotes,
  resolveDueState,
  calculateInboxPriority,
  calculateTriageGroup,
  sortInboxItems,
  type UnifiedInboxItem,
} from "@/lib/ops-console/inbox-adapter";
import type {
  QuoteRequestContract,
  QuoteResponseContract,
} from "@/lib/review-queue/quote-rfq-contract";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type VendorRequestLite = { id: string; expiresAt: Date };

/** 응답 마감 = 가장 이른 vendorRequest 만료 → 없으면 validUntil → 없으면 createdAt+7d. */
function deriveDueAt(
  vendorRequests: VendorRequestLite[],
  validUntil: Date | null,
  createdAt: Date,
): Date {
  const expiryTimes = vendorRequests.map((vr) => vr.expiresAt.getTime());
  if (expiryTimes.length > 0) return new Date(Math.min(...expiryTimes));
  return validUntil ?? new Date(createdAt.getTime() + SEVEN_DAYS_MS);
}

/**
 * 본인 견적 + 소속 조직 견적(SENT·RESPONDED)을 운영 브리핑 inbox 아이템으로 변환.
 * §brief-realdata-orgscope — 스코프 = owner(userId) OR 조직 멤버십(organizationMember).
 *   detail/PATCH 권한(isOwner || isTeamMember)과 100% 정합 → 보여준 카드는 모두 통보 가능(dead button 0).
 * @returns UnifiedInboxItem[] — SENT=quote_response_pending / RESPONDED=quote_review_required.
 */
export async function buildRealQuoteInbox(userId: string): Promise<UnifiedInboxItem[]> {
  // 사용자가 속한 조직 목록(권한 = detail/PATCH의 isTeamMember 기준과 동일).
  const memberships = await db.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

  const quotes = await db.quote.findMany({
    where: {
      status: { in: [QuoteStatus.SENT, QuoteStatus.RESPONDED] },
      OR: [
        { userId },
        ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
      ],
    },
    select: {
      id: true,
      quoteNumber: true,
      title: true,
      status: true,
      validUntil: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      organizationId: true,
      items: { select: { id: true } },
      responses: { select: { id: true, vendorId: true } },
      vendorRequests: { select: { id: true, expiresAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const reqs: QuoteRequestContract[] = [];
  const resps: QuoteResponseContract[] = [];
  const respondedItems: UnifiedInboxItem[] = [];

  for (const q of quotes) {
    const vendorIds = q.vendorRequests.map((vr: VendorRequestLite) => vr.id);
    const dueAt = deriveDueAt(q.vendorRequests, q.validUntil, q.createdAt);
    const requestNumber = q.quoteNumber ?? q.id.slice(-8).toUpperCase();
    const respondedCount = q.responses.length;

    if (q.status === QuoteStatus.RESPONDED) {
      // §brief-realdata-responded — 응답 도착·완료 대기. quote_review_required 직접 emit.
      //   canonical due/priority/triage 재사용. 비교(comparison) 없이 상태 기반.
      const dueState = resolveDueState(dueAt.toISOString());
      const item: UnifiedInboxItem = {
        id: `inbox-qr-responded-${q.id}`,
        workType: "quote_review_required",
        entityId: q.id,
        entityRoute: `/dashboard/quotes/${q.id}`,
        title: `${requestNumber} 응답 도착`,
        summary: `${respondedCount}/${vendorIds.length} 응답 — 검토 후 완료 또는 취소`,
        priority: "p1",
        owner: undefined,
        dueState,
        nextAction: "공급사 응답 검토 후 완료/취소 통보",
        sourceModule: "quote",
        riskBadges: dueState.tone === "due_soon" ? ["마감 임박"] : [],
        updatedAt: (q.updatedAt ?? q.createdAt).toISOString(),
        triageGroup: "needs_review",
      };
      item.priority = calculateInboxPriority(item);
      item.triageGroup = calculateTriageGroup(item);
      respondedItems.push(item);
      continue;
    }

    // SENT — 공급사 응답 대기. buildInboxFromQuotes(…, []) 경유(quote_response_pending).
    reqs.push({
      id: q.id,
      workspaceId: q.organizationId ?? q.userId ?? "",
      requestNumber,
      title: q.title,
      status: "sent",
      sourceType: "manual",
      createdAt: q.createdAt.toISOString(),
      createdBy: q.userId ?? "",
      dueAt: dueAt.toISOString(),
      priority: "normal",
      currency: "KRW",
      shippingRegion: "",
      requesterTeam: "",
      vendorIds,
      items: [],
      summary: {
        totalItems: q.items.length,
        totalVendors: vendorIds.length,
        respondedVendors: respondedCount,
      },
    });

    for (const r of q.responses) {
      resps.push({
        id: r.id,
        quoteRequestId: q.id,
        vendorId: r.vendorId,
        responseStatus: "responded",
        currency: "KRW",
        responseItems: [],
      });
    }
  }

  // comparisons=[] → 비교 검토 아이템 미생성. SENT(response_pending) + RESPONDED(응답 도착) 병합·정렬.
  const pendingItems = buildInboxFromQuotes(reqs, resps, []);
  return sortInboxItems([...pendingItems, ...respondedItems]);
}
