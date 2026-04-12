/**
 * Governance Event Cross-Session Dedupe
 *
 * 책임:
 * - governance event publisher 가 동일 (poNumber, eventType, signatureKey) 조합에 대해
 *   탭/세션을 넘어 중복 발행하지 않도록 sessionStorage 기반 dedupe layer 를 제공한다.
 *
 * 고정 규칙:
 * 1. canonical truth 를 변경하지 않는다 — 발행 여부 결정 logic 만 제공.
 * 2. sessionStorage 가 없는 환경 (SSR / test) 에서는 항상 "발행 OK" 를 반환한다.
 * 3. dedupe 키는 (poNumber + eventType + signatureKey) 의 hash.
 *    signatureKey 는 호출자가 결정 (예: updatedAt, readiness value 등).
 * 4. 만료 시간(TTL) 은 기본 30분. 같은 PO가 30분 안에 같은 이벤트를 재발행하지 않는다.
 *    30분 후에는 동일 signatureKey 라도 재발행 허용 (stale data recovery 대비).
 *
 * 사용 예:
 * ```ts
 * if (shouldPublish("PO-001", "po_data_changed_after_approval", po.updatedAt)) {
 *   emitPoDataChangedAfterApproval({ ... });
 *   markPublished("PO-001", "po_data_changed_after_approval", po.updatedAt);
 * }
 * ```
 */

const STORAGE_PREFIX = "labaxis_gov_dedupe_";
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30분

function buildKey(poNumber: string, eventType: string, signatureKey: string): string {
  return `${STORAGE_PREFIX}${poNumber}::${eventType}::${signatureKey}`;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
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
  const storage = getStorage();
  if (!storage) return true; // SSR / test 환경

  const key = buildKey(poNumber, eventType, signatureKey);
  const raw = storage.getItem(key);
  if (!raw) return true;

  const ts = Number(raw);
  if (Number.isNaN(ts)) return true;

  // TTL 만료 시 재발행 허용
  return Date.now() - ts > ttlMs;
}

/**
 * 발행 완료 후 호출 — 해당 조합을 현재 시각으로 기록.
 */
export function markPublished(
  poNumber: string,
  eventType: string,
  signatureKey: string,
): void {
  const storage = getStorage();
  if (!storage) return;

  const key = buildKey(poNumber, eventType, signatureKey);
  try {
    storage.setItem(key, String(Date.now()));
  } catch {
    // storage full 등 — silent fail (dedupe 는 best-effort)
  }
}

/**
 * 특정 PO 의 모든 dedupe 기록을 제거한다.
 * PO conversion reopen 같은 invalidation 이벤트에서 호출하여
 * 이후 재계산된 이벤트가 다시 발행될 수 있도록 한다.
 */
export function clearDedupeForPo(poNumber: string): void {
  const storage = getStorage();
  if (!storage) return;

  const prefix = `${STORAGE_PREFIX}${poNumber}::`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => storage.removeItem(k));
}
