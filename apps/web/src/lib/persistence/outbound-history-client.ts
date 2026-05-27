/**
 * Outbound History — Client Persistence Bridge
 *
 * server-first + sessionStorage-fallback 이중 레이어.
 * 기존 outbound-history-persistence.ts 의 인터페이스를 유지하면서
 * 내부적으로 서버 persistence 를 우선 사용한다.
 */

import type { DispatchOutboundRecord } from "@/lib/store/dispatch-outbound-store";
import { csrfFetch } from "@/lib/api-client";
import {
  persistOutboundHistory as persistLocal,
  loadOutboundHistory as loadLocal,
  clearOutboundHistory as clearLocal,
  hydrateOutboundHistoryIfEmpty as hydrateLocalIfEmpty,
} from "@/lib/ai/outbound-history-persistence";

const API_BASE = "/api/governance/outbound-history";

// ══════════════════════════════════════════════
// Persist (write-through: server + local)
// ══════════════════════════════════════════════

export async function persistOutboundHistoryWithServer(
  poId: string,
  history: ReadonlyArray<DispatchOutboundRecord>,
): Promise<void> {
  // 1. sessionStorage 즉시 기록 (동기)
  persistLocal(poId, history);

  // 2. 서버에 비동기 기록
  try {
    await csrfFetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poId, history }),
    });
  } catch (e) {
    console.warn("[outbound-history-client] 서버 저장 실패, sessionStorage fallback:", e);
  }
}

// ══════════════════════════════════════════════
// Load (server-first → local fallback)
// ══════════════════════════════════════════════

export async function loadOutboundHistoryWithServer(
  poId: string,
): Promise<DispatchOutboundRecord[]> {
  // 1. 서버에서 먼저 시도
  try {
    const res = await fetch(`${API_BASE}?poId=${encodeURIComponent(poId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.history) && data.history.length > 0) {
        return data.history as DispatchOutboundRecord[];
      }
    }
  } catch (e) {
    console.warn("[outbound-history-client] 서버 조회 실패, sessionStorage fallback:", e);
  }

  // 2. 서버 실패 시 sessionStorage fallback
  return loadLocal(poId);
}

// ══════════════════════════════════════════════
// Clear (양쪽 모두 제거)
// ══════════════════════════════════════════════

export async function clearOutboundHistoryWithServer(
  poId: string,
): Promise<void> {
  clearLocal(poId);

  try {
    await csrfFetch(`${API_BASE}?poId=${encodeURIComponent(poId)}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.warn("[outbound-history-client] 서버 삭제 실패:", e);
  }
}

// ══════════════════════════════════════════════
// Hydrate (server-first → local fallback)
// ══════════════════════════════════════════════

export async function hydrateOutboundHistoryWithServer(
  poId: string,
  currentHistory: ReadonlyArray<DispatchOutboundRecord>,
): Promise<
  | { shouldHydrate: true; history: DispatchOutboundRecord[]; latest: DispatchOutboundRecord }
  | { shouldHydrate: false }
> {
  if (currentHistory.length > 0) return { shouldHydrate: false };

  // 1. 서버에서 먼저 시도
  try {
    const res = await fetch(`${API_BASE}?poId=${encodeURIComponent(poId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.history) && data.history.length > 0) {
        const history = data.history as DispatchOutboundRecord[];
        const latest = history[history.length - 1];
        return { shouldHydrate: true, history, latest };
      }
    }
  } catch (e) {
    console.warn("[outbound-history-client] 서버 hydrate 실패, sessionStorage fallback:", e);
  }

  // 2. 서버에 없으면 sessionStorage fallback
  return hydrateLocalIfEmpty(poId, currentHistory);
}
