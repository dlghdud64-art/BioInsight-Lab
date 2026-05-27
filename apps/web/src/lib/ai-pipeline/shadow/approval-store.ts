/**
 * Approval Store — 모든 GO 계열 판정의 승인 기록 관리
 *
 * 규칙:
 *  - GO 계열 → approval 없이 stage 변경 금지
 *  - HOLD → 기록만
 *  - ROLLBACK 계열 → approval 없이 즉시 집행 가능
 *  - 승인 만료 후 재검토 강제
 */

import { randomUUID } from "crypto";
import type { LifecycleState } from "./rollout-state-machine";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "EXECUTED";

export interface ApprovalRecord {
  id: string;
  documentType: string;
  currentStage: LifecycleState;
  proposedStage: LifecycleState;
  proposedRestrictedAutoVerify: boolean;
  decisionType: string;
  basisReportIds: string[];
  requestedBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  notes: string;
  expiresAt: string;
  status: ApprovalStatus;
  executedAt: string | null;
}

// In-memory store (production: DB-backed)
const approvalStore: Map<string, ApprovalRecord> = new Map();

const DEFAULT_EXPIRY_HOURS = 24;

/**
 * 승인 요청 생성
 */
export function createApprovalRequest(params: {
  documentType: string;
  currentStage: LifecycleState;
  proposedStage: LifecycleState;
  proposedRestrictedAutoVerify: boolean;
  decisionType: string;
  basisReportIds: string[];
  requestedBy: string;
  notes: string;
  expiryHours?: number;
}): ApprovalRecord {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (params.expiryHours ?? DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000);

  const record: ApprovalRecord = {
    id,
    documentType: params.documentType,
    currentStage: params.currentStage,
    proposedStage: params.proposedStage,
    proposedRestrictedAutoVerify: params.proposedRestrictedAutoVerify,
    decisionType: params.decisionType,
    basisReportIds: params.basisReportIds,
    requestedBy: params.requestedBy,
    requestedAt: now.toISOString(),
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    notes: params.notes,
    expiresAt: expiresAt.toISOString(),
    status: "PENDING",
    executedAt: null,
  };

  approvalStore.set(id, record);
  return record;
}

/**
 * 승인 처리
 */
export function approveRequest(id: string, approvedBy: string, notes?: string): ApprovalRecord | null {
  const record = approvalStore.get(id);
  if (!record) return null;

  if (record.status !== "PENDING") return null;

  // 만료 체크
  if (new Date() > new Date(record.expiresAt)) {
    record.status = "EXPIRED";
    approvalStore.set(id, record);
    return null;
  }

  record.approvedBy = approvedBy;
  record.approvedAt = new Date().toISOString();
  record.status = "APPROVED";
  if (notes) record.notes = `${record.notes}\n[승인] ${notes}`;

  approvalStore.set(id, record);
  return record;
}

/**
 * 거부 처리
 */
export function rejectRequest(id: string, rejectedBy: string, notes?: string): ApprovalRecord | null {
  const record = approvalStore.get(id);
  if (!record || record.status !== "PENDING") return null;

  record.rejectedBy = rejectedBy;
  record.rejectedAt = new Date().toISOString();
  record.status = "REJECTED";
  if (notes) record.notes = `${record.notes}\n[거부] ${notes}`;

  approvalStore.set(id, record);
  return record;
}

/**
 * 집행 완료 마킹
 */
export function markExecuted(id: string): void {
  const record = approvalStore.get(id);
  if (record && record.status === "APPROVED") {
    record.status = "EXECUTED";
    record.executedAt = new Date().toISOString();
    approvalStore.set(id, record);
  }
}

/**
 * 유효한 승인 조회 — 특정 documentType의 최신 APPROVED 승인
 */
export function getValidApproval(documentType: string, proposedStage: LifecycleState): ApprovalRecord | null {
  const now = new Date();
  for (const record of approvalStore.values()) {
    if (
      record.documentType === documentType &&
      record.proposedStage === proposedStage &&
      record.status === "APPROVED" &&
      new Date(record.expiresAt) > now
    ) {
      return record;
    }
  }
  return null;
}

/**
 * 만료된 PENDING 승인 정리
 */
export function expireStaleApprovals(): number {
  const now = new Date();
  let expired = 0;
  for (const record of approvalStore.values()) {
    if (record.status === "PENDING" && new Date(record.expiresAt) <= now) {
      record.status = "EXPIRED";
      expired++;
    }
  }
  return expired;
}

/**
 * 문서 타입별 PENDING 승인 조회
 */
export function getPendingApprovals(documentType?: string): ApprovalRecord[] {
  const results: ApprovalRecord[] = [];
  for (const record of approvalStore.values()) {
    if (record.status !== "PENDING") continue;
    if (documentType && record.documentType !== documentType) continue;
    results.push(record);
  }
  return results;
}

/**
 * 전체 승인 이력 조회
 */
export function getApprovalHistory(documentType: string, limit: number = 20): ApprovalRecord[] {
  const results: ApprovalRecord[] = [];
  for (const record of approvalStore.values()) {
    if (record.documentType === documentType) {
      results.push(record);
    }
  }
  return results
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    .slice(0, limit);
}

/**
 * ROLLBACK은 approval 필요 여부 판정
 */
export function requiresApproval(decisionType: string): boolean {
  const noApprovalRequired = [
    "ROLLBACK_TO_SHADOW",
    "ROLLBACK_TO_ACTIVE_5",
    "ROLLBACK_TO_25",
    "EMERGENCY_OFF",
  ];
  return !noApprovalRequired.includes(decisionType);
}
