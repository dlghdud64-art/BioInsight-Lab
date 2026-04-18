/**
 * Dispatch Exception / Recovery v2 Engine — 공용 recovery fabric
 *
 * ack / receiving / stock 어느 단계에서든 공통 recovery 브랜치로 빠질 수 있음.
 * retry와 manual resolution을 canonical reason code 기반으로 분리.
 */

export type ExceptionSourceStage = "dispatch_preparation" | "draft_assembly" | "send_confirmation" | "send_execution" | "actual_send_action" | "actual_send_transaction" | "actual_send_commit" | "actual_send_execution" | "actual_send_run" | "actual_send_execute" | "actual_send_fire" | "sent_outcome" | "delivery_tracking" | "supplier_acknowledgment" | "ack_followup" | "receiving_preparation" | "receiving_execution" | "receiving_variance_disposition" | "stock_release";

export type ExceptionType = "duplicate_send_risk" | "conflicting_supplier_response" | "delivery_mismatch" | "tracking_unavailable" | "receiving_shortage" | "receiving_damage" | "receiving_substitute_mismatch" | "mutation_partial_failure" | "invalid_state_transition" | "authorization_expired" | "payload_integrity_violation" | "internal_contamination_detected" | "supplier_declined" | "timeout_unresolved" | "system_failure" | "unknown";

export type RecoveryAction = "manual_resolution" | "retry_from_stage" | "escalate_to_supervisor" | "cancel_and_restart" | "partial_acceptance" | "return_to_supplier" | "hold_for_investigation" | "close_as_resolved" | "close_as_cancelled";

export interface DispatchExceptionRecordV2 {
  exceptionRecordId: string; caseId: string; sentStateRecordId: string | null;
  sourceStage: ExceptionSourceStage; exceptionType: ExceptionType;
  exceptionDetail: string; affectedLineSet: string[]; affectedQty: number;
  detectedAt: string; detectedBy: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "in_investigation" | "resolution_in_progress" | "resolved" | "cancelled" | "escalated";
  assignedTo: string; assignedAt: string | null;
  recoveryAction: RecoveryAction | null; recoveryReason: string;
  resolvedAt: string | null; resolvedBy: string | null;
  returnToStage: ExceptionSourceStage | null;
  auditTrail: ExceptionAuditEntry[];
}

export interface ExceptionAuditEntry { action: string; actor: string; timestamp: string; detail: string; previousStatus: string; nextStatus: string; }

export function createExceptionRecord(caseId: string, sentStateRecordId: string | null, sourceStage: ExceptionSourceStage, exceptionType: ExceptionType, detail: string, affectedLines: string[], severity: "critical" | "high" | "medium" | "low", actor: string): DispatchExceptionRecordV2 {
  const now = new Date().toISOString();
  return { exceptionRecordId: `excrc_${Date.now().toString(36)}`, caseId, sentStateRecordId, sourceStage, exceptionType, exceptionDetail: detail, affectedLineSet: affectedLines, affectedQty: 0, detectedAt: now, detectedBy: actor, severity, status: "open", assignedTo: actor, assignedAt: now, recoveryAction: null, recoveryReason: "", resolvedAt: null, resolvedBy: null, returnToStage: null, auditTrail: [{ action: "exception_created", actor, timestamp: now, detail: `${exceptionType} from ${sourceStage}`, previousStatus: "none", nextStatus: "open" }] };
}

export type ExceptionAction = "assign_exception" | "start_investigation" | "set_recovery_action" | "resolve_exception" | "escalate_exception" | "cancel_exception" | "return_to_stage";
export interface ExceptionActionPayload { action: ExceptionAction; assignTo?: string; recoveryAction?: RecoveryAction; recoveryReason?: string; returnToStage?: ExceptionSourceStage; reason?: string; actor: string; timestamp: string; }
export interface ExceptionMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedRecord: DispatchExceptionRecordV2; }

export function applyExceptionMutation(record: DispatchExceptionRecordV2, payload: ExceptionActionPayload): ExceptionMutationResultV2 {
  const now = payload.timestamp;
  const reject = (reason: string): ExceptionMutationResultV2 => ({ applied: false, rejectedReasonIfAny: reason, updatedRecord: record });
  let u = { ...record, auditTrail: [...record.auditTrail] };
  const addAudit = (action: string, detail: string, prev: string, next: string) => { u.auditTrail.push({ action, actor: payload.actor, timestamp: now, detail, previousStatus: prev, nextStatus: next }); };

  switch (payload.action) {
    case "assign_exception": { if (!payload.assignTo) return reject("AssignTo 필수"); const prev = u.status; u.assignedTo = payload.assignTo; u.assignedAt = now; addAudit("assigned", `Assigned to ${payload.assignTo}`, prev, u.status); break; }
    case "start_investigation": { const prev = u.status; u.status = "in_investigation"; addAudit("investigation_started", payload.reason || "", prev, u.status); break; }
    case "set_recovery_action": { if (!payload.recoveryAction) return reject("Recovery action 필수"); u.recoveryAction = payload.recoveryAction; u.recoveryReason = payload.recoveryReason || ""; u.status = "resolution_in_progress"; addAudit("recovery_action_set", `${payload.recoveryAction}: ${u.recoveryReason}`, "in_investigation", u.status); break; }
    case "resolve_exception": { u.status = "resolved"; u.resolvedAt = now; u.resolvedBy = payload.actor; addAudit("resolved", payload.reason || "", "resolution_in_progress", u.status); break; }
    case "escalate_exception": { u.status = "escalated"; addAudit("escalated", payload.reason || "", u.status, "escalated"); break; }
    case "cancel_exception": { u.status = "cancelled"; u.resolvedAt = now; u.resolvedBy = payload.actor; addAudit("cancelled", payload.reason || "", u.status, "cancelled"); break; }
    case "return_to_stage": {
      if (!payload.returnToStage) return reject("Return stage 필수");
      // P1 FIX: mandatory gate bypass guard — recovery가 필수 gate를 건너뛰지 못하게 제한.
      // 각 source stage에서 허용된 return target만 사용 가능.
      const ALLOWED_RETURN_TARGETS: Partial<Record<ExceptionSourceStage, ExceptionSourceStage[]>> = {
        stock_release: ["receiving_variance_disposition", "receiving_execution"],
        receiving_variance_disposition: ["receiving_execution", "receiving_preparation"],
        receiving_execution: ["receiving_preparation"],
        receiving_preparation: ["supplier_acknowledgment"],
        ack_followup: ["supplier_acknowledgment"],
        supplier_acknowledgment: ["delivery_tracking", "sent_outcome"],
        delivery_tracking: ["sent_outcome"],
        sent_outcome: ["actual_send_fire"],
        actual_send_fire: ["actual_send_execute"],
        actual_send_execute: ["actual_send_run"],
        actual_send_run: ["actual_send_execution"],
        actual_send_execution: ["actual_send_commit"],
        actual_send_commit: ["actual_send_transaction"],
        actual_send_transaction: ["actual_send_action"],
        actual_send_action: ["send_execution"],
        send_execution: ["send_confirmation"],
        send_confirmation: ["draft_assembly"],
        draft_assembly: ["dispatch_preparation"],
      };
      const allowedTargets = ALLOWED_RETURN_TARGETS[u.sourceStage];
      if (allowedTargets && !allowedTargets.includes(payload.returnToStage)) {
        return reject(`Return to ${payload.returnToStage} 불가 — ${u.sourceStage}에서 허용된 return target: ${allowedTargets.join(", ")}. Mandatory gate bypass 금지.`);
      }
      u.returnToStage = payload.returnToStage; u.status = "resolved"; u.resolvedAt = now; u.resolvedBy = payload.actor;
      addAudit("returned_to_stage", `Return to ${payload.returnToStage} (validated against allowed re-entry matrix)`, "resolution_in_progress", "resolved");
      break;
    }
    default: return reject(`Unknown action: ${payload.action}`);
  }
  return { applied: true, rejectedReasonIfAny: null, updatedRecord: u };
}
