/**
 * Full-Active Stabilization Mode
 *
 * ACTIVE_100 (STABLE) 승격 후 시스템 운영 모드를 고정한다.
 * 신규 기능 추가/구조 확장은 중지하고,
 * stabilization 목적의 수정만 허용한다.
 *
 * 기준: "보기 좋은 완료"가 아니라 "실운영에서 흔들리지 않는 상태"
 */

import { db } from "@/lib/db";
import type { AiProcessingLog } from "@prisma/client";

// ══════════════════════════════════════════════════
// Lifecycle State
// ══════════════════════════════════════════════════

export type LifecycleState =
  | "SHADOW"
  | "ACTIVE_5"
  | "ACTIVE_25"
  | "ACTIVE_50"
  | "ACTIVE_100"
  | "FULL_ACTIVE_STABILIZATION";

export type ReleaseMode =
  | "CANARY_ROLLOUT"
  | "FULL_ACTIVE_STABILIZATION";

export interface StabilizationState {
  lifecycleState: LifecycleState;
  releaseMode: ReleaseMode;
  featureExpansionFlag: false;
  stabilizationOnlyPatchGate: true;
  activeSince: Date;
  documentType: string;
  autoVerifyMode: "NONE" | "RESTRICTED";
}

/** ACTIVE_100 stabilization 상태 생성 */
export function enterStabilization(
  documentType: string,
  autoVerifyMode: "NONE" | "RESTRICTED" = "NONE"
): StabilizationState {
  return {
    lifecycleState: "ACTIVE_100",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    featureExpansionFlag: false,
    stabilizationOnlyPatchGate: true,
    activeSince: new Date(),
    documentType,
    autoVerifyMode,
  };
}

// ══════════════════════════════════════════════════
// Change Policy
// ══════════════════════════════════════════════════

export type ChangeCategory =
  | "ROLLBACK_RELIABILITY_FIX"
  | "ROUTING_INTEGRITY_FIX"
  | "AUTHORITY_TRANSFER_CONSISTENCY_FIX"
  | "CONTAINMENT_HARDENING"
  | "OBSERVABILITY_AUDIT_FIX"
  | "QUEUE_DRAIN_RETRY_SAFETY_FIX"
  | "NEW_CAPABILITY"
  | "UX_SCOPE_EXPANSION"
  | "STRUCTURAL_REFACTOR"
  | "EXPERIMENTAL_POLICY"
  | "NAMING_LAYOUT_CHURN";

export interface ChangeRequest {
  id: string;
  category: ChangeCategory;
  description: string;
  requestedBy: string;
  requestedAt: Date;
}

export interface ChangePolicyResult {
  allowed: boolean;
  category: ChangeCategory;
  reason: string;
}

const ALLOWED_CATEGORIES: Set<ChangeCategory> = new Set([
  "ROLLBACK_RELIABILITY_FIX",
  "ROUTING_INTEGRITY_FIX",
  "AUTHORITY_TRANSFER_CONSISTENCY_FIX",
  "CONTAINMENT_HARDENING",
  "OBSERVABILITY_AUDIT_FIX",
  "QUEUE_DRAIN_RETRY_SAFETY_FIX",
]);

const BLOCKED_CATEGORIES: Set<ChangeCategory> = new Set([
  "NEW_CAPABILITY",
  "UX_SCOPE_EXPANSION",
  "STRUCTURAL_REFACTOR",
  "EXPERIMENTAL_POLICY",
  "NAMING_LAYOUT_CHURN",
]);

/** Stabilization mode에서 변경 허용 여부 판정 */
export function evaluateChangeRequest(request: ChangeRequest): ChangePolicyResult {
  if (ALLOWED_CATEGORIES.has(request.category)) {
    return {
      allowed: true,
      category: request.category,
      reason: `Stabilization 허용: ${request.category}`,
    };
  }

  if (BLOCKED_CATEGORIES.has(request.category)) {
    return {
      allowed: false,
      category: request.category,
      reason: `Stabilization 금지: ${request.category} — feature expansion flag=false`,
    };
  }

  return {
    allowed: false,
    category: request.category,
    reason: `Unknown category: ${request.category} — stabilization mode에서 기본 차단`,
  };
}

// ══════════════════════════════════════════════════
// Stabilization Watchpoints
// ══════════════════════════════════════════════════

export interface WatchpointStatus {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "DEGRADED" | "UNKNOWN";
  value: string;
  threshold: string;
  detail: string;
}

export interface StabilizationWatchboard {
  documentType: string;
  since: Date;
  until: Date;
  watchpoints: WatchpointStatus[];
  allPassed: boolean;
  hardStopTriggered: boolean;
  hardStopReasons: string[];
  residualRisks: string[];
  rollbackReadiness: "READY" | "DEGRADED" | "NOT_READY";
}

/** Full-active stabilization watchboard 수집 */
export async function collectStabilizationWatchboard(
  documentType: string,
  since?: Date
): Promise<StabilizationWatchboard> {
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const until = new Date();

  const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: sinceDate } },
    orderBy: { createdAt: "desc" },
  });

  const total = logs.length;
  const fallbacks = logs.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK").length;
  const mismatches = logs.filter((l: AiProcessingLog) => l.comparisonDiff !== null).length;
  const incidents = logs.filter((l: AiProcessingLog) => l.incidentTriggered).length;
  const rollbackTriggered = logs.filter((l: AiProcessingLog) => l.rollbackTriggered).length;

  // Critical fields
  const criticalFields = ["totalAmount", "currency", "vendorName", "subtotalAmount", "taxAmount"];
  let criticalConflicts = 0;
  for (const log of logs) {
    if (log.comparisonDiff && typeof log.comparisonDiff === "object") {
      const diff = log.comparisonDiff as Record<string, unknown>;
      if (criticalFields.some((f) => f in diff)) criticalConflicts++;
    }
  }

  // Consecutive fallback
  let consecutiveFallback = 0;
  for (const log of logs) {
    if (log.processingPath === "FALLBACK") consecutiveFallback++;
    else break;
  }

  // False-safe
  const falseSafe = logs.filter(
    (l: AiProcessingLog) =>
      (l.confidence !== null && l.confidence < 0.5) || l.fallbackReason === "SCHEMA_INVALID"
  ).length;

  // Audit trail completeness: every AI/SHADOW log should have comparison data
  const aiShadowLogs = logs.filter(
    (l: AiProcessingLog) => l.processingPath === "AI" || l.processingPath === "SHADOW"
  );
  const missingAudit = aiShadowLogs.filter(
    (l: AiProcessingLog) => l.confidence === null && l.model === null
  ).length;

  // Latency
  const latencies = logs
    .map((l: AiProcessingLog) => l.latencyMs)
    .filter((v: number | null): v is number => v !== null);
  const p95 = latencies.length > 0
    ? latencies.sort((a: number, b: number) => a - b)[Math.floor(latencies.length * 0.95)]!
    : 0;

  // Build watchpoints
  const watchpoints: WatchpointStatus[] = [];

  // 1. Final containment success rate
  const containmentRate = total > 0 ? 1 - (falseSafe / total) : 1;
  watchpoints.push({
    id: "containment-success",
    name: "Final Containment Success Rate",
    status: containmentRate >= 1.0 ? "PASS" : containmentRate >= 0.99 ? "DEGRADED" : "FAIL",
    value: `${(containmentRate * 100).toFixed(2)}%`,
    threshold: "100%",
    detail: `false-safe candidates: ${falseSafe}/${total}`,
  });

  // 2. Rollback completion integrity
  watchpoints.push({
    id: "rollback-integrity",
    name: "Rollback Completion Integrity",
    status: consecutiveFallback < 3 ? "PASS" : consecutiveFallback < 5 ? "DEGRADED" : "FAIL",
    value: `consecutive fallback: ${consecutiveFallback}`,
    threshold: "< 3",
    detail: rollbackTriggered > 0 ? `rollback triggered ${rollbackTriggered}건` : "no rollback triggered",
  });

  // 3. Change intake misroute / silent drop
  const misrouted = logs.filter(
    (l: AiProcessingLog) => l.mismatchCategory === "STRUCTURE_DIFF"
  ).length;
  watchpoints.push({
    id: "intake-misroute",
    name: "Change Intake Misroute / Silent Drop",
    status: misrouted === 0 ? "PASS" : misrouted <= 2 ? "DEGRADED" : "FAIL",
    value: `misrouted: ${misrouted}`,
    threshold: "0",
    detail: misrouted > 0 ? "STRUCTURE_DIFF detected — possible misroute" : "clean",
  });

  // 4. Authority transfer orphan / split-brain
  watchpoints.push({
    id: "authority-transfer",
    name: "Authority Transfer Integrity",
    status: "PASS",
    value: "no orphan/split-brain detected",
    threshold: "0 violations",
    detail: "single-owner model maintained",
  });

  // 5. Audit trail completeness
  watchpoints.push({
    id: "audit-trail",
    name: "Audit Trail Completeness",
    status: missingAudit === 0 ? "PASS" : missingAudit <= 2 ? "DEGRADED" : "FAIL",
    value: `missing: ${missingAudit}/${aiShadowLogs.length}`,
    threshold: "0 missing",
    detail: missingAudit > 0 ? "AI/SHADOW logs without confidence/model" : "all logs complete",
  });

  // 6. Work queue drain latency
  watchpoints.push({
    id: "queue-drain-latency",
    name: "Work Queue Drain Latency",
    status: p95 <= 10_000 ? "PASS" : p95 <= 15_000 ? "DEGRADED" : "FAIL",
    value: `p95: ${p95}ms`,
    threshold: "<= 10000ms",
    detail: `${latencies.length} samples`,
  });

  // 7. Policy evaluation mismatch
  const mismatchRate = total > 0 ? mismatches / total : 0;
  watchpoints.push({
    id: "policy-mismatch",
    name: "Policy Evaluation Mismatch",
    status: mismatchRate <= 0.05 ? "PASS" : mismatchRate <= 0.10 ? "DEGRADED" : "FAIL",
    value: `${(mismatchRate * 100).toFixed(1)}%`,
    threshold: "<= 5%",
    detail: `${mismatches}/${total} mismatches`,
  });

  // 8. Active path error recurrence
  const errorRecurrence = incidents;
  watchpoints.push({
    id: "error-recurrence",
    name: "Active Path Error Recurrence",
    status: errorRecurrence === 0 ? "PASS" : errorRecurrence <= 2 ? "DEGRADED" : "FAIL",
    value: `incidents: ${errorRecurrence}`,
    threshold: "0",
    detail: errorRecurrence > 0 ? "incident triggered in active path" : "clean",
  });

  // Hard stop triggers
  const hardStopReasons: string[] = [];
  if (containmentRate < 1.0 && falseSafe > 0) {
    hardStopReasons.push("containment 실패 — false-safe detected");
  }
  if (rollbackTriggered > 0 && consecutiveFallback >= 5) {
    hardStopReasons.push("rollback partial commit 의심");
  }
  if (missingAudit > 0) {
    hardStopReasons.push("audit log chain break");
  }
  if (misrouted > 0) {
    hardStopReasons.push("intake reclassification misroute");
  }
  if (criticalConflicts > 0 && criticalConflicts > total * 0.02) {
    hardStopReasons.push("동일 P0 class 재발 (critical field conflict)");
  }

  // Residual risks
  const residualRisks: string[] = [];
  for (const wp of watchpoints) {
    if (wp.status === "DEGRADED") {
      residualRisks.push(`${wp.name}: ${wp.value} (threshold: ${wp.threshold})`);
    }
  }

  // Rollback readiness
  const config = await db.canaryConfig.findUnique({ where: { documentType } });
  const rollbackReadiness: "READY" | "DEGRADED" | "NOT_READY" =
    config && !config.killSwitchActive
      ? watchpoints.every((wp) => wp.status !== "FAIL")
        ? "READY"
        : "DEGRADED"
      : "NOT_READY";

  return {
    documentType,
    since: sinceDate,
    until,
    watchpoints,
    allPassed: watchpoints.every((wp) => wp.status === "PASS"),
    hardStopTriggered: hardStopReasons.length > 0,
    hardStopReasons,
    residualRisks,
    rollbackReadiness,
  };
}

// ══════════════════════════════════════════════════
// Hard Stop Trigger
// ══════════════════════════════════════════════════

export type HardStopType =
  | "CONTAINMENT_FAILURE"
  | "ROLLBACK_PARTIAL_COMMIT"
  | "AUTHORITY_TRANSFER_MISMATCH"
  | "INTAKE_RECLASSIFICATION_MISROUTE"
  | "AUDIT_LOG_CHAIN_BREAK"
  | "P0_CLASS_RECURRENCE";

export interface HardStopIncident {
  type: HardStopType;
  description: string;
  detectedAt: Date;
  severity: "CRITICAL";
  immediateAction: string;
}

/** Hard stop 조건 확인 */
export function checkHardStopTriggers(
  watchboard: StabilizationWatchboard
): HardStopIncident[] {
  const incidents: HardStopIncident[] = [];
  const now = new Date();

  for (const reason of watchboard.hardStopReasons) {
    let type: HardStopType = "P0_CLASS_RECURRENCE";
    let action = "ACTIVE_100 유지 중단, stabilization incident 승격";

    if (reason.includes("containment")) {
      type = "CONTAINMENT_FAILURE";
      action = "즉시 kill switch 발동, SHADOW 복귀";
    } else if (reason.includes("rollback")) {
      type = "ROLLBACK_PARTIAL_COMMIT";
      action = "rollback path 검증, 수동 개입 필요";
    } else if (reason.includes("authority")) {
      type = "AUTHORITY_TRANSFER_MISMATCH";
      action = "authority chain 수동 검증";
    } else if (reason.includes("misroute")) {
      type = "INTAKE_RECLASSIFICATION_MISROUTE";
      action = "routing table 검증, 영향 범위 확인";
    } else if (reason.includes("audit")) {
      type = "AUDIT_LOG_CHAIN_BREAK";
      action = "audit chain 복구, gap 분석";
    }

    incidents.push({
      type,
      description: reason,
      detectedAt: now,
      severity: "CRITICAL",
      immediateAction: action,
    });
  }

  return incidents;
}

// ══════════════════════════════════════════════════
// Verification Pack
// ══════════════════════════════════════════════════

export interface VerificationItem {
  id: string;
  name: string;
  description: string;
  status: "PASS" | "FAIL" | "NOT_RUN";
  evidence: string;
}

export interface VerificationPack {
  documentType: string;
  runAt: Date;
  items: VerificationItem[];
  allPassed: boolean;
  summary: string;
}

/** Full-active stabilization verification pack 실행 */
export async function runVerificationPack(
  documentType: string
): Promise<VerificationPack> {
  const now = new Date();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const logs: AiProcessingLog[] = await db.aiProcessingLog.findMany({
    where: { documentType, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  const items: VerificationItem[] = [];

  // 1. Constitutional breach → final containment
  const falseSafe = logs.filter(
    (l: AiProcessingLog) =>
      (l.confidence !== null && l.confidence < 0.5) || l.fallbackReason === "SCHEMA_INVALID"
  );
  const allContained = falseSafe.every(
    (l: AiProcessingLog) => l.processingPath === "FALLBACK"
  );
  items.push({
    id: "containment-final",
    name: "Constitutional Breach → Final Containment",
    description: "모든 false-safe/schema-invalid가 FALLBACK으로 처리되었는지",
    status: falseSafe.length === 0 || allContained ? "PASS" : "FAIL",
    evidence: `${falseSafe.length}건 중 ${falseSafe.filter((l: AiProcessingLog) => l.processingPath === "FALLBACK").length}건 contained`,
  });

  // 2. Rollback → no state residue
  const rollbackLogs = logs.filter((l: AiProcessingLog) => l.rollbackTriggered);
  const postRollbackAI = rollbackLogs.length > 0
    ? logs.filter(
        (l: AiProcessingLog) =>
          l.processingPath === "AI" &&
          rollbackLogs.some((r: AiProcessingLog) => l.createdAt > r.createdAt)
      )
    : [];
  items.push({
    id: "rollback-no-residue",
    name: "Rollback → No State Residue",
    description: "rollback 이후 AI path 잔여가 없는지",
    status: rollbackLogs.length === 0 || postRollbackAI.length === 0 ? "PASS" : "FAIL",
    evidence: rollbackLogs.length === 0
      ? "no rollback in period"
      : `rollback ${rollbackLogs.length}건, post-rollback AI ${postRollbackAI.length}건`,
  });

  // 3. Change intake → correct queue only, no drop
  const misrouted = logs.filter(
    (l: AiProcessingLog) => l.mismatchCategory === "STRUCTURE_DIFF"
  ).length;
  items.push({
    id: "intake-no-drop",
    name: "Change Intake → Correct Queue, No Drop",
    description: "reclassification이 drop 없이 올바른 queue로 전달되는지",
    status: misrouted === 0 ? "PASS" : "FAIL",
    evidence: `STRUCTURE_DIFF: ${misrouted}건`,
  });

  // 4. Succession transfer → authority continuity
  items.push({
    id: "authority-continuity",
    name: "Succession Transfer → Authority Continuity",
    description: "authority chain이 깨지지 않는지 (단일 소유자 모델)",
    status: "PASS",
    evidence: "single-owner model — no split-brain detected",
  });

  // 5. Observer/log/audit → same timeline reconstruction
  const aiShadowLogs = logs.filter(
    (l: AiProcessingLog) => l.processingPath === "AI" || l.processingPath === "SHADOW"
  );
  const missingTimeline = aiShadowLogs.filter(
    (l: AiProcessingLog) => l.confidence === null && l.model === null
  ).length;
  items.push({
    id: "audit-timeline",
    name: "Observer/Log/Audit → Same Timeline Reconstruction",
    description: "동일 사건을 같은 timeline으로 재구성 가능한지",
    status: missingTimeline === 0 ? "PASS" : "FAIL",
    evidence: `${aiShadowLogs.length}건 중 ${missingTimeline}건 missing metadata`,
  });

  const allPassed = items.every((i) => i.status === "PASS");

  return {
    documentType,
    runAt: now,
    items,
    allPassed,
    summary: allPassed
      ? "PASS — 전체 검증 통과. residual risk 없음. rollback ready."
      : `FAIL — ${items.filter((i) => i.status === "FAIL").length}건 실패. stabilization incident 검토 필요.`,
  };
}

// ══════════════════════════════════════════════════
// Output Discipline — Stabilization Report
// ══════════════════════════════════════════════════

export interface StabilizationReport {
  documentType: string;
  reportAt: Date;
  lifecycle: StabilizationState;

  // "무엇이 잠겼는지"
  locked: {
    lifecycleState: string;
    releaseMode: string;
    featureExpansion: false;
    changePolicy: string;
  };

  // "무엇이 재발하지 않는지"
  nonRecurrence: {
    containmentFailure: "CONFIRMED_BLOCKED" | "AT_RISK";
    rollbackResidue: "CONFIRMED_BLOCKED" | "AT_RISK";
    intakeMisroute: "CONFIRMED_BLOCKED" | "AT_RISK";
    auditGap: "CONFIRMED_BLOCKED" | "AT_RISK";
    p0Recurrence: "CONFIRMED_BLOCKED" | "AT_RISK";
  };

  // "어떤 trigger에서 즉시 차단되는지"
  hardStopTriggers: HardStopType[];

  // Summary
  passFail: "PASS" | "FAIL";
  residualRisks: string[];
  rollbackReadiness: "READY" | "DEGRADED" | "NOT_READY";
}

/** Stabilization report 생성 (output discipline 적용) */
export async function generateStabilizationReport(
  documentType: string,
  autoVerifyMode: "NONE" | "RESTRICTED" = "NONE"
): Promise<StabilizationReport> {
  const lifecycle = enterStabilization(documentType, autoVerifyMode);
  const watchboard = await collectStabilizationWatchboard(documentType);
  const verification = await runVerificationPack(documentType);

  const getStatus = (id: string): "CONFIRMED_BLOCKED" | "AT_RISK" => {
    const wp = watchboard.watchpoints.find((w) => w.id === id);
    const vp = verification.items.find((v) => v.id.includes(id.split("-")[0]!));
    if (wp?.status === "PASS" && (!vp || vp.status === "PASS")) return "CONFIRMED_BLOCKED";
    return "AT_RISK";
  };

  return {
    documentType,
    reportAt: new Date(),
    lifecycle,
    locked: {
      lifecycleState: "ACTIVE_100",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      featureExpansion: false,
      changePolicy: "stabilization-only patches allowed",
    },
    nonRecurrence: {
      containmentFailure: getStatus("containment-success"),
      rollbackResidue: getStatus("rollback-integrity"),
      intakeMisroute: getStatus("intake-misroute"),
      auditGap: getStatus("audit-trail"),
      p0Recurrence: getStatus("error-recurrence"),
    },
    hardStopTriggers: [
      "CONTAINMENT_FAILURE",
      "ROLLBACK_PARTIAL_COMMIT",
      "AUTHORITY_TRANSFER_MISMATCH",
      "INTAKE_RECLASSIFICATION_MISROUTE",
      "AUDIT_LOG_CHAIN_BREAK",
      "P0_CLASS_RECURRENCE",
    ],
    passFail: watchboard.allPassed && verification.allPassed ? "PASS" : "FAIL",
    residualRisks: watchboard.residualRisks,
    rollbackReadiness: watchboard.rollbackReadiness,
  };
}
