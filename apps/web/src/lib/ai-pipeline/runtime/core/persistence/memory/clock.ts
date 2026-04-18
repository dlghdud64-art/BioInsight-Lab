/**
 * P1-1 Slice-1D — Monotonic Clock for Memory Repositories
 *
 * Ensures unique timestamps even when multiple operations
 * execute within the same JS tick (same millisecond).
 *
 * Without this, optimistic locking tests can produce false positives
 * because Date.now() may return the same value for consecutive calls.
 */

let _lastTimestamp = 0;

/**
 * Return a Date guaranteed to be strictly greater than the previous call.
 * If `Date.now()` hasn't advanced, bump by 1ms.
 */
export function monotoneNow(): Date {
  let ts = Date.now();
  if (ts <= _lastTimestamp) {
    ts = _lastTimestamp + 1;
  }
  _lastTimestamp = ts;
  return new Date(ts);
}

/** Test-only: reset the internal counter */
export function _resetClock(): void {
  _lastTimestamp = 0;
}
