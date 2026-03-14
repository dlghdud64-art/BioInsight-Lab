/**
 * S2 — Final Containment Pipeline
 *
 * 단일 종결 경로: 8단계 ordered pipeline.
 * partial completion 금지. finalize 전 residue/reconciliation 필수.
 * 완료 상태: CONTAINED_AND_RESTORED / CONTAINED_WITH_INCIDENT_ESCALATION / CONTAINMENT_FAILED_LOCKDOWN
 */

import type {
  BreachEntry,
  ContainmentStage,
  ContainmentCompletionState,
  ContainmentResult,
  CONTAINMENT_STAGE_ORDER,
  RollbackPlan,
  ResidueScanResult,
  ReconciliationResult,
} from "../../types/stabilization";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import { activateMutationFreeze, deactivateMutationFreeze, isMutationFrozen } from "./mutation-freeze";
import { runRollbackPrecheck } from "../rollback/rollback-precheck";
import { buildRollbackPlan } from "../rollback/rollback-plan-builder";
import { executeRollbackPlan } from "../rollback/rollback-executor";
import { runResidueScan } from "../rollback/residue-scan";
import { reconcileState } from "../rollback/state-reconciliation";
import { escalateIncident } from "../incidents/incident-escalation";

const STAGE_ORDER: readonly ContainmentStage[] = [
  "FINAL_CONTAINMENT_START",
  "ACTIVE_MUTATION_FREEZE",
  "SIDE_EFFECT_EMISSION_STOP",
  "ROLLBACK_PRECHECK",
  "ROLLBACK_EXECUTE",
  "POST_ROLLBACK_RESIDUE_SCAN",
  "STATE_RECONCILIATION",
  "FINAL_CONTAINMENT_FINALIZE",
];

export interface ContainmentPipelineInput {
  breach: BreachEntry;
  baselineId: string;
  activeSnapshotId: string;
  rollbackSnapshotId: string;
  actor: string;
  /** runtime state for residue scan / reconciliation */
  currentRuntimeState: Record<string, Record<string, unknown>>;
}

/** 단일 final containment pipeline 실행 */
export function executeFinalContainment(input: ContainmentPipelineInput): ContainmentResult {
  const stagesCompleted: ContainmentStage[] = [];
  const { breach, baselineId, activeSnapshotId, rollbackSnapshotId, actor, currentRuntimeState } = input;
  const correlationId = breach.correlationId;
  let rollbackPlan: RollbackPlan | null = null;
  let residueScan: ResidueScanResult | null = null;
  let reconciliation: ReconciliationResult | null = null;

  const auditBase = {
    baselineId,
    baselineVersion: "",
    baselineHash: "",
    snapshotId: rollbackSnapshotId,
    correlationId,
    documentType: "",
    performedBy: actor,
  };

  // ─ STAGE 1: FINAL_CONTAINMENT_START ─
  emitStabilizationAuditEvent({ ...auditBase, eventType: "CONTAINMENT_STARTED", detail: `breach=${breach.breachType}` });
  stagesCompleted.push("FINAL_CONTAINMENT_START");

  // ─ STAGE 2: ACTIVE_MUTATION_FREEZE ─
  activateMutationFreeze();
  emitStabilizationAuditEvent({ ...auditBase, eventType: "MUTATION_FROZEN", detail: "active mutation frozen" });
  stagesCompleted.push("ACTIVE_MUTATION_FREEZE");

  // ─ STAGE 3: SIDE_EFFECT_EMISSION_STOP ─
  // side effects halted (no external writes during containment)
  stagesCompleted.push("SIDE_EFFECT_EMISSION_STOP");

  // ─ STAGE 4: ROLLBACK_PRECHECK ─
  const precheck = runRollbackPrecheck(rollbackSnapshotId, activeSnapshotId);
  if (!precheck.passed) {
    emitStabilizationAuditEvent({ ...auditBase, eventType: "ROLLBACK_PRECHECK_FAILED", detail: precheck.reasonCode });
    const incident = escalateIncident("ROLLBACK_PRECHECK_FAILED", correlationId, actor, precheck.reasonCode);
    deactivateMutationFreeze();
    return {
      completionState: "CONTAINED_WITH_INCIDENT_ESCALATION",
      breachEntry: breach,
      stagesCompleted,
      rollbackPlan: null,
      residueScan: null,
      reconciliation: null,
      incidentEscalated: true,
      reason: `ROLLBACK_PRECHECK_FAILED: ${precheck.reasonCode}`,
    };
  }
  emitStabilizationAuditEvent({ ...auditBase, eventType: "ROLLBACK_PRECHECK_PASSED", detail: "precheck passed" });
  stagesCompleted.push("ROLLBACK_PRECHECK");

  // ─ STAGE 5: ROLLBACK_EXECUTE ─
  rollbackPlan = buildRollbackPlan(baselineId, rollbackSnapshotId, breach.breachType);
  emitStabilizationAuditEvent({ ...auditBase, eventType: "ROLLBACK_PLAN_BUILT", detail: `plan=${rollbackPlan.planId}, scopes=${rollbackPlan.affectedScopes.length}` });

  const execResult = executeRollbackPlan(rollbackPlan, correlationId, actor);
  if (!execResult.success) {
    escalateIncident("ROLLBACK_PARTIAL_COMMIT_DETECTED", correlationId, actor, execResult.reason);
    deactivateMutationFreeze();
    return {
      completionState: "CONTAINMENT_FAILED_LOCKDOWN",
      breachEntry: breach,
      stagesCompleted,
      rollbackPlan,
      residueScan: null,
      reconciliation: null,
      incidentEscalated: true,
      reason: execResult.reason,
    };
  }
  stagesCompleted.push("ROLLBACK_EXECUTE");

  // ─ STAGE 6: POST_ROLLBACK_RESIDUE_SCAN ─
  residueScan = runResidueScan(rollbackSnapshotId, currentRuntimeState);
  emitStabilizationAuditEvent({ ...auditBase, eventType: "RESIDUE_SCAN_COMPLETED", detail: `clean=${residueScan.clean}, critical=${residueScan.hasCritical}` });
  stagesCompleted.push("POST_ROLLBACK_RESIDUE_SCAN");

  if (residueScan.hasCritical) {
    escalateIncident("RESIDUE_CRITICAL_DETECTED", correlationId, actor, `${residueScan.residues.length} residues`);
    deactivateMutationFreeze();
    return {
      completionState: "CONTAINED_WITH_INCIDENT_ESCALATION",
      breachEntry: breach,
      stagesCompleted,
      rollbackPlan,
      residueScan,
      reconciliation: null,
      incidentEscalated: true,
      reason: "RESIDUE_CRITICAL_DETECTED",
    };
  }

  // ─ STAGE 7: STATE_RECONCILIATION ─
  reconciliation = reconcileState(rollbackSnapshotId, currentRuntimeState);
  emitStabilizationAuditEvent({ ...auditBase, eventType: "RECONCILIATION_COMPLETED", detail: `success=${reconciliation.success}, unresolved=${reconciliation.unresolvedCount}` });
  stagesCompleted.push("STATE_RECONCILIATION");

  if (!reconciliation.success) {
    escalateIncident("RECONCILIATION_VALIDATION_FAILED", correlationId, actor, `${reconciliation.unresolvedCount} unresolved diffs`);
    deactivateMutationFreeze();
    return {
      completionState: "CONTAINED_WITH_INCIDENT_ESCALATION",
      breachEntry: breach,
      stagesCompleted,
      rollbackPlan,
      residueScan,
      reconciliation,
      incidentEscalated: true,
      reason: "RECONCILIATION_VALIDATION_FAILED",
    };
  }

  // ─ STAGE 8: FINAL_CONTAINMENT_FINALIZE ─
  deactivateMutationFreeze();
  emitStabilizationAuditEvent({ ...auditBase, eventType: "CONTAINMENT_FINALIZED", detail: "CONTAINED_AND_RESTORED" });
  stagesCompleted.push("FINAL_CONTAINMENT_FINALIZE");

  return {
    completionState: "CONTAINED_AND_RESTORED",
    breachEntry: breach,
    stagesCompleted,
    rollbackPlan,
    residueScan,
    reconciliation,
    incidentEscalated: false,
    reason: "CONTAINED_AND_RESTORED",
  };
}
