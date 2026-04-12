/**
 * Outbound History Persistence Layer
 *
 * 목적:
 *   dispatch-outbound-store (Zustand in-memory) 의 historyByPoId 를
 *   sessionStorage 에 보관해 페이지 새로고침 / 탭 재진입 시에도
 *   outbound execution lineage (audit modal, history strip) 가 유실되지 않게 한다.
 *
 * 고정 규칙:
 *   1. canonical truth 는 여전히 dispatch-outbound-store 의 latest pointer (recordsByPoId).
 *      본 persistence 는 audit lineage 만 보관하며 store mutation 을 유발하지 않는다.
 *   2. PO 단위로 저장/조회/삭제한다. broad global clear 금지.
 *   3. PO conversion reopen / dispatch prep cancel 등 invalidation 이벤트에서
 *      해당 PO 의 persisted history 를 제거해 stale lineage 가 남지 않게 한다.
 *   4. SSR / sessionStorage 미지원 환경에서는 no-op.
 *   5. 저장 시 history 를 그대로 직렬화한다. field 를 축소하지 않음 —
 *      audit modal 이 전체 record 를 소비하므로.
 */

import type { DispatchOutboundRecord } from "@/lib/store/dispatch-outbound-store";

const STORAGE_KEY_PREFIX = "labaxis_outbound_history::";

// ══════════════════════════════════════════════
// SSR safety
// ══════════════════════════════════════════════

function isStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (typeof window.sessionStorage === "undefined") return false;
    const probe = "__labaxis_outbound_probe__";
    window.sessionStorage.setItem(probe, "1");
    window.sessionStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function buildKey(poId: string): string {
  return `${STORAGE_KEY_PREFIX}${poId}`;
}

// ══════════════════════════════════════════════
// Write — store mutation 이후 호출
// ══════════════════════════════════════════════

/**
 * 특정 PO 의 outbound history 를 sessionStorage 에 저장한다.
 * store 의 applyOutboundMutation 이후에 호출되며,
 * 빈 배열이면 해당 key 를 제거해 storage 오염을 방지한다.
 */
export function persistOutboundHistory(
  poId: string,
  history: ReadonlyArray<DispatchOutboundRecord>,
): void {
  if (!isStorageAvailable()) return;
  const key = buildKey(poId);
  if (history.length === 0) {
    window.sessionStorage.removeItem(key);
    return;
  }
  try {
    window.sessionStorage.setItem(key, JSON.stringify(history));
  } catch {
    // QuotaExceeded 등 — 무시. audit lineage 유실은 치명적이지 않음.
  }
}

// ══════════════════════════════════════════════
// Read — store hydration 시 호출
// ══════════════════════════════════════════════

/**
 * 특정 PO 의 persisted outbound history 를 조회한다.
 * 없거나 파싱 실패 시 빈 배열.
 */
export function loadOutboundHistory(
  poId: string,
): DispatchOutboundRecord[] {
  if (!isStorageAvailable()) return [];
  const raw = window.sessionStorage.getItem(buildKey(poId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as DispatchOutboundRecord[];
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════
// Delete — targeted invalidation
// ══════════════════════════════════════════════

/**
 * 특정 PO 의 persisted outbound history 를 제거한다.
 * reopen / invalidation 이벤트에서 governance-bridge 가 호출한다.
 */
export function clearOutboundHistory(poId: string): void {
  if (!isStorageAvailable()) return;
  window.sessionStorage.removeItem(buildKey(poId));
}

// ══════════════════════════════════════════════
// Hydrate helper — store 에 persisted history 를 merge
// ══════════════════════════════════════════════

/**
 * store 의 현재 history 가 비어 있고 persisted history 가 있으면 merge 한다.
 * store 에 이미 history 가 있으면 no-op (in-memory 가 우선).
 *
 * @returns hydrated 여부
 */
export function hydrateOutboundHistoryIfEmpty(
  poId: string,
  currentHistory: ReadonlyArray<DispatchOutboundRecord>,
): { shouldHydrate: true; history: DispatchOutboundRecord[]; latest: DispatchOutboundRecord } | { shouldHydrate: false } {
  if (currentHistory.length > 0) return { shouldHydrate: false };
  const persisted = loadOutboundHistory(poId);
  if (persisted.length === 0) return { shouldHydrate: false };
  const latest = persisted[persisted.length - 1];
  return { shouldHydrate: true, history: persisted, latest };
}
