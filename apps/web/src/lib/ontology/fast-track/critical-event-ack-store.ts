/**
 * Critical Governance Event Acknowledgment Store
 *
 * 목적:
 *   fast-track-guard-inputs 의 `hasPendingCriticalEvents` 가 단순히
 *   "최근 critical 이벤트 존재" 로 판정하던 placeholder 를 실제 ack 추적으로
 *   교체한다.
 *
 * 고정 규칙:
 *   1. canonical truth 변경 X. governance event bus 자체는 immutable.
 *      본 store 는 "사용자가 본/처리한 critical 이벤트의 eventId" 만 보관.
 *   2. in-memory only — session 단위로 충분 (governance event 자체는 audit log
 *      로 영구 보관됨, ack 은 UI gating 용도이므로 ephemeral 허용).
 *   3. 동기 read/write — guard 가 동기적으로 호출됨.
 *   4. SSR-safe — module-level Set 으로 처리, window 의존 없음.
 */

const acknowledgedEventIds: Set<string> = new Set();

/**
 * eventId 가 이미 ack 되었는지 확인.
 */
export function isCriticalEventAcknowledged(eventId: string): boolean {
  return acknowledgedEventIds.has(eventId);
}

/**
 * 사용자가 critical 이벤트를 확인/처리한 시점에 호출.
 * 한 번 ack 된 eventId 는 이후 guard 의 pending 집계에서 제외된다.
 */
export function markCriticalEventAcknowledged(eventId: string): void {
  if (!eventId) return;
  acknowledgedEventIds.add(eventId);
}

/**
 * 일괄 ack — bulk modal dismiss 등에서 사용.
 */
export function markCriticalEventsAcknowledged(eventIds: ReadonlyArray<string>): void {
  for (const id of eventIds) {
    if (id) acknowledgedEventIds.add(id);
  }
}

/**
 * 현재까지 ack 된 ID 수 (디버그/테스트용).
 */
export function getAcknowledgedCount(): number {
  return acknowledgedEventIds.size;
}

/**
 * 테스트/시나리오 reset 용. 운영 코드에서는 호출하지 않는다.
 */
export function __resetCriticalEventAckStoreForTest(): void {
  acknowledgedEventIds.clear();
}
