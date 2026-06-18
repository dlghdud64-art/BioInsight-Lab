/**
 * §inbound-rfq-autocapture P1 — RFQ reply 주소 빌더 + 토큰 보장(공용)
 *
 * 공급사 견적회신 자동수신(PLAN_inbound-rfq-autocapture)의 발송측 루프 클로즈.
 *   - buildRfqReplyAddress: `rfq+<token>@inbound.<domain>` 단일 빌더(rfq-token route·발송 공용).
 *     fallback 도메인 = labaxis.co.kr(verified). 이전 inline 미verified placeholder 제거.
 *   - ensureRfqToken: quote당 1개 토큰 보장(없으면 생성). 발송 reply-to 임베드용.
 *     enabled=false면 호출측이 직접수신(요청자 이메일)로 폴백 — 자동수신 opt-out 보존.
 *
 * inbound parse(/api/inbound/sendgrid/[secret])가 rfq+<token> 를 파싱해 QuoteReply 생성.
 */

import { db } from "@/lib/db";
import crypto from "crypto";

/** inbound RFQ reply 주소. rfq-token route(GET/POST/PATCH)와 발송측이 공용으로 사용. */
export function buildRfqReplyAddress(token: string): string {
  const domain = process.env.NEXT_PUBLIC_DOMAIN || "labaxis.co.kr";
  return `rfq+${token}@inbound.${domain}`;
}

/** URL-safe 랜덤 토큰(32 bytes → base64url, 최대 48자). rfq-token route 와 동일 규칙. */
export function generateRfqToken(): string {
  return crypto.randomBytes(32).toString("base64url").substring(0, 48);
}

/**
 * quote당 RFQ 토큰 보장(find-or-create). 발송 시 reply-to 임베드용.
 * 반환 enabled=false 면 호출측이 자동수신 대신 요청자 직접수신으로 폴백.
 */
export async function ensureRfqToken(
  quoteId: string,
): Promise<{ token: string; enabled: boolean }> {
  const existing = await db.quoteRfqToken.findUnique({
    where: { quoteId },
    select: { token: true, enabled: true },
  });
  if (existing) return { token: existing.token, enabled: existing.enabled };

  const token = generateRfqToken();
  const created = await db.quoteRfqToken.create({
    data: { quoteId, token, enabled: true },
    select: { token: true, enabled: true },
  });
  return { token: created.token, enabled: created.enabled };
}
