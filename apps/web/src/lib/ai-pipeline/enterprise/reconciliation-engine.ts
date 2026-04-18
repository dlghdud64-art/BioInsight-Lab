/**
 * Reconciliation Engine — 플랫폼-하위 시스템 간 상태 불일치 탐지
 *
 * Silent failure를 방지하고, 불일치 발견 시 재시도 큐에 넣거나
 * 티켓팅 시스템에 담당자 할당 Task를 생성합니다.
 */

import { createEvent, publish } from "./event-bus-contracts";
import { createIncidentTicket } from "./domain-bridges";

// ── Types ──

export type ReconciliationStatus = "MATCHED" | "MISMATCH" | "MISSING_IN_SOURCE" | "MISSING_IN_TARGET" | "RETRY_PENDING" | "ESCALATED";
export type ReconciliationDomain = "PROCUREMENT" | "INVENTORY" | "BUDGET" | "IDENTITY";

export interface ReconciliationRecord {
  id: string;
  domain: ReconciliationDomain;
  tenantId: string;
  sourceSystem: string;
  targetSystem: string;
  sourceKey: string;
  targetKey: string;
  status: ReconciliationStatus;
  mismatchDetails: { field: string; sourceValue: string; targetValue: string }[];
  detectedAt: Date;
  retriedAt: Date | null;
  retryCount: number;
  maxRetries: number;
  escalatedAt: Date | null;
  ticketId: string | null;
  resolvedAt: Date | null;
}

// In-memory store
const records: ReconciliationRecord[] = [];
const retryQueue: ReconciliationRecord[] = [];

/**
 * 대사(Reconciliation) 레코드 등록
 */
export function recordReconciliation(params: {
  domain: ReconciliationDomain;
  tenantId: string;
  sourceSystem: string;
  targetSystem: string;
  sourceKey: string;
  targetKey: string;
  status: ReconciliationStatus;
  mismatchDetails?: { field: string; sourceValue: string; targetValue: string }[];
}): ReconciliationRecord {
  const record: ReconciliationRecord = {
    id: `REC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    domain: params.domain,
    tenantId: params.tenantId,
    sourceSystem: params.sourceSystem,
    targetSystem: params.targetSystem,
    sourceKey: params.sourceKey,
    targetKey: params.targetKey,
    status: params.status,
    mismatchDetails: params.mismatchDetails ?? [],
    detectedAt: new Date(),
    retriedAt: null,
    retryCount: 0,
    maxRetries: 3,
    escalatedAt: null,
    ticketId: null,
    resolvedAt: null,
  };

  records.push(record);

  if (params.status === "MISMATCH" || params.status === "MISSING_IN_SOURCE" || params.status === "MISSING_IN_TARGET") {
    retryQueue.push(record);
  }

  return record;
}

/**
 * 재시도 큐 처리
 */
export async function processRetryQueue(): Promise<{
  processed: number;
  escalated: number;
  resolved: number;
}> {
  let escalated = 0;
  let resolved = 0;
  const toProcess = [...retryQueue];

  for (const record of toProcess) {
    record.retryCount++;
    record.retriedAt = new Date();

    // Simulate retry (production: re-check against source/target)
    const retrySuccess = false; // would be actual reconciliation check

    if (retrySuccess) {
      record.status = "MATCHED";
      record.resolvedAt = new Date();
      resolved++;
      const idx = retryQueue.indexOf(record);
      if (idx >= 0) retryQueue.splice(idx, 1);
    } else if (record.retryCount >= record.maxRetries) {
      // Escalate — create incident ticket
      record.status = "ESCALATED";
      record.escalatedAt = new Date();

      const ticket = await createIncidentTicket({
        tenantId: record.tenantId,
        title: `[Reconciliation] ${record.domain} 불일치 — ${record.sourceKey}`,
        description: `${record.sourceSystem} ↔ ${record.targetSystem} 간 ${record.domain} 불일치 감지. ${record.mismatchDetails.length}건의 필드 차이. 재시도 ${record.maxRetries}회 실패.`,
        severity: "SEV2",
        assignee: null,
        documentType: record.domain,
        correlationId: record.id,
        sourceEvent: "reconciliation.escalated",
      });

      record.ticketId = ticket.ticketId;
      escalated++;

      const idx = retryQueue.indexOf(record);
      if (idx >= 0) retryQueue.splice(idx, 1);
    }
    // else: stays in retry queue
  }

  return { processed: toProcess.length, escalated, resolved };
}

/**
 * 대사 상태 조회
 */
export function getReconciliationRecords(params?: {
  domain?: ReconciliationDomain;
  status?: ReconciliationStatus;
  tenantId?: string;
}): ReconciliationRecord[] {
  let items = [...records];
  if (params?.domain) items = items.filter((r) => r.domain === params.domain);
  if (params?.status) items = items.filter((r) => r.status === params.status);
  if (params?.tenantId) items = items.filter((r) => r.tenantId === params.tenantId);
  return items;
}

export function getReconciliationStats(): {
  total: number;
  matched: number;
  mismatched: number;
  retryPending: number;
  escalated: number;
  byDomain: Record<string, number>;
} {
  const byDomain: Record<string, number> = {};
  for (const r of records.filter((r) => r.status !== "MATCHED")) {
    byDomain[r.domain] = (byDomain[r.domain] ?? 0) + 1;
  }

  return {
    total: records.length,
    matched: records.filter((r) => r.status === "MATCHED").length,
    mismatched: records.filter((r) => r.status === "MISMATCH").length,
    retryPending: retryQueue.length,
    escalated: records.filter((r) => r.status === "ESCALATED").length,
    byDomain,
  };
}

export function getRetryQueueSize(): number {
  return retryQueue.length;
}
