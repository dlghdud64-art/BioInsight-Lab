/**
 * Governance Event Dedupe — Client-side deduplication layer
 *
 * 동일 governance event 가 탭 재진입/remount 시 중복 발행되지 않도록
 * sessionStorage 기반으로 dedupe 한다.
 *
 * 현재는 sessionStorage 단독. 서버측 dedupe 는 별도 layer 책임.
 */

const STORAGE_PREFIX = "labaxis:gov-dedupe:";

/**
 * 이 event 를 발행해야 하는지 확인한다.
 * 이미 같은 (entityKey, eventType, signature) 조합이 기록되어 있으면 false.
 */
export function shouldPublishWithServer(
  entityKey: string,
  eventType: string,
  signature: string,
): boolean {
  if (typeof window === "undefined") return true;
  const key = `${STORAGE_PREFIX}${entityKey}::${eventType}`;
  const existing = sessionStorage.getItem(key);
  return existing !== signature;
}

/**
 * event 발행 완료를 기록한다.
 */
export function markPublishedWithServer(
  entityKey: string,
  eventType: string,
  signature: string,
): void {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_PREFIX}${entityKey}::${eventType}`;
  sessionStorage.setItem(key, signature);
}

/**
 * reopen / invalidation 시 해당 PO의 모든 dedupe 기록을 clear한다.
 * 이후 재계산된 governance event가 다시 발행될 수 있게 한다.
 */
export function clearDedupeForPoWithServer(entityKey: string): void {
  if (typeof window === "undefined") return;
  const prefix = `${STORAGE_PREFIX}${entityKey}::`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}
