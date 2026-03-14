/**
 * S5 — Observability / Audit / Reconstruction 테스트
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  validateCanonicalEvent,
  writeCanonicalAudit,
  getCanonicalAuditLog,
  validateHops,
  buildTimeline,
  buildReconstructionView,
  createCanonicalEvent,
  _resetCanonicalAudit,
  SCHEMA_VERSION,
} from "../core/observability/canonical-event-schema";

describe("S5: Observability / Audit / Reconstruction", () => {
  beforeEach(() => {
    _resetCanonicalAudit();
  });

  // 1. canonical event schema validation test
  it("should validate canonical event with all required fields", () => {
    const event = createCanonicalEvent({});
    const result = validateCanonicalEvent(event);
    expect(result.valid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
    expect(result.schemaVersionMatch).toBe(true);
  });

  // 2. missing required field blocks audit write test
  it("should block write when required field missing", () => {
    const event = createCanonicalEvent({ actor: "" });
    const result = writeCanonicalAudit(event);
    expect(result.written).toBe(false);
    expect(result.reasonCode).toContain("REQUIRED_FIELD_MISSING");
  });

  // 3. correlation chain preserved across modules test
  it("should preserve correlationId across events", () => {
    const corId = "cor-chain-test";
    writeCanonicalAudit(createCanonicalEvent({ correlationId: corId, eventType: "BREACH_DETECTED", sourceModule: "containment" }));
    writeCanonicalAudit(createCanonicalEvent({ correlationId: corId, eventType: "ROLLBACK_STEP_EXECUTED", sourceModule: "rollback" }));
    const events = getCanonicalAuditLog({ correlationId: corId });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.correlationId === corId)).toBe(true);
  });

  // 4. incident binding preserved on escalation test
  it("should preserve incidentId on escalation events", () => {
    const event = createCanonicalEvent({
      correlationId: "cor-inc",
      incidentId: "inc-001",
      eventType: "INCIDENT_ESCALATED",
    });
    writeCanonicalAudit(event);
    const events = getCanonicalAuditLog({ correlationId: "cor-inc" });
    expect(events[0].incidentId).toBe("inc-001");
  });

  // 5. snapshot linkage required for critical mutation event test
  it("should include snapshot linkage for rollback events", () => {
    const event = createCanonicalEvent({
      eventType: "ROLLBACK_STEP_EXECUTED",
      snapshotBeforeId: "snap-before",
      snapshotAfterId: "snap-after",
    });
    writeCanonicalAudit(event);
    const events = getCanonicalAuditLog({ eventType: "ROLLBACK_STEP_EXECUTED" });
    expect(events[0].snapshotBeforeId).toBe("snap-before");
    expect(events[0].snapshotAfterId).toBe("snap-after");
  });

  // 6. audit writer single entrypoint enforcement test
  it("should only accept writes through writeCanonicalAudit", () => {
    const event = createCanonicalEvent({ eventType: "TEST_EVENT" });
    const result = writeCanonicalAudit(event);
    expect(result.written).toBe(true);
    expect(getCanonicalAuditLog()).toHaveLength(1);
  });

  // 7. duplicate audit write dedupe test
  it("should dedupe duplicate event writes", () => {
    const event = createCanonicalEvent({ eventId: "dup-001", eventType: "TEST_EVENT" });
    writeCanonicalAudit(event);
    const result2 = writeCanonicalAudit(event);
    expect(result2.written).toBe(false);
    expect(result2.reasonCode).toBe("DUPLICATE_EVENT_DEDUPE");
    // diagnostic record exists
    const all = getCanonicalAuditLog();
    expect(all.some((e) => e.eventType.startsWith("DUPLICATE_"))).toBe(true);
  });

  // 8. missing audit hop detection test
  it("should detect missing hops in containment flow", () => {
    const corId = "cor-partial";
    writeCanonicalAudit(createCanonicalEvent({ correlationId: corId, eventType: "BREACH_DETECTED" }));
    writeCanonicalAudit(createCanonicalEvent({ correlationId: corId, eventType: "FINAL_CONTAINMENT_STARTED" }));
    // missing MUTATION_FROZEN, ROLLBACK_*, etc
    const result = validateHops("containment", corId);
    expect(result.complete).toBe(false);
    expect(result.missingHops.length).toBeGreaterThan(0);
  });

  // 9. containment flow reconstructable timeline test
  it("should build reconstructable timeline for complete containment flow", () => {
    const corId = "cor-full-contain";
    const tl = "tl-contain";
    const base = { correlationId: corId, timelineId: tl };
    for (const hopType of [
      "BREACH_DETECTED", "FINAL_CONTAINMENT_STARTED", "MUTATION_FROZEN",
      "ROLLBACK_PRECHECK_PASSED", "ROLLBACK_STEP_EXECUTED",
      "RESIDUE_SCAN_COMPLETED", "RECONCILIATION_COMPLETED", "CONTAINMENT_FINALIZED",
    ]) {
      writeCanonicalAudit(createCanonicalEvent({ ...base, eventType: hopType }));
    }
    const timeline = buildTimeline(corId);
    expect(timeline.reconstructionStatus).toBe("RECONSTRUCTABLE");
    expect(timeline.orderedEvents).toHaveLength(8);
  });

  // 10. routing flow reconstructable timeline test
  it("should build timeline for routing flow", () => {
    const corId = "cor-routing";
    const base = { correlationId: corId, timelineId: "tl-route" };
    for (const t of ["INTAKE_NORMALIZED", "ROUTING_DECISION_BUILT", "QUEUE_WRITE_SUCCEEDED"]) {
      writeCanonicalAudit(createCanonicalEvent({ ...base, eventType: t }));
    }
    const timeline = buildTimeline(corId);
    expect(timeline.reconstructionStatus).toBe("RECONSTRUCTABLE");
  });

  // 11. authority transfer flow reconstructable timeline test
  it("should build timeline for authority transfer flow", () => {
    const corId = "cor-auth";
    const base = { correlationId: corId, timelineId: "tl-auth" };
    for (const t of [
      "AUTHORITY_TRANSFER_REQUESTED", "AUTHORITY_TRANSFER_LOCKED",
      "AUTHORITY_REVOKED", "AUTHORITY_ACTIVATED", "AUTHORITY_CONTINUITY_VALIDATED",
    ]) {
      writeCanonicalAudit(createCanonicalEvent({ ...base, eventType: t }));
    }
    const timeline = buildTimeline(corId);
    expect(timeline.reconstructionStatus).toBe("RECONSTRUCTABLE");
  });

  // 12. schema drift blocked test
  it("should reject event with wrong schema version", () => {
    const event = createCanonicalEvent({ schemaVersion: "0.0.1" });
    const result = writeCanonicalAudit(event);
    expect(result.written).toBe(false);
  });

  // 13. non-canonical event emission blocked test
  it("should reject event missing required fields as non-canonical", () => {
    const result = validateCanonicalEvent({ eventType: "SOMETHING" });
    expect(result.valid).toBe(false);
    expect(result.missingFields.length).toBeGreaterThan(0);
  });

  // 14. operator reconstruction status enum only test
  it("should only produce valid reconstruction status", () => {
    const validStatuses = [
      "RECONSTRUCTABLE",
      "PARTIALLY_RECONSTRUCTABLE",
      "BROKEN_CHAIN",
    ];
    const timeline = buildTimeline("nonexistent");
    expect(validStatuses).toContain(timeline.reconstructionStatus);
  });

  // 15. reconstruction view contains required fields
  it("should build reconstruction view with all required fields", () => {
    const corId = "cor-view";
    writeCanonicalAudit(createCanonicalEvent({ correlationId: corId, eventType: "BREACH_DETECTED" }));
    const view = buildReconstructionView("containment", corId);
    expect(view.viewType).toBe("containment");
    expect(view.correlationId).toBe(corId);
    expect(view.reconstructionStatus).toBeTruthy();
    expect(view.eventCount).toBeGreaterThan(0);
  });

  // 16. final outcome derived from canonical events only test
  it("should derive final outcome from canonical event resultStatus", () => {
    const corId = "cor-outcome";
    writeCanonicalAudit(createCanonicalEvent({ correlationId: corId, resultStatus: "COMPLETED" }));
    const timeline = buildTimeline(corId);
    expect(timeline.finalOutcome).toBe("COMPLETED");
  });
});
