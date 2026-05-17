/**
 * §11.250e #quote-expired-notification-dispatch — P1 두번째 cluster (QUOTE_EXPIRED).
 *
 * 호영님 spec: Quote.validUntil < now 인 quote 매일 cron check → dispatch + push.
 *   QuoteStatus EXPIRED 신규 0 — notification only scope.
 *   중복 방지 = NotificationEvent.findFirst (같은 quote 에 QUOTE_EXPIRED 이미 발송됐는지).
 *
 * 설계 원칙:
 *   - 운영자 의도 정합 — status 자동 변경 0 (사용자 수동 CANCELLED 또는 후속 cluster).
 *   - PENDING/SENT/RESPONDED 상태 quote 만 알림 (COMPLETED/PURCHASED/CANCELLED 제외).
 *   - validUntil null quote 는 만료 개념 없음 — skip.
 *   - graceful try/catch — cron 정합 보호.
 *
 * §11.229b-5/-6 + §11.250a/cd/b/g 패턴 정확 reuse (dispatch + push 1:1).
 */

import { db } from "@/lib/db";
import { dispatchNotificationEvent } from "@/lib/notifications/event-dispatcher";
import { sendPushNotification } from "@/lib/notifications/push-sender";

const DETECTION_BATCH_SIZE = 100;

export interface ExpiredQuoteCandidate {
  id: string;
  title: string;
  userId: string;
  validUntil: Date;
  status: string;
  organizationId: string | null;
}

export interface ExpiredQuoteResult {
  candidates: ExpiredQuoteCandidate[];
  notified: number;
  skippedDuplicate: number;
  errors: string[];
}

/**
 * Quote.validUntil < now + status PENDING/SENT/RESPONDED + userId 존재.
 * NotificationEvent.findFirst 으로 중복 차단 (같은 quote 가 매일 알림 폭격 받지 않음).
 *
 * organizationId 인자 — 향후 org-scoped cron 분기용. null 은 전체 스캔.
 */
export async function detectExpiredQuotes(
  organizationId?: string | null,
): Promise<ExpiredQuoteResult> {
  const result: ExpiredQuoteResult = {
    candidates: [],
    notified: 0,
    skippedDuplicate: 0,
    errors: [],
  };

  const now = new Date();

  try {
    const quotes = await db.quote.findMany({
      where: {
        validUntil: { lt: now },
        status: { in: ["PENDING", "SENT", "RESPONDED"] },
        userId: { not: null },
        ...(organizationId ? { organizationId } : {}),
      },
      take: DETECTION_BATCH_SIZE,
      select: {
        id: true,
        title: true,
        userId: true,
        validUntil: true,
        status: true,
        organizationId: true,
      },
      orderBy: { validUntil: "asc" },
    });

    const candidates: ExpiredQuoteCandidate[] = quotes
      .filter((q: typeof quotes[number]) => q.userId !== null && q.validUntil !== null)
      .map((q: typeof quotes[number]) => ({
        id: q.id,
        title: q.title,
        userId: q.userId as string,
        validUntil: q.validUntil as Date,
        status: q.status,
        organizationId: q.organizationId,
      }));

    result.candidates = candidates;

    for (const candidate of candidates) {
      try {
        // §11.250e — 중복 방지: 같은 quote 에 QUOTE_EXPIRED 이미 발송 시 skip.
        const existingEvent = await db.notificationEvent.findFirst({
          where: {
            eventType: "QUOTE_EXPIRED",
            entityType: "QUOTE",
            entityId: candidate.id,
          },
          select: { id: true },
        });

        if (existingEvent) {
          result.skippedDuplicate++;
          continue;
        }

        if (!candidate.userId) continue;

        // inApp dispatch
        try {
          await dispatchNotificationEvent({
            eventType: "QUOTE_EXPIRED",
            entityType: "QUOTE",
            entityId: candidate.id,
            triggeredBy: undefined,
            recipients: [{ userId: candidate.userId }],
            metadata: {
              quoteTitle: candidate.title,
              validUntil: candidate.validUntil.toISOString(),
              status: candidate.status,
            },
          });
        } catch (notifErr) {
          // graceful — cron 정합 유지
          console.error("[quote-expiry-detector] QUOTE_EXPIRED notification 발송 실패:", notifErr);
        }

        // Expo OS-level push
        try {
          await sendPushNotification(candidate.userId, {
            title: "견적 만료 알림",
            body: `${candidate.title} — 유효기간 경과 (${candidate.validUntil.toLocaleDateString("ko-KR")})`,
            data: {
              type: "quote",
              id: candidate.id,
              quoteTitle: candidate.title,
            },
          }, "QUOTE_EXPIRED");
        } catch (pushErr) {
          // graceful — cron 정합 유지
          console.error("[quote-expiry-detector] QUOTE_EXPIRED push notification 실패:", pushErr);
        }

        result.notified++;
      } catch (err) {
        result.errors.push(`Quote ${candidate.id}: ${String(err)}`);
      }
    }
  } catch (err) {
    result.errors.push(`Detection failed: ${String(err)}`);
  }

  return result;
}
