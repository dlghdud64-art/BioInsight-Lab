/**
 * Approval Baseline — Client Persistence Bridge
 *
 * server-first + sessionStorage-fallback 이중 레이어.
 * 기존 approval-snapshot-store.ts 의 동기 API 를 유지하면서
 * 내부적으로 서버 persistence 를 우선 사용한다.
 *
 * 패턴: outbound-history-client.ts 와 동일한 write-through + server-first read.
 *
 * 고정 규칙:
 *   1. canonical truth 는 PurchaseOrderContract. 본 레이어는 ReadOnly snapshot.
 *   2. server 장애 시 sessionStorage fallback 자동 전환.
 *   3. ensure(write) 는 sessionStorage 즉시(동기) + server 비동기.
 *   4. get(read) 는 server-first → sessionStorage fallback.
 *   5. clear(invalidation) 는 양쪽 모두 삭제.
 */

import type { ApprovalPoSnapshot } from "@/lib/ai/approval-snapshot-store";
import { csrfFetch } from "@/lib/api-client";
import {
  ensureApprovalSnapshot as ensureLocal,
  getApprovalSnapshot as getLocal,
  clearApprovalSnapshot as clearLocal,
} from "@/lib/ai/approval-snapshot-store";

const API_BASE = "/api/governance/approval-baseline";

// ══════════════════════════════════════════════
// Ensure (write-through: local + server)
// ══════════════════════════════════════════════

/**
 * 서버에 approval baseline 을 기록한다.
 * sessionStorage 즉시 기록(동기) + 서버 비동기 기록.
 * 이미 같은 approvalDecidedAt 의 snapshot 이 서버에 있으면 무시 (ensure 의미론).
 */
export async function ensureApprovalSnapshotWithServer(
  data: ApprovalPoSnapshot,
): Promise<void> {
  // 1. sessionStorage 즉시 기록 (동기)
  ensureLocal(data);

  // 2. 서버에 비동기 기록
  try {
    await csrfFetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: data }),
    });
  } catch (e) {
    console.warn("[approval-baseline-client] 서버 저장 실패, sessionStorage fallback:", e);
  }
}

// ══════════════════════════════════════════════
// Get (server-first → local fallback)
// ══════════════════════════════════════════════

/**
 * 서버에서 approval baseline 을 조회한다.
 * server-first → sessionStorage fallback.
 */
export async function getApprovalSnapshotWithServer(
  poNumber: string,
): Promise<ApprovalPoSnapshot | null> {
  // 1. 서버에서 먼저 시도
  try {
    const res = await fetch(`${API_BASE}?poNumber=${encodeURIComponent(poNumber)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.baseline) {
        return data.baseline as ApprovalPoSnapshot;
      }
    }
  } catch (e) {
    console.warn("[approval-baseline-client] 서버 조회 실패, sessionStorage fallback:", e);
  }

  // 2. 서버 실패 시 sessionStorage fallback
  return getLocal(poNumber);
}

// ══════════════════════════════════════════════
// Clear / Invalidate (양쪽 모두 제거)
// ══════════════════════════════════════════════

/**
 * reopen / invalidation 시 서버의 approval baseline 을 clear 한다.
 * sessionStorage + 서버 양쪽 모두 삭제.
 */
export async function clearApprovalSnapshotWithServer(
  poNumber: string,
): Promise<void> {
  // 1. sessionStorage 즉시 clear (동기)
  clearLocal(poNumber);

  // 2. 서버 비동기 clear (soft-delete)
  try {
    await csrfFetch(`${API_BASE}?poNumber=${encodeURIComponent(poNumber)}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.warn("[approval-baseline-client] 서버 삭제 실패:", e);
  }
}

// ══════════════════════════════════════════════
// Hydrate (server-first → local adapter에 캐시)
// ══════════════════════════════════════════════

/**
 * 브라우저 세션에 baseline 이 없으면 서버에서 가져와 sessionStorage에 캐시.
 * mount 시점에 호출하여 re-entry hydration 보장.
 *
 * @returns hydrated snapshot 또는 null
 */
export async function hydrateApprovalSnapshotFromServer(
  poNumber: string,
): Promise<ApprovalPoSnapshot | null> {
  // 1. 로컬에 이미 있으면 skip
  const local = getLocal(poNumber);
  if (local) return local;

  // 2. 서버에서 가져오기
  const server = await getApprovalSnapshotWithServer(poNumber);
  if (server) {
    // sessionStorage에 캐시하여 이후 동기 접근 가능
    ensureLocal(server);
  }
  return server;
}
