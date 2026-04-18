/**
 * offline/mutation-queue.ts — 오프라인 mutation 대기열
 *
 * 원칙:
 * - 서버가 canonical truth. 로컬은 pending queue만 담당.
 * - 네트워크 단절 시 mutation을 queue에 저장.
 * - 재연결 시 FIFO 순서로 서버에 전송.
 * - 실패 시 retry (최대 3회), 그 뒤 사용자에게 알림.
 * - conflict → server wins.
 *
 * 대상 flow (모바일 edge tool):
 * - 재고 점검 기록 (inspection)
 * - 입고/수령 확인 (receiving)
 * - 재고 사용/출고 (consume)
 * - 사진 첨부 메타데이터
 * - QR 스캔 결과 저장
 */

import { getDb } from "./db";
import { apiClient } from "../api";

const MAX_RETRY = 3;

export type MutationType =
  | "inspection_create"
  | "inventory_restock"
  | "inventory_consume"
  | "inventory_location_update"
  | "photo_attach"
  | "quote_status_update"
  | "purchase_status_update";

export interface QueuedMutation {
  id: number;
  type: MutationType;
  endpoint: string;
  method: string;
  payload: string;
  createdAt: number;
  status: "pending" | "processing" | "failed" | "completed";
  retryCount: number;
  lastError: string | null;
  entityType: string | null;
  entityId: string | null;
}

/**
 * mutation을 queue에 추가합니다.
 */
export async function enqueueMutation(
  type: MutationType,
  endpoint: string,
  payload: Record<string, unknown>,
  options?: {
    method?: string;
    entityType?: string;
    entityId?: string;
  },
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO mutation_queue (type, endpoint, method, payload, created_at, status, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      type,
      endpoint,
      options?.method ?? "POST",
      JSON.stringify(payload),
      Date.now(),
      options?.entityType ?? null,
      options?.entityId ?? null,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * pending 상태의 mutation 목록을 가져옵니다 (FIFO).
 */
export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    type: string;
    endpoint: string;
    method: string;
    payload: string;
    created_at: number;
    status: string;
    retry_count: number;
    last_error: string | null;
    entity_type: string | null;
    entity_id: string | null;
  }>(
    "SELECT * FROM mutation_queue WHERE status IN ('pending', 'failed') AND retry_count < ? ORDER BY id ASC",
    [MAX_RETRY],
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type as MutationType,
    endpoint: r.endpoint,
    method: r.method,
    payload: r.payload,
    createdAt: r.created_at,
    status: r.status as QueuedMutation["status"],
    retryCount: r.retry_count,
    lastError: r.last_error,
    entityType: r.entity_type,
    entityId: r.entity_id,
  }));
}

/**
 * pending mutation 개수를 반환합니다.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM mutation_queue WHERE status IN ('pending', 'failed') AND retry_count < ?",
    [MAX_RETRY],
  );
  return row?.count ?? 0;
}

/**
 * 단일 mutation을 서버에 전송합니다.
 */
async function processMutation(mutation: QueuedMutation): Promise<boolean> {
  const db = await getDb();

  try {
    // processing 상태로 변경
    await db.runAsync(
      "UPDATE mutation_queue SET status = 'processing' WHERE id = ?",
      [mutation.id],
    );

    const payload = JSON.parse(mutation.payload);

    await apiClient.request({
      url: mutation.endpoint,
      method: mutation.method,
      data: payload,
    });

    // 성공 — completed로 변경
    await db.runAsync(
      "UPDATE mutation_queue SET status = 'completed' WHERE id = ?",
      [mutation.id],
    );

    return true;
  } catch (err: any) {
    const errorMsg = err?.message ?? "Unknown error";

    // 실패 — retry count 증가
    await db.runAsync(
      "UPDATE mutation_queue SET status = 'failed', retry_count = retry_count + 1, last_error = ? WHERE id = ?",
      [errorMsg, mutation.id],
    );

    return false;
  }
}

/**
 * 모든 pending mutation을 FIFO 순서로 처리합니다.
 * 네트워크 복구 시 호출.
 *
 * @returns 처리 결과 { synced: number, failed: number, remaining: number }
 */
export async function flushMutationQueue(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  const pending = await getPendingMutations();
  let synced = 0;
  let failed = 0;

  for (const mutation of pending) {
    const success = await processMutation(mutation);
    if (success) {
      synced++;
    } else {
      failed++;
      // 연속 실패 시 중단 (네트워크 문제일 가능성)
      if (failed >= 3) break;
    }
  }

  const remaining = await getPendingCount();
  return { synced, failed, remaining };
}

/**
 * 완료된 mutation을 정리합니다.
 * 7일 이상 된 completed 항목 삭제.
 */
export async function pruneCompletedMutations(): Promise<number> {
  const db = await getDb();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const result = await db.runAsync(
    "DELETE FROM mutation_queue WHERE status = 'completed' AND created_at < ?",
    [cutoff],
  );
  return result.changes;
}

/**
 * 영구 실패(retry 초과) 항목 목록.
 * 사용자에게 수동 재시도/삭제 선택지를 보여줄 때 사용.
 */
export async function getFailedMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM mutation_queue WHERE status = 'failed' AND retry_count >= ? ORDER BY id ASC",
    [MAX_RETRY],
  );

  return rows.map((r: any) => ({
    id: r.id,
    type: r.type as MutationType,
    endpoint: r.endpoint,
    method: r.method,
    payload: r.payload,
    createdAt: r.created_at,
    status: "failed" as const,
    retryCount: r.retry_count,
    lastError: r.last_error,
    entityType: r.entity_type,
    entityId: r.entity_id,
  }));
}
