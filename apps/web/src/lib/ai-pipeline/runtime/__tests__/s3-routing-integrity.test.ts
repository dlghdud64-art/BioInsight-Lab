/**
 * S3 — Intake / Routing Integrity 테스트
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { normalizeIntake } from "../core/intake/intake-normalizer";
import { validateSchema } from "../core/intake/schema-validator";
import { validatePolicy } from "../core/intake/policy-validator";
import { classifyIntake } from "../core/intake/canonical-classifier";
import {
  buildRoutingDecision,
  writeToQueue,
  checkPostClassificationImmutability,
  isAlreadyProcessed,
  _resetRoutingState,
} from "../core/routing/routing-resolver";
import type { CanonicalIntake } from "../types/stabilization";

function makeIntake(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    intakeId: "intake-001",
    intakeType: "QUOTE",
    sourceChannel: "api",
    requestedAction: "STABILIZATION_VALIDATION_RUN",
    actor: "ops",
    payloadChecksum: "abc12345def",
    correlationId: "cor-001",
    schemaVersion: "1.0",
    requestedPriority: "normal",
    ...overrides,
  };
}

function makeCanonicalIntake(overrides?: Partial<CanonicalIntake>): CanonicalIntake {
  return {
    intakeId: "intake-001",
    intakeType: "QUOTE",
    sourceChannel: "api",
    requestedAction: "STABILIZATION_VALIDATION_RUN",
    actor: "ops",
    payloadChecksum: "abc12345def",
    correlationId: "cor-001",
    receivedAt: new Date(),
    schemaVersion: "1.0",
    requestedPriority: "normal",
    ...overrides,
  };
}

describe("S3: Intake / Routing Integrity", () => {
  beforeEach(() => {
    _resetRoutingState();
  });

  // 1. intake normalization required fields test
  it("should reject intake with missing required fields", () => {
    const result = normalizeIntake({ intakeId: "x" });
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("INTAKE_REQUIRED_FIELD_MISSING");
    expect(result.missingFields.length).toBeGreaterThan(0);
  });

  // 2. schema invalid intake blocked before routing test
  it("should block intake with invalid schema before routing", () => {
    const intake = makeCanonicalIntake({ intakeType: "UNKNOWN_TYPE" });
    const result = validateSchema(intake);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("INTAKE_SCHEMA_INVALID");
  });

  // 3. policy invalid intake blocked before verified routing test
  it("should block policy-violating action", () => {
    const intake = makeCanonicalIntake({ requestedAction: "FEATURE_ENABLE" });
    const result = validatePolicy(intake, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION");
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("ACTION_NOT_ALLOWED_BY_STABILIZATION_POLICY");
  });

  // 4. classifier returns exactly one classification test
  it("should return exactly one classification", () => {
    const intake = makeCanonicalIntake();
    const result = classifyIntake(intake, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION");
    expect(result.classification).toBe("STABILIZATION_VALIDATION");
    expect(typeof result.classification).toBe("string");
  });

  // 5. routing decision required before queue write test
  it("should require verified routing decision for queue write", () => {
    const intake = makeCanonicalIntake();
    const decision = buildRoutingDecision(
      intake,
      "STABILIZATION_VALIDATION",
      "CLASSIFIED_BY_MAP",
      "ACTIVE_100",
      "FULL_ACTIVE_STABILIZATION",
      "v1"
    );
    expect(decision.isVerified).toBe(true);
    const result = writeToQueue(decision);
    expect(result.success).toBe(true);
    expect(result.terminalOutcome).toBe("ENQUEUED");
  });

  // 6. exactly one destination enforced test
  it("should resolve to exactly one queue destination", () => {
    const intake = makeCanonicalIntake({ requestedAction: "AUDIT_FLUSH" });
    const cls = classifyIntake(intake, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION");
    const decision = buildRoutingDecision(intake, cls.classification, cls.reasonCode, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    expect(decision.resolvedDestination).toBe("AUDIT_QUEUE");
  });

  // 7. duplicate enqueue blocked test
  it("should block duplicate enqueue", () => {
    const intake = makeCanonicalIntake();
    const decision = buildRoutingDecision(intake, "STABILIZATION_VALIDATION", "TEST", "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    writeToQueue(decision);
    const result2 = writeToQueue(decision);
    expect(result2.success).toBe(false);
    expect(result2.reasonCode).toBe("DUPLICATE_ENQUEUE_BLOCKED");
  });

  // 8. silent drop blocked by terminal outcome contract test
  it("should always produce terminal outcome", () => {
    const intake = makeCanonicalIntake();
    const decision = buildRoutingDecision(intake, "STABILIZATION_VALIDATION", "TEST", "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    const result = writeToQueue(decision);
    expect(["ENQUEUED", "DEAD_LETTERED", "REJECTED"]).toContain(result.terminalOutcome);
  });

  // 9. unverified routing write blocked test
  it("should block unverified routing write", () => {
    const intake = makeCanonicalIntake();
    const decision = buildRoutingDecision(intake, "STABILIZATION_VALIDATION", "TEST", "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    decision.isVerified = false; // tamper
    const result = writeToQueue(decision);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("UNVERIFIED_ROUTING_WRITE_BLOCKED");
  });

  // 10. requested destination override ignored test
  it("should ignore requestedDestination in favor of verified resolver", () => {
    const intake = makeCanonicalIntake({ requestedDestination: "SOME_CUSTOM_QUEUE" });
    const cls = classifyIntake(intake, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION");
    const decision = buildRoutingDecision(intake, cls.classification, cls.reasonCode, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    // resolver decides, not requestedDestination
    expect(decision.resolvedDestination).not.toBe("SOME_CUSTOM_QUEUE");
    expect(decision.resolvedDestination).toBe("STABILIZATION_QUEUE");
  });

  // 11. dead-letter preserves trace test
  it("should dead-letter unknown action with reason", () => {
    const intake = makeCanonicalIntake({ requestedAction: "TOTALLY_UNKNOWN_ACTION" });
    const cls = classifyIntake(intake, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION");
    expect(cls.classification).toBe("DEAD_LETTER_CANDIDATE");
    const decision = buildRoutingDecision(intake, cls.classification, cls.reasonCode, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    expect(decision.resolvedDestination).toBe("DEAD_LETTER_QUEUE");
    expect(decision.requiresDeadLetter).toBe(true);
    expect(decision.deadLetterReason).toBeTruthy();
  });

  // 12. post-classification mutation blocked test
  it("should detect post-classification mutation", () => {
    const intake = makeCanonicalIntake();
    const original = buildRoutingDecision(intake, "STABILIZATION_VALIDATION", "TEST", "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    const tampered = { ...original, classification: "EMERGENCY_ROLLBACK" as any };
    const check = checkPostClassificationImmutability(original, tampered);
    expect(check.immutable).toBe(false);
    expect(check.reason).toContain("POST_CLASSIFICATION_MUTATION_BLOCKED");
  });

  // 13. queue alias bypass blocked test
  it("should block writes to non-whitelisted queue", () => {
    const intake = makeCanonicalIntake();
    const decision = buildRoutingDecision(intake, "STABILIZATION_VALIDATION", "TEST", "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    decision.resolvedDestination = "HACKED_QUEUE" as any;
    const result = writeToQueue(decision);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("QUEUE_ALIAS_BYPASS_BLOCKED");
  });

  // 14. idempotent replay does not re-enqueue test
  it("should not re-enqueue already processed intake", () => {
    const intake = makeCanonicalIntake();
    const decision = buildRoutingDecision(intake, "STABILIZATION_VALIDATION", "TEST", "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    writeToQueue(decision);
    const existing = isAlreadyProcessed(intake);
    expect(existing).toBe("ENQUEUED");
  });

  // 15. rejected intake produces REJECTED terminal outcome
  it("should reject expansion action as REJECTED terminal outcome", () => {
    const intake = makeCanonicalIntake({ requestedAction: "FEATURE_ENABLE" });
    const cls = classifyIntake(intake, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION");
    expect(cls.classification).toBe("REJECTED_INTAKE");
    const decision = buildRoutingDecision(intake, cls.classification, cls.reasonCode, "ACTIVE_100", "FULL_ACTIVE_STABILIZATION", "v1");
    const result = writeToQueue(decision);
    expect(result.terminalOutcome).toBe("REJECTED");
  });

  // 16. successful normalization test
  it("should normalize valid intake successfully", () => {
    const result = normalizeIntake(makeIntake());
    expect(result.success).toBe(true);
    expect(result.intake).not.toBeNull();
    expect(result.intake!.intakeId).toBe("intake-001");
  });
});
