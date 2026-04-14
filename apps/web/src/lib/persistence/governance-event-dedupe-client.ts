/**
 * Governance Event Dedupe — Client Persistence Bridge
 *
 * sessionStorage 즉시 + 서버 비동기 이중 레이어.
 * 동일 governance event 가 탭 재진입/remount 시 중복 발행되지 않도록
 * sessionStorage 로 즉시 판단하고, 서버에 비동기로 동기화한다.
 *
 * 패턴: outbound-history-client.ts / approval-baseline-client.ts 와 동일한
 *       write-through + server-first read.
 *
 * 고정 규칙:
 *   1. canonical truth 를 변경하지 않는다 — 발행 여부 결정 logic 만 제공.
 *   2. shouldPublish 는 sessionStorage 로 즉시 판단 (동기).
 *      서버 check 는 background 로 수행하며 결과를 session 에 반영.
 *   3. markPublished 는 sessionStorage 즉시 + 서버 비동기.
 *   4. clearDedupeForPo 는 양쪽 모두 삭제.
 *   5. 서버 장애 시 sessionStorage fallback 자동.
 */

const API_BASE = "/api/governance/event-dedupe";

// ══════════════════════════════════════════════
// Internal: PersistenceAdapter 경유 (SSR-safe)
// 비즈니스 로직은 sessionStorage 를 직접 호출하지 않는다.
// ══════════════════════════════════════════════

import {
  getDedupeSignatureAdapter,
  clearAdapterByPrefix,
} from "@/lib/persistence/persistence-adapter";

function compositeKey(entityKey: string, eventType: string): string {
  return `${entityKey}::${eventType}`;
}

function shouldPublishLocal(
  entityKey: string,
  eventType: string,
  signature: string,
): boolean {
  const adapter = getDedupeSignatureAdapter();
  const existing = adapter.load(compositeKey(entityKey, eventType));
  return existing !== signature;
}

function markPublishedLocal(
  entityKey: string,
  eventType: string,
  signature: string,
): void {
  const adapter = getDedupeSignatureAdapter();
  adapter.persist(compositeKey(entityKey, eventType), signature);
}

function clearDedupeForPoLocal(entityKey: string): void {
  const adapter = getDedupeSignatureAdapter();
  // SessionStorageAdapter 면 prefix delete, 다른 adapter 면 no-op (DB 측에서 처리).
  clearAdapterByPrefix(adapter, `${entityKey}::`);
}

// ══════════════════════════════════════════════
// Public: write-through + server bridge
// ══════════════════════════════════════════════

/**
 * 이 event 를 발행해야 하는지 확인한다.
 * sessionStorage 로 즉시 판단 (동기 반환).
 * 서버 상태 확인이 필요하면 shouldPublishWithServerAsync 사용.
 */
export function shouldPublishWithServer(
  entityKey: string,
  eventType: string,
  signature: string,
): boolean {
  return shouldPublishLocal(entityKey, eventType, signature);
}

/**
 * 서버에서 dedupe 상태를 확인한다.
 * server-first → sessionStorage fallback.
 * background hydration 또는 중요한 판단에 사용.
 */
export async function shouldPublishWithServerAsync(
  entityKey: string,
  eventType: string,
  signature: string,
): Promise<boolean> {
  // 1. 서버에서 먼저 시도
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "check",
        poNumber: entityKey,
        eventType,
        signatureKey: signature,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.canPublish === "boolean") {
        // 서버 결과를 session에 반영
        if (!data.canPublish) {
          markPublishedLocal(entityKey, eventType, signature);
        }
        return data.canPublish;
      }
    }
  } catch (e) {
    console.warn("[governance-event-dedupe-client] 서버 check 실패, sessionStorage fallback:", e);
  }

  // 2. 서버 실패 시 sessionStorage fallback
  return shouldPublishLocal(entityKey, eventType, signature);
}

/**
 * event 발행 완료를 기록한다.
 * sessionStorage 즉시(동기) + 서버 비동기 기록.
 */
export function markPublishedWithServer(
  entityKey: string,
  eventType: string,
  signature: string,
): void {
  // 1. sessionStorage 즉시 기록 (동기)
  markPublishedLocal(entityKey, eventType, signature);

  // 2. 서버에 비동기 기록
  void (async () => {
    try {
      await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark",
          poNumber: entityKey,
          eventType,
          signatureKey: signature,
        }),
      });
    } catch (e) {
      console.warn("[governance-event-dedupe-client] 서버 mark 실패, sessionStorage fallback:", e);
    }
  })();
}

/**
 * reopen / invalidation 시 해당 PO의 모든 dedupe 기록을 clear한다.
 * sessionStorage + 서버 양쪽 모두 삭제.
 * 이후 재계산된 governance event가 다시 발행될 수 있게 한다.
 */
export function clearDedupeForPoWithServer(entityKey: string): void {
  // 1. sessionStorage 즉시 clear (동기)
  clearDedupeForPoLocal(entityKey);

  // 2. 서버 비동기 clear
  void (async () => {
    try {
      await fetch(`${API_BASE}?poNumber=${encodeURIComponent(entityKey)}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.warn("[governance-event-dedupe-client] 서버 삭제 실패:", e);
    }
  })();
}
