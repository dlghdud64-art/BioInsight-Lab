/**
 * Governance Event Dedupe — Server Persistence Layer
 *
 * 목적:
 *   governance event publisher 의 cross-session 중복 방지를
 *   sessionStorage 에서 Supabase 서버로 전환.
 *   30분 TTL 기반 dedupe 를 DB 수준에서 관리.
 *
 * 고정 규칙:
 *   1. canonical truth 를 변경하지 않는다 — 발행 여부 결정 logic 만 제공.
 *   2. dedupe 키는 (poNumber + eventType + signatureKey) 복합 unique.
 *   3. TTL 은 기본 30분. expiresAt 기준으로 만료 판단.
 *   4. Supabase 접근 불가 시 sessionStorage fallback 유지.
 */

import { db } from "@/lib/db";

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30분

/**
 * 이 (poNumber, eventType, signatureKey) 조합이 서버에서 이미 발행되었는지 확인.
 * 발행된 적 없거나 TTL 이 만료되었으면 true (발행 해도 됨).
 */
export async function shouldPublishServer(
  poNumber: string,
  eventType: string,
  signatureKey: string,
): Promise<boolean> {
  try {
    const existing = await db.governanceEventDedupe.findUnique({
      where: {
        poNumber_eventType_signatureKey: {
          poNumber,
          eventType,
          signatureKey,
        },
      },
    });

    if (!existing) return true;

    // TTL 만료 시 재발행 허용
    return new Date() > existing.expiresAt;
  } catch (e) {
    console.error("[governance-event-dedupe-server] shouldPublishServer 실패:", e);
    return true; // 실패 시 발행 허용 (best-effort)
  }
}

/**
 * 발행 완료 후 호출 — 해당 조합을 현재 시각으로 기록.
 * 이미 존재하면 upsert 로 갱신.
 */
export async function markPublishedServer(
  poNumber: string,
  eventType: string,
  signatureKey: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    await db.governanceEventDedupe.upsert({
      where: {
        poNumber_eventType_signatureKey: {
          poNumber,
          eventType,
          signatureKey,
        },
      },
      create: {
        poNumber,
        eventType,
        signatureKey,
        publishedAt: now,
        expiresAt,
      },
      update: {
        publishedAt: now,
        expiresAt,
      },
    });
  } catch (e) {
    console.error("[governance-event-dedupe-server] markPublishedServer 실패:", e);
  }
}

/**
 * 특정 PO 의 모든 dedupe 기록을 제거한다.
 * PO conversion reopen 같은 invalidation 이벤트에서 호출.
 */
export async function clearDedupeForPoServer(
  poNumber: string,
): Promise<void> {
  try {
    await db.governanceEventDedupe.deleteMany({
      where: { poNumber },
    });
  } catch (e) {
    console.error("[governance-event-dedupe-server] clearDedupeForPoServer 실패:", e);
  }
}

/**
 * 만료된 dedupe 레코드를 일괄 정리한다.
 * cron 또는 요청 시 호출 가능.
 */
export async function purgeExpiredDedupeRecords(): Promise<number> {
  try {
    const result = await db.governanceEventDedupe.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  } catch (e) {
    console.error("[governance-event-dedupe-server] purgeExpiredDedupeRecords 실패:", e);
    return 0;
  }
}
