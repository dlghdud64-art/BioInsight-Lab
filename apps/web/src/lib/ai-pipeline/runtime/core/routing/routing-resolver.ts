/**
 * S3 — Routing Resolver + Queue Writer + Dead Letter + Idempotency
 *
 * 단일 resolver → verified routing decision → queue write.
 * requestedDestination override 금지.
 * duplicate enqueue 금지.
 * silent drop 금지.
 */

import { randomUUID } from "crypto";
import type {
  CanonicalIntake,
  IntakeClassification,
  QueueDestination,
  RoutingDecisionObject,
  IntakeTerminalOutcome,
} from "../../types/stabilization";

// ── Classification → Destination Map ──

const DESTINATION_MAP: ReadonlyMap<IntakeClassification, QueueDestination> = new Map([
  ["STABILIZATION_VALIDATION", "STABILIZATION_QUEUE"],
  ["FINAL_CONTAINMENT", "CONTAINMENT_QUEUE"],
  ["EMERGENCY_ROLLBACK", "ROLLBACK_QUEUE"],
  ["AUDIT_RECONCILIATION", "AUDIT_QUEUE"],
  ["OBSERVABILITY_SYNC", "AUDIT_QUEUE"],
  ["INCIDENT_WORKFLOW", "INCIDENT_QUEUE"],
  ["READ_ONLY_STATUS", "STATUS_QUEUE"],
  ["DEAD_LETTER_CANDIDATE", "DEAD_LETTER_QUEUE"],
]);

const QUEUE_TOPOLOGY_WHITELIST: ReadonlySet<QueueDestination> = new Set([
  "STABILIZATION_QUEUE",
  "CONTAINMENT_QUEUE",
  "ROLLBACK_QUEUE",
  "AUDIT_QUEUE",
  "INCIDENT_QUEUE",
  "STATUS_QUEUE",
  "DEAD_LETTER_QUEUE",
]);

// ── Idempotency Store ──

const _processedIntakes = new Map<string, IntakeTerminalOutcome>();
const _queueReceipts = new Map<string, string>();

/** idempotency key 계산 */
export function computeIdempotencyKey(intake: CanonicalIntake): string {
  return `${intake.intakeId}`;
}

/** 이미 처리된 intake 여부 */
export function isAlreadyProcessed(intake: CanonicalIntake): IntakeTerminalOutcome | null {
  return _processedIntakes.get(computeIdempotencyKey(intake)) ?? null;
}

/** routing decision 생성 (verified resolver) */
export function buildRoutingDecision(
  intake: CanonicalIntake,
  classification: IntakeClassification,
  reasonCode: string,
  lifecycleState: string,
  releaseMode: string,
  policyVersion: string
): RoutingDecisionObject {
  // REJECTED_INTAKE → no queue
  if (classification === "REJECTED_INTAKE") {
    return {
      routingDecisionId: `rd-${randomUUID().slice(0, 8)}`,
      intakeId: intake.intakeId,
      classification,
      resolvedDestination: "DEAD_LETTER_QUEUE",
      decisionReason: "intake rejected by policy",
      reasonCode,
      decidedBy: "routing-resolver",
      decidedAt: new Date(),
      policyVersion,
      lifecycleState,
      releaseMode,
      isVerified: true,
      requiresDeadLetter: false, // rejected, not dead-lettered
      deadLetterReason: undefined,
    };
  }

  const destination = DESTINATION_MAP.get(classification) ?? "DEAD_LETTER_QUEUE";
  const isDeadLetter = destination === "DEAD_LETTER_QUEUE";

  return {
    routingDecisionId: `rd-${randomUUID().slice(0, 8)}`,
    intakeId: intake.intakeId,
    classification,
    resolvedDestination: destination,
    decisionReason: `classified as ${classification} → ${destination}`,
    reasonCode,
    decidedBy: "routing-resolver",
    decidedAt: new Date(),
    policyVersion,
    lifecycleState,
    releaseMode,
    isVerified: true,
    requiresDeadLetter: isDeadLetter,
    deadLetterReason: isDeadLetter ? `dead letter: ${reasonCode}` : undefined,
  };
}

// ── Queue Writer ──

export interface QueueWriteResult {
  success: boolean;
  queueReceiptId: string | null;
  terminalOutcome: IntakeTerminalOutcome;
  reasonCode: string;
}

/** verified routing decision 기반 queue write */
export function writeToQueue(decision: RoutingDecisionObject): QueueWriteResult {
  // Guard: isVerified 필수
  if (!decision.isVerified) {
    return {
      success: false,
      queueReceiptId: null,
      terminalOutcome: "REJECTED",
      reasonCode: "UNVERIFIED_ROUTING_WRITE_BLOCKED",
    };
  }

  // Guard: queue topology whitelist
  if (!QUEUE_TOPOLOGY_WHITELIST.has(decision.resolvedDestination)) {
    return {
      success: false,
      queueReceiptId: null,
      terminalOutcome: "REJECTED",
      reasonCode: "QUEUE_ALIAS_BYPASS_BLOCKED",
    };
  }

  // Guard: duplicate enqueue
  const existingOutcome = _processedIntakes.get(decision.intakeId);
  if (existingOutcome) {
    return {
      success: false,
      queueReceiptId: null,
      terminalOutcome: existingOutcome,
      reasonCode: "DUPLICATE_ENQUEUE_BLOCKED",
    };
  }

  // REJECTED_INTAKE → terminal outcome = REJECTED (no enqueue)
  if (decision.classification === "REJECTED_INTAKE") {
    _processedIntakes.set(decision.intakeId, "REJECTED");
    return {
      success: true,
      queueReceiptId: null,
      terminalOutcome: "REJECTED",
      reasonCode: "INTAKE_REJECTED",
    };
  }

  // Determine terminal outcome
  const terminalOutcome: IntakeTerminalOutcome =
    decision.resolvedDestination === "DEAD_LETTER_QUEUE" ? "DEAD_LETTERED" : "ENQUEUED";

  const receiptId = `receipt-${randomUUID().slice(0, 8)}`;
  _processedIntakes.set(decision.intakeId, terminalOutcome);
  _queueReceipts.set(decision.intakeId, receiptId);

  return {
    success: true,
    queueReceiptId: receiptId,
    terminalOutcome,
    reasonCode: terminalOutcome === "ENQUEUED" ? "QUEUE_WRITE_SUCCESS" : "DEAD_LETTER_WRITE_SUCCESS",
  };
}

/** post-classification immutability 검사 */
export function checkPostClassificationImmutability(
  original: RoutingDecisionObject,
  current: RoutingDecisionObject
): { immutable: boolean; reason: string } {
  if (original.classification !== current.classification) {
    return { immutable: false, reason: "POST_CLASSIFICATION_MUTATION_BLOCKED: classification changed" };
  }
  if (original.resolvedDestination !== current.resolvedDestination) {
    return { immutable: false, reason: "POST_CLASSIFICATION_MUTATION_BLOCKED: resolvedDestination changed" };
  }
  if (original.policyVersion !== current.policyVersion) {
    return { immutable: false, reason: "POST_CLASSIFICATION_MUTATION_BLOCKED: policyVersion changed" };
  }
  if (original.decisionReason !== current.decisionReason) {
    return { immutable: false, reason: "POST_CLASSIFICATION_MUTATION_BLOCKED: decisionReason changed" };
  }
  return { immutable: true, reason: "immutability intact" };
}

/** 테스트용 */
export function _resetRoutingState(): void {
  _processedIntakes.clear();
  _queueReceipts.clear();
}
