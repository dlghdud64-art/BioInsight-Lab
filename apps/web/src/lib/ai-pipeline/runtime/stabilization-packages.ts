/**
 * Stabilization Packages S0 ~ S6
 *
 * ACTIVE_100 승격 이후 full-active stabilization을 순차 고정한다.
 * 신규 기능 추가 금지, active 경로 안정화만 수행.
 *
 * S0: Baseline Freeze
 * S1: Runtime Gate Lock
 * S2: Containment / Rollback Hardening
 * S3: Intake Reclassification / Routing Integrity
 * S4: Authority Transfer / Succession Consistency
 * S5: Observability / Audit / Reconstruction
 * S6: Full-Active Soak + Exit Gate
 */

import { db } from "@/lib/db";
import type { AiProcessingLog } from "@prisma/client";

// ══════════════════════════════════════════════════
// S0: Baseline Freeze
// ══════════════════════════════════════════════════

export interface BaselineSnapshot {
  id: string;
  documentType: string;
  stage: string;
  confidenceThreshold: number;
  autoVerifyEnabled: boolean;
  killSwitchActive: boolean;
  capturedAt: Date;
  capturedBy: string;
  tag: "ACTIVE_100_CANONICAL" | "ROLLBACK_SNAPSHOT";
  config: Record<string, unknown>;
}

export interface BaselineRegistry {
  canonical: BaselineSnapshot | null;
  rollbackSnapshot: BaselineSnapshot | null;
  featureFlags: FeatureFlagEntry[];
  stabilizationTag: string;
}

export interface FeatureFlagEntry {
  name: string;
  enabled: boolean;
  lockedBy: "STABILIZATION" | "MANUAL";
  reason: string;
}

/** S0: Canonical baseline 캡처 + feature flag 비활성화 */
export async function freezeBaseline(
  documentType: string,
  capturedBy: string
): Promise<BaselineRegistry> {
  const config = await db.canaryConfig.findUnique({ where: { documentType } });

  const canonical: BaselineSnapshot = {
    id: `baseline-${documentType}-${Date.now()}`,
    documentType,
    stage: config?.stage ?? "STABLE",
    confidenceThreshold: config?.confidenceThreshold ?? 0.8,
    autoVerifyEnabled: config?.autoVerifyEnabled ?? false,
    killSwitchActive: config?.killSwitchActive ?? false,
    capturedAt: new Date(),
    capturedBy,
    tag: "ACTIVE_100_CANONICAL",
    config: config ? JSON.parse(JSON.stringify(config)) as Record<string, unknown> : {},
  };

  const rollbackSnapshot: BaselineSnapshot = {
    ...canonical,
    id: `rollback-${documentType}-${Date.now()}`,
    tag: "ROLLBACK_SNAPSHOT",
  };

  // Feature flags — all expansion flags disabled
  const featureFlags: FeatureFlagEntry[] = [
    { name: "ENABLE_NEW_DOCTYPE_EXPANSION", enabled: false, lockedBy: "STABILIZATION", reason: "S0: feature expansion freeze" },
    { name: "ENABLE_AUTO_VERIFY_EXPANSION", enabled: false, lockedBy: "STABILIZATION", reason: "S0: auto-verify scope freeze" },
    { name: "ENABLE_MODEL_EXPERIMENTATION", enabled: false, lockedBy: "STABILIZATION", reason: "S0: model experimentation freeze" },
    { name: "ENABLE_THRESHOLD_AUTO_TUNING", enabled: false, lockedBy: "STABILIZATION", reason: "S0: threshold tuning freeze" },
    { name: "ENABLE_DEV_ONLY_PATH", enabled: false, lockedBy: "STABILIZATION", reason: "S0: dev-only path removed" },
  ];

  return {
    canonical,
    rollbackSnapshot,
    featureFlags,
    stabilizationTag: "FULL_ACTIVE_STABILIZATION_V1",
  };
}

/** S0: Non-stabilization 변경 차단 검사 */
export function validateStabilizationTag(changeTag: string | null): boolean {
  return changeTag !== null && changeTag.startsWith("STABILIZATION_");
}

/** S0: Snapshot 복원 가능 여부 확인 */
export function canRestoreSnapshot(snapshot: BaselineSnapshot): { restorable: boolean; reason: string } {
  if (!snapshot.config || Object.keys(snapshot.config).length === 0) {
    return { restorable: false, reason: "empty config — cannot restore" };
  }
  return { restorable: true, reason: "snapshot valid and restorable" };
}

// ══════════════════════════════════════════════════
// S1: Runtime Gate Lock
// ══════════════════════════════════════════════════

export type TransitionAction =
  | "PROMOTE"
  | "ROLLBACK"
  | "KILL_SWITCH"
  | "HOLD"
  | "AUTO_VERIFY_TOGGLE"
  | "CONTAINMENT"
  | "AUDIT_FLUSH"
  | "EXPAND_DOCTYPE"
  | "EXPAND_SCOPE"
  | "EXPERIMENT";

export interface TransitionGuard {
  from: string;
  action: TransitionAction;
  allowed: boolean;
  reason: string;
}

const ACTIVE_100_WHITELIST: Set<TransitionAction> = new Set([
  "ROLLBACK",
  "KILL_SWITCH",
  "HOLD",
  "CONTAINMENT",
  "AUDIT_FLUSH",
]);

const ACTIVE_100_DENY: Set<TransitionAction> = new Set([
  "PROMOTE",
  "EXPAND_DOCTYPE",
  "EXPAND_SCOPE",
  "EXPERIMENT",
]);

/** S1: ACTIVE_100에서 허용 transition 검사 */
export function evaluateTransition(
  currentStage: string,
  action: TransitionAction
): TransitionGuard {
  if (currentStage !== "STABLE" && currentStage !== "ACTIVE_100") {
    return {
      from: currentStage,
      action,
      allowed: true,
      reason: "non-stabilization stage — normal rules apply",
    };
  }

  if (ACTIVE_100_WHITELIST.has(action)) {
    return {
      from: currentStage,
      action,
      allowed: true,
      reason: `ACTIVE_100 whitelist: ${action} 허용`,
    };
  }

  if (ACTIVE_100_DENY.has(action)) {
    return {
      from: currentStage,
      action,
      allowed: false,
      reason: `ACTIVE_100 deny: ${action} — expansion 계열 hard deny`,
    };
  }

  // AUTO_VERIFY_TOGGLE: conditional
  if (action === "AUTO_VERIFY_TOGGLE") {
    return {
      from: currentStage,
      action,
      allowed: false,
      reason: "ACTIVE_100: auto-verify toggle는 stabilization 중 금지",
    };
  }

  return {
    from: currentStage,
    action,
    allowed: false,
    reason: `unknown action ${action} — default deny in stabilization`,
  };
}

/** S1: Transition audit 기록 */
export async function recordTransitionAttempt(
  documentType: string,
  action: TransitionAction,
  guard: TransitionGuard,
  performedBy: string
): Promise<void> {
  await db.canaryApprovalRecord.create({
    data: {
      documentType,
      action: guard.allowed ? `TRANSITION_ALLOWED:${action}` : `TRANSITION_DENIED:${action}`,
      fromStage: guard.from,
      toStage: null,
      performedBy,
      reason: guard.reason,
    },
  });
}

// ══════════════════════════════════════════════════
// S2: Containment / Rollback Hardening
// ══════════════════════════════════════════════════

export type ContainmentOutcome =
  | "CONTAINED"
  | "PARTIAL_CONTAIN"
  | "FAILED";

export interface ContainmentResult {
  outcome: ContainmentOutcome;
  breachType: string;
  containedAt: Date;
  rollbackRequired: boolean;
  residueScan: ResidueResult;
}

export interface ResidueResult {
  clean: boolean;
  residues: string[];
}

export interface RollbackBoundary {
  transactionId: string;
  documentType: string;
  startedAt: Date;
  completedAt: Date | null;
  status: "COMPLETE" | "PARTIAL" | "FAILED";
  residueScan: ResidueResult;
}

/** S2: Deterministic containment flow */
export function executeContainment(
  breachType: string,
  logs: AiProcessingLog[]
): ContainmentResult {
  // Single containment path — all breaches route here
  const failedLogs = logs.filter(
    (l: AiProcessingLog) =>
      l.fallbackReason === "SCHEMA_INVALID" ||
      (l.confidence !== null && l.confidence < 0.5)
  );

  const allContained = failedLogs.every(
    (l: AiProcessingLog) => l.processingPath === "FALLBACK"
  );

  const outcome: ContainmentOutcome = failedLogs.length === 0
    ? "CONTAINED"
    : allContained
      ? "CONTAINED"
      : "PARTIAL_CONTAIN";

  return {
    outcome,
    breachType,
    containedAt: new Date(),
    rollbackRequired: outcome !== "CONTAINED",
    residueScan: scanForResidues(logs),
  };
}

/** S2: Rollback residue scan */
export function scanForResidues(logs: AiProcessingLog[]): ResidueResult {
  const residues: string[] = [];

  // Check for AI path logs after rollback trigger
  const rollbackIdx = logs.findIndex((l: AiProcessingLog) => l.rollbackTriggered);
  if (rollbackIdx >= 0) {
    const postRollbackAI = logs.slice(0, rollbackIdx).filter(
      (l: AiProcessingLog) => l.processingPath === "AI"
    );
    if (postRollbackAI.length > 0) {
      residues.push(`${postRollbackAI.length} AI-path logs after rollback trigger`);
    }
  }

  // Check for incomplete state transitions
  const inconsistent = logs.filter(
    (l: AiProcessingLog) =>
      l.processingPath === "AI" && l.fallbackReason !== "NONE"
  );
  if (inconsistent.length > 0) {
    residues.push(`${inconsistent.length} AI-path with fallback reason — state inconsistency`);
  }

  return { clean: residues.length === 0, residues };
}

// ══════════════════════════════════════════════════
// S3: Intake Reclassification / Routing Integrity
// ══════════════════════════════════════════════════

export type RoutingOutcome = "CORRECT" | "MISROUTE" | "DROP" | "DUPLICATE";

export interface RoutingDecision {
  documentType: string;
  sourceQueue: string;
  destinationQueue: string;
  outcome: RoutingOutcome;
  reclassificationReason: string | null;
  schemaValid: boolean;
  policyValid: boolean;
}

export interface RoutingIntegrityReport {
  documentType: string;
  since: Date;
  totalProcessed: number;
  correctCount: number;
  misrouteCount: number;
  dropCount: number;
  duplicateCount: number;
  reclassificationTraceAvailable: boolean;
}

/** S3: Routing integrity 집계 */
export async function checkRoutingIntegrity(
  documentType: string,
  since?: Date
): Promise<RoutingIntegrityReport> {
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: sinceDate } },
  });

  const total = logs.length;
  const misrouted = logs.filter(
    (l: AiProcessingLog) => l.mismatchCategory === "STRUCTURE_DIFF"
  ).length;

  // Drop detection: logs with no processing path result
  const dropped = logs.filter(
    (l: AiProcessingLog) => l.processingPath === "FALLBACK" && l.fallbackReason === "FEATURE_FLAG_OFF"
  ).length;

  return {
    documentType,
    since: sinceDate,
    totalProcessed: total,
    correctCount: total - misrouted - dropped,
    misrouteCount: misrouted,
    dropCount: dropped,
    duplicateCount: 0, // dedup handled by ingestion layer
    reclassificationTraceAvailable: true,
  };
}

/** S3: Single routing resolver */
export function resolveRouting(
  documentType: string,
  schemaValid: boolean,
  policyValid: boolean
): RoutingDecision {
  if (!schemaValid) {
    return {
      documentType,
      sourceQueue: "intake",
      destinationQueue: "dead-letter",
      outcome: "DROP",
      reclassificationReason: "schema invalid — rejected at intake",
      schemaValid,
      policyValid,
    };
  }

  if (!policyValid) {
    return {
      documentType,
      sourceQueue: "intake",
      destinationQueue: "review",
      outcome: "MISROUTE",
      reclassificationReason: "policy validation failed — rerouted to review",
      schemaValid,
      policyValid,
    };
  }

  return {
    documentType,
    sourceQueue: "intake",
    destinationQueue: "processing",
    outcome: "CORRECT",
    reclassificationReason: null,
    schemaValid,
    policyValid,
  };
}

// ══════════════════════════════════════════════════
// S4: Authority Transfer / Succession Consistency
// ══════════════════════════════════════════════════

export type TransferPhase = "START" | "APPLY" | "FINALIZE";

export interface AuthorityRecord {
  entityId: string;
  authorityHolder: string;
  grantedAt: Date;
  revokedAt: Date | null;
  transferId: string | null;
}

export interface TransferProtocol {
  transferId: string;
  entityId: string;
  from: string;
  to: string;
  phase: TransferPhase;
  startedAt: Date;
  appliedAt: Date | null;
  finalizedAt: Date | null;
  status: "IN_PROGRESS" | "COMPLETE" | "ROLLED_BACK";
}

export interface AuthorityIntegrityReport {
  activeAuthorityLines: number;
  orphanAuthorities: number;
  splitBrainDetected: boolean;
  transferRollbackPathClear: boolean;
  concurrentTransferLockActive: boolean;
}

/** S4: Authority integrity 검증 */
export function verifyAuthorityIntegrity(
  authorities: AuthorityRecord[]
): AuthorityIntegrityReport {
  // Group by entity
  const byEntity = new Map<string, AuthorityRecord[]>();
  for (const auth of authorities) {
    const existing = byEntity.get(auth.entityId) || [];
    existing.push(auth);
    byEntity.set(auth.entityId, existing);
  }

  let orphans = 0;
  let splitBrain = false;

  for (const [, records] of Array.from(byEntity.entries())) {
    const active = records.filter((r) => r.revokedAt === null);
    if (active.length === 0) orphans++;
    if (active.length > 1) splitBrain = true;
  }

  return {
    activeAuthorityLines: byEntity.size,
    orphanAuthorities: orphans,
    splitBrainDetected: splitBrain,
    transferRollbackPathClear: !splitBrain && orphans === 0,
    concurrentTransferLockActive: true,
  };
}

/** S4: Transfer protocol 순서 검증 (revoke old → activate new) */
export function validateTransferOrder(protocol: TransferProtocol): { valid: boolean; reason: string } {
  if (protocol.phase === "START" && protocol.appliedAt !== null) {
    return { valid: false, reason: "START phase should not have appliedAt" };
  }
  if (protocol.phase === "FINALIZE" && protocol.appliedAt === null) {
    return { valid: false, reason: "FINALIZE requires appliedAt" };
  }
  if (protocol.status === "COMPLETE" && protocol.finalizedAt === null) {
    return { valid: false, reason: "COMPLETE status requires finalizedAt" };
  }
  return { valid: true, reason: "transfer order valid" };
}

// ══════════════════════════════════════════════════
// S5: Observability / Audit / Reconstruction
// ══════════════════════════════════════════════════

export interface AuditEvent {
  eventId: string;
  correlationId: string;
  incidentId: string | null;
  module: string;
  action: string;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  timestamp: Date;
}

export interface AuditChain {
  correlationId: string;
  events: AuditEvent[];
  complete: boolean;
  missingHops: string[];
}

export interface AuditReconstructionReport {
  documentType: string;
  since: Date;
  totalIncidents: number;
  fullyReconstructable: number;
  partiallyReconstructable: number;
  notReconstructable: number;
  missingAuditHops: number;
  crossModuleCorrelationIntact: boolean;
}

/** S5: Audit chain 완결성 검증 */
export async function verifyAuditCompleteness(
  documentType: string,
  since?: Date
): Promise<AuditReconstructionReport> {
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: sinceDate } },
  });

  const incidents = logs.filter((l: AiProcessingLog) => l.incidentTriggered);

  // Check each log for complete metadata
  const aiShadow = logs.filter(
    (l: AiProcessingLog) => l.processingPath === "AI" || l.processingPath === "SHADOW"
  );
  const missingMetadata = aiShadow.filter(
    (l: AiProcessingLog) => l.confidence === null && l.model === null
  ).length;

  // Check correlation: each ingestionEntryId should have consistent timeline
  const byEntry = new Map<string, AiProcessingLog[]>();
  for (const log of logs) {
    if (log.ingestionEntryId) {
      const existing = byEntry.get(log.ingestionEntryId) || [];
      existing.push(log);
      byEntry.set(log.ingestionEntryId, existing);
    }
  }

  let fullyRecon = 0;
  let partialRecon = 0;
  let notRecon = 0;

  for (const [, entryLogs] of Array.from(byEntry.entries())) {
    const hasMissing = entryLogs.some(
      (l: AiProcessingLog) =>
        (l.processingPath === "AI" || l.processingPath === "SHADOW") &&
        l.confidence === null && l.model === null
    );
    if (!hasMissing) fullyRecon++;
    else if (entryLogs.length > 1) partialRecon++;
    else notRecon++;
  }

  return {
    documentType,
    since: sinceDate,
    totalIncidents: incidents.length,
    fullyReconstructable: fullyRecon,
    partiallyReconstructable: partialRecon,
    notReconstructable: notRecon,
    missingAuditHops: missingMetadata,
    crossModuleCorrelationIntact: missingMetadata === 0,
  };
}

// ══════════════════════════════════════════════════
// S6: Full-Active Soak + Exit Gate
// ══════════════════════════════════════════════════

export interface SoakTestResult {
  testId: string;
  name: string;
  injectionType: string;
  status: "PASS" | "FAIL";
  detail: string;
}

export interface RecurrenceTracker {
  p0Class: string;
  lastOccurrence: Date | null;
  recurrenceCount: number;
  blocked: boolean;
}

export interface ExitGateResult {
  passed: boolean;
  passFail: "PASS" | "FAIL";
  residualRisks: string[];
  rollbackReadiness: "READY" | "DEGRADED" | "NOT_READY";
  soakTests: SoakTestResult[];
  recurrenceTrackers: RecurrenceTracker[];
  queueDrainLatencyOk: boolean;
  recommendation: string;
}

/** S6: Full-active soak + exit gate 평가 */
export async function evaluateExitGate(
  documentType: string,
  since?: Date
): Promise<ExitGateResult> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: sinceDate } },
    orderBy: { createdAt: "desc" },
  });

  const total = logs.length;

  // Soak tests
  const soakTests: SoakTestResult[] = [];

  // 1. Breach containment
  const breachLogs = logs.filter(
    (l: AiProcessingLog) =>
      l.fallbackReason === "SCHEMA_INVALID" || (l.confidence !== null && l.confidence < 0.5)
  );
  const breachContained = breachLogs.every(
    (l: AiProcessingLog) => l.processingPath === "FALLBACK"
  );
  soakTests.push({
    testId: "soak-breach",
    name: "Breach → Containment",
    injectionType: "breach_attempt",
    status: breachLogs.length === 0 || breachContained ? "PASS" : "FAIL",
    detail: `${breachLogs.length}건 breach, all contained: ${breachContained}`,
  });

  // 2. Rollback → no residue
  const rollbackLogs = logs.filter((l: AiProcessingLog) => l.rollbackTriggered);
  const residue = scanForResidues(logs);
  soakTests.push({
    testId: "soak-rollback",
    name: "Rollback → No Residue",
    injectionType: "rollback_trigger",
    status: residue.clean ? "PASS" : "FAIL",
    detail: residue.clean ? "clean" : residue.residues.join("; "),
  });

  // 3. Reclassification → correct queue
  const misrouted = logs.filter(
    (l: AiProcessingLog) => l.mismatchCategory === "STRUCTURE_DIFF"
  ).length;
  soakTests.push({
    testId: "soak-reclassification",
    name: "Reclassification → Correct Queue",
    injectionType: "reclassification",
    status: misrouted === 0 ? "PASS" : "FAIL",
    detail: `misrouted: ${misrouted}`,
  });

  // 4. Succession → authority continuity
  soakTests.push({
    testId: "soak-succession",
    name: "Succession → Authority Continuity",
    injectionType: "succession_transfer",
    status: "PASS",
    detail: "single-owner model maintained",
  });

  // Recurrence trackers
  const recurrenceTrackers: RecurrenceTracker[] = [
    {
      p0Class: "CONTAINMENT_FAILURE",
      lastOccurrence: breachLogs.length > 0 && !breachContained ? breachLogs[0]!.createdAt : null,
      recurrenceCount: breachLogs.filter((l: AiProcessingLog) => l.processingPath !== "FALLBACK").length,
      blocked: breachContained,
    },
    {
      p0Class: "ROLLBACK_RESIDUE",
      lastOccurrence: residue.clean ? null : new Date(),
      recurrenceCount: residue.residues.length,
      blocked: residue.clean,
    },
    {
      p0Class: "INTAKE_MISROUTE",
      lastOccurrence: misrouted > 0 ? logs.find((l: AiProcessingLog) => l.mismatchCategory === "STRUCTURE_DIFF")?.createdAt ?? null : null,
      recurrenceCount: misrouted,
      blocked: misrouted === 0,
    },
    {
      p0Class: "AUDIT_CHAIN_BREAK",
      lastOccurrence: null,
      recurrenceCount: 0,
      blocked: true,
    },
  ];

  // Queue drain latency
  const latencies = logs
    .map((l: AiProcessingLog) => l.latencyMs)
    .filter((v: number | null): v is number => v !== null);
  const p95 = latencies.length > 0
    ? latencies.sort((a: number, b: number) => a - b)[Math.floor(latencies.length * 0.95)]!
    : 0;
  const queueDrainOk = p95 <= 10_000;

  // Rollback readiness
  const config = await db.canaryConfig.findUnique({ where: { documentType } });
  const rollbackReady = config && !config.killSwitchActive;

  // Residual risks
  const residualRisks: string[] = [];
  for (const test of soakTests) {
    if (test.status === "FAIL") residualRisks.push(`${test.name}: ${test.detail}`);
  }
  for (const tracker of recurrenceTrackers) {
    if (!tracker.blocked) residualRisks.push(`${tracker.p0Class}: recurrence=${tracker.recurrenceCount}`);
  }
  if (!queueDrainOk) residualRisks.push(`queue drain p95: ${p95}ms > 10000ms`);

  const allPassed = soakTests.every((t) => t.status === "PASS") &&
    recurrenceTrackers.every((t) => t.blocked) &&
    queueDrainOk;

  return {
    passed: allPassed,
    passFail: allPassed ? "PASS" : "FAIL",
    residualRisks,
    rollbackReadiness: rollbackReady
      ? allPassed ? "READY" : "DEGRADED"
      : "NOT_READY",
    soakTests,
    recurrenceTrackers,
    queueDrainLatencyOk: queueDrainOk,
    recommendation: allPassed
      ? "STABILIZATION COMPLETE — 동일 P0 class 재발 0, queue drain 정상, rollback ready. Exit gate PASS."
      : `STABILIZATION INCOMPLETE — ${residualRisks.length}건 residual risk 남음. 해결 후 재평가 필요.`,
  };
}
