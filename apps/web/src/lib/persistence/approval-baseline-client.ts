/**
 * Approval Baseline — Server persistence client (stub)
 *
 * sessionStorage 의 baseline 을 서버에도 동기화하기 위한 layer.
 * 현재는 stub — 서버 API 연결 시 실제 fetch 로 교체.
 */

import type { ApprovalPoSnapshot } from "@/lib/ai/approval-snapshot-store";

/**
 * 서버에 approval baseline 을 기록한다.
 * 이미 같은 approvalDecidedAt 의 snapshot 이 서버에 있으면 무시.
 */
export async function ensureApprovalSnapshotWithServer(
  _data: ApprovalPoSnapshot,
): Promise<void> {
  // stub — 서버 API 연결 시 실제 fetch 로 교체
}

/**
 * 서버에서 approval baseline 을 조회한다.
 * sessionStorage 에 없을 때 fallback 용도.
 */
export async function getApprovalSnapshotWithServer(
  _poNumber: string,
): Promise<ApprovalPoSnapshot | null> {
  // stub — 서버 API 연결 시 실제 fetch 로 교체
  return null;
}

/**
 * reopen / invalidation 시 서버의 approval baseline 을 clear 한다.
 */
export async function clearApprovalSnapshotWithServer(
  _poNumber: string,
): Promise<void> {
  // stub — 서버 API 연결 시 실제 fetch 로 교체
}
