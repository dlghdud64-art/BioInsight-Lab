/**
 * §brief-realdata-quotes (호영님 2026-06-29) — 실 DB 견적 → 운영 브리핑 inbox(quote_response_pending 1종).
 *
 * honesty:
 *   - DB QuoteStatus.SENT(공급사 발송·응답 대기)만 매핑 → contract 'sent' → quote_response_pending.
 *   - RESPONDED("응답 완료")는 "응답 대기"로 표기하면 거짓 → 제외. draft/terminal 제외.
 *   - comparisons=[] → 비교 검토 아이템(QuoteComparison Prisma 모델 없음) 자연 미생성.
 *   - buildInboxFromQuotes 재사용 → due/priority/triage 로직 canonical(drift 0).
 *
 * server-only: db 사용. API 라우트(GET /api/operational-brief/inbox)에서만 import.
 */

import { db } from "@/lib/db";
import { QuoteStatus } from "@prisma/client";
import {
  buildInboxFromQuotes,
  type UnifiedInboxItem,
} from "@/lib/ops-console/inbox-adapter";
import type {
  QuoteRequestContract,
  QuoteResponseContract,
} from "@/lib/review-queue/quote-rfq-contract";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 사용자 본인 견적 중 SENT(응답 대기)만 운영 브리핑 inbox 아이템으로 변환.
 * @returns UnifiedInboxItem[] — quote_response_pending 만(LIVE 노출 = 1종).
 */
export async function buildRealQuoteInbox(userId: string): Promise<UnifiedInboxItem[]> {
  const quotes = await db.quote.findMany({
    where: { userId, status: QuoteStatus.SENT },
    select: {
      id: true,
      quoteNumber: true,
      title: true,
      validUntil: true,
      createdAt: true,
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

  for (const q of quotes) {
    const vendorIds = q.vendorRequests.map((vr: { id: string; expiresAt: Date }) => vr.id);

    // dueAt = 응답 마감(가장 이른 vendorRequest 만료) → 없으면 validUntil → 없으면 createdAt+7d.
    const expiryTimes = q.vendorRequests.map((vr: { id: string; expiresAt: Date }) => vr.expiresAt.getTime());
    const dueAt =
      expiryTimes.length > 0
        ? new Date(Math.min(...expiryTimes))
        : q.validUntil ?? new Date(q.createdAt.getTime() + SEVEN_DAYS_MS);

    reqs.push({
      id: q.id,
      workspaceId: q.organizationId ?? q.userId ?? "",
      requestNumber: q.quoteNumber ?? q.id.slice(-8).toUpperCase(),
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
        respondedVendors: q.responses.length,
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

  // comparisons=[] → 비교 검토 아이템 미생성(모델 없음). quote_response_pending 만 반환.
  return buildInboxFromQuotes(reqs, resps, []);
}
