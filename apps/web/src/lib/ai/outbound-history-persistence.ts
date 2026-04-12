/**
 * Outbound History Persistence Layer
 *
 * 목적:
 *   dispatch-outbound-store (Zustand in-memory) 의 historyByPoId 를
 *   persistence adapter 뒤에서 보관해 페이지 새로고침 / 탭 재진입 시에도
 *   outbound execution lineage (audit modal, history strip) 가 유실되지 않게 한다.
 *
 * 고정 규칙:
 *   1. canonical truth 는 여전히 dispatch-outbound-store 의 latest pointer (recordsByPoId).
 *      본 persistence 는 audit lineage 만 보관하며 store mutation 을 유발하지 않는다.
 *   2. PO 단위로 저장/조회/삭제한다. broad global clear 금지.
 *   3. PO conversion reopen / dispatch prep cancel 등 invalidation 이벤트에서
 *      해당 PO 의 persisted history 를 제거해 stale lineage 가 남지 않게 한다.
 *   4. SSR-safe — adapter 가 SSR 환경을 처리.
 *   5. 저장 시 history 를 그대로 직렬화한다. field 를 축소하지 않음 —
 *      audit modal 이 전체 record 를 소비하므로.
 *
 * Persistence:
 *   PersistenceAdapter<OutboundHistoryRecord[]> 를 통해 storage 구현에 직접 의존하지 않는다.
 *   기본 구현은 SessionStorageAdapter (getOutboundHistoryAdapter()).
 *   추후 Supabase/DB adapter 로 교체 가능.
 */

import type { DispatchOutboundRecord } from "@/lib/store/dispatch-outbound-store";
import { getOutboundHistoryAdapter, type OutboundHistoryRecord } from "@/lib/persistence/persistence-adapter";

// ══════════════════════════════════════════════
// Internal: DispatchOutboundRecord ↔ OutboundHistoryRecord 변환
// ══════════════════════════════════════════════

function toHistoryRecords(records: ReadonlyArray<DispatchOutboundRecord>): OutboundHistoryRecord[] {
  return records.map((r) => ({
    poId: r.poId,
    type: r.status,
    timestamp: r.createdAt,
    actor: "system",
    payload: r as unknown as Record<string, unknown>,
  }));
}

function fromHistoryRecords(records: OutboundHistoryRecord[]): DispatchOutboundRecord[] {
  return records
    .map((r) => r.payload as unknown as DispatchOutboundRecord)
    .filter((r): r is DispatchOutboundRecord => r != null && typeof r === "object");
}

// ══════════════════════════════════════════════
// Write — store mutation 이후 호출
// ══════════════════════════════════════════════

/**
 * 특정 PO 의 outbound history 를 persistence adapter에 저장한다.
 * store 의 applyOutboundMutation 이후에 호출되며,
 * 빈 배열이면 해당 key 를 제거해 storage 오염을 방지한다.
 */
export function persistOutboundHistory(
  poId: string,
  history: ReadonlyArray<DispatchOutboundRecord>,
): void {
  const adapter = getOutboundHistoryAdapter();
  if (history.length === 0) {
    adapter.clear(poId);
    return;
  }
  adapter.persist(poId, toHistoryRecords(history));
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
  const adapter = getOutboundHistoryAdapter();
  const records = adapter.load(poId);
  if (!records || !Array.isArray(records)) return [];
  return fromHistoryRecords(records);
}

// ══════════════════════════════════════════════
// Delete — targeted invalidation
// ══════════════════════════════════════════════

/**
 * 특정 PO 의 persisted outbound history 를 제거한다.
 * reopen / invalidation 이벤트에서 governance-bridge 가 호출한다.
 */
export function clearOutboundHistory(poId: string): void {
  const adapter = getOutboundHistoryAdapter();
  adapter.clear(poId);
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
