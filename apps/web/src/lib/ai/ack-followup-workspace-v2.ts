/**
 * Ack Followup Workspace v2 — non-confirmed supplier ack 운영 큐
 * followup은 예외 쓰레기통이 아니라 분명한 operator work queue.
 * 결과 → receiving_preparation_handoff 또는 exception_recovery.
 *
 * TRUTH CONTRACT:
 * - reads: AckResolutionSession (ackClassification, followupReason)
 * - writes: 없음 — workspace는 read-only. resolution engine이 followup session write.
 * - center: followup draft + send + response capture + classification
 * - rail: ack classification evidence + delivery/send snapshot
 * - dock: draft / send / record response / classify / resolve / retry / hold
 * - forbidden: readiness check 없이 resolve_as_confirmed_ready (P0 fix)
 */

import type { AckFollowupHandoffGateV2, FollowupType } from "./ack-followup-handoff-gate-v2-engine";
import type { SupplierAckResolutionSessionV2, AckClassification } from "./supplier-acknowledgment-resolution-v2-engine";

export type FollowupWorkspaceStatus = "followup_pending" | "followup_in_progress" | "followup_sent" | "followup_response_received" | "followup_resolved_confirmed_ready" | "followup_resolved_exception" | "followup_hold" | "followup_timeout";

export interface AckFollowupWorkspaceStateV2 {
  workspaceId: string; caseId: string; sentStateRecordId: string; ackResolutionSessionId: string;
  workspaceStatus: FollowupWorkspaceStatus;
  ackClassification: AckClassification; followupType: FollowupType;
  followupReason: string; followupContent: string; followupSentAt: string | null; followupResponseAt: string | null;
  followupResponseContent: string; followupResponseClassification: AckClassification | null;
  canResolveAsConfirmedReady: boolean; canRouteToException: boolean; canRetryFollowup: boolean;
  nextHandoffTarget: "receiving_preparation_handoff" | "exception_recovery" | "retry_followup" | "hold";
  operatorNote: string; generatedAt: string;
}

export function buildAckFollowupWorkspaceStateV2(gate: AckFollowupHandoffGateV2, ackSession: SupplierAckResolutionSessionV2): AckFollowupWorkspaceStateV2 {
  return { workspaceId: `ackfws_${Date.now().toString(36)}`, caseId: ackSession.caseId, sentStateRecordId: ackSession.sentStateRecordId, ackResolutionSessionId: ackSession.ackResolutionSessionId, workspaceStatus: "followup_pending", ackClassification: ackSession.ackClassification, followupType: gate.recommendedFollowupType, followupReason: ackSession.followupReason, followupContent: "", followupSentAt: null, followupResponseAt: null, followupResponseContent: "", followupResponseClassification: null, canResolveAsConfirmedReady: false, canRouteToException: ackSession.exceptionRequired, canRetryFollowup: true, nextHandoffTarget: "hold", operatorNote: "", generatedAt: new Date().toISOString() };
}
