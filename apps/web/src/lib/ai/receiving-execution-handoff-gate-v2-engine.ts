/**
 * Receiving Execution Handoff Gate v2 — prep ready → execution entry
 * prep_ready_for_execution일 때만 execution 진입. missing inputs 있으면 차단.
 */

import type { ReceivingPrepSessionV2, ReceivingPrepSessionStatus } from "./receiving-preparation-resolution-v2-engine";

export type ReceivingExecHandoffGateStatus = "not_eligible" | "prep_dependency_open" | "eligible_for_receiving_execution" | "receiving_execution_locked";

export interface ReceivingExecHandoffGateV2 {
  receivingExecHandoffGateId: string; caseId: string; sentStateRecordId: string; prepSessionId: string;
  gateStatus: ReceivingExecHandoffGateStatus;
  prepSessionStatus: ReceivingPrepSessionStatus; executionAllowed: boolean;
  blockers: string[]; warnings: string[];
  canOpenReceivingExecutionWorkspace: boolean;
  nextSurfaceLabel: string; generatedAt: string;
}

export function buildReceivingExecHandoffGateV2(prepSession: ReceivingPrepSessionV2): ReceivingExecHandoffGateV2 {
  const blockers: string[] = []; const warnings: string[] = [];
  if (prepSession.sessionStatus !== "prep_ready_for_execution") blockers.push(`Prep status: ${prepSession.sessionStatus}`);
  if (!prepSession.executionAllowed) blockers.push("Execution not allowed");
  if (prepSession.missingInputs.length > 0) blockers.push(`Missing: ${prepSession.missingInputs.join(", ")}`);
  if (prepSession.warnings.length > 0) warnings.push(...prepSession.warnings);

  const canOpen = blockers.length === 0 && prepSession.executionAllowed;
  const gateStatus: ReceivingExecHandoffGateStatus = !prepSession.executionAllowed ? "not_eligible" : blockers.length > 0 ? "prep_dependency_open" : "eligible_for_receiving_execution";

  return { receivingExecHandoffGateId: `rcvexhgate_${Date.now().toString(36)}`, caseId: prepSession.caseId, sentStateRecordId: prepSession.sentStateRecordId, prepSessionId: prepSession.prepSessionId, gateStatus, prepSessionStatus: prepSession.sessionStatus, executionAllowed: prepSession.executionAllowed, blockers, warnings, canOpenReceivingExecutionWorkspace: canOpen, nextSurfaceLabel: canOpen ? "Receiving Execution Workspace (Entry Enabled)" : "Receiving Execution Workspace (Locked)", generatedAt: new Date().toISOString() };
}
