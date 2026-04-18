/**
 * Governance Event Cross-Session Dedupe
 *
 * 책임:
 * - governance event publisher 가 동일 (poNumber, eventType, signatureKey) 조합에 대해
 *   탭/세션을 넘어 중복 발행하지 않도록 dedupe layer 를 제공한다.
 *
 * 고정 규칙:
 * 1. canonical truth 를 변경하지 않는다 — 발행 여부 결정 logic 만 제공.
 * 2. storage adapter 가 없는 환경 (SSR / test) 에서는 항상 "발행 OK" 를 반환한다.
 * 3. dedupe 키는 (poNumber + eventType + signatureKey) 의 composite.
 *    signatureKey 는 호출자가 결정 (예: updatedAt, readiness value 등).
 * 4. 만료 시간(TTL) 은 기본 30분. 같은 PO가 30분 안에 같은 이벤트를 재발행하지 않는다.
 *    30분 후에는 동일 signatureKey 라도 재발행 허용 (stale data recovery 대비).
 *
 * Persistence:
 * - PersistenceAdapter<DedupeRecord> 를 통해 storage 구현에 직접 의존하지 않는다.
 * - 기본 구현은 SessionStorageAdapter (getDedupeAdapter()).
 * - 추후 Supabase/DB adapter 로 교체 가능.
 *
 * 사용 예:
 * ```ts
 * if (shouldPublish("PO-001", "po_data_changed_after_approval", po.updatedAt)) {
 *   emitPoDataChangedAfterApproval({ ... });
 *   markPublished("PO-001", "po_data_changed_after_approval", po.updatedAt);
 * }
 * ```
 */

import { getDedupeAdapter, type DedupeRecord } from "@/lib/persistence/persistence-adapter";

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30분

function buildCompositeKey(poNumber: string, eventType: string, signatureKey: string): string {
  return `${poNumber}::${eventType}::${signatureKey}`;
}

/**
 * 이 (poNumber, eventType, signatureKey) 조합이 현재 세션에서 이미 발행되었는지 확인.
 * 발행된 적 없거나 TTL 이 만료되었으면 true (발행 해도 됨).
 */
export function shouldPublish(
  poNumber: string,
  eventType: string,
  signatureKey: string,
  ttlMs: number = DEFAULT_TTL_MS,
): boolean {
  const adapter = getDedupeAdapter();
  const key = buildCompositeKey(poNumber, eventType, signatureKey);
  const record = adapter.load(key);
  if (!record) return true;

  if (Number.isNaN(record.timestamp)) return true;

  // TTL 만료 시 재발행 허용.
  // NOTE: ttlMs=0 은 "즉시 만료" canonical 의미이므로 `>=` 로 체크해야 한다.
  //       (`>` 는 동일 ms tick 에서 record 를 방금 만든 경우 0>0=false 로 오판)
  return Date.now() - record.timestamp >= ttlMs;
}

/**
 * 발행 완료 후 호출 — 해당 조합을 현재 시각으로 기록.
 */
export function markPublished(
  poNumber: string,
  eventType: string,
  signatureKey: string,
): void {
  const adapter = getDedupeAdapter();
  const key = buildCompositeKey(poNumber, eventType, signatureKey);
  const record: DedupeRecord = { timestamp: Date.now(), signature: signatureKey };
  adapter.persist(key, record);
}

/**
 * 특정 PO 의 모든 dedupe 기록을 제거한다.
 * PO conversion reopen 같은 invalidation 이벤트에서 호출하여
 * 이후 재계산된 이벤트가 다시 발행될 수 있도록 한다.
 */
export function clearDedupeForPo(poNumber: string): void {
  const adapter = getDedupeAdapter();
  // SessionStorageAdapter의 clearByPrefix 활용 — adapter boundary 안에서 처리
  if ("clearByPrefix" in adapter && typeof (adapter as any).clearByPrefix === "function") {
    (adapter as any).clearByPrefix(`${poNumber}::`);
  } else {
    // generic adapter 대응 — 개별 키를 알 수 없으므로 no-op
    // 추후 adapter에 clearByPattern() 추가 시 대체
  }
}
