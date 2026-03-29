import { describe, it, expect } from "vitest";
import {
  // Layer 1: Concurrency Guard
  createConcurrencyGuard,
  // Layer 2: Reconnect / Replay
  createReplayCheckpoint,
  analyzeEventGap,
  replayMissedEvents,
  // Layer 3: Persistence
  createPersistenceEnvelope,
  validateEnvelope,
  computeContentHash,
  createInMemoryPersistenceStore,
  // Layer 4: Idempotent Mutation
  createIdempotencyGuard,
  // Layer 5: Error Boundary
  executeWithBoundary,
  createErrorTracker,
  createGovernanceError,
  // Pipeline
  createHardenedMutationPipeline,
} from "../governance-hardening-engine";
import { createGovernanceEventBus, createGovernanceEvent } from "../governance-event-bus";

// ══════════════════════════════════════════════
// HE1: Concurrency Guard — acquire / release
// ══════════════════════════════════════════════
describe("HE1: Concurrency Guard Basic", () => {
  it("should acquire and release lock", () => {
    const guard = createConcurrencyGuard();
    const result = guard.acquire("obj_1", "dispatch_prep", "user_A", "update_readiness");
    expect(result.acquired).toBe(true);
    expect(result.lock?.objectId).toBe("obj_1");
    expect(result.lock?.acquiredBy).toBe("user_A");

    const released = guard.release("obj_1", "user_A");
    expect(released).toBe(true);
    expect(guard.isLocked("obj_1")).toBe(false);
  });

  it("should reject second acquire on same object", () => {
    const guard = createConcurrencyGuard();
    guard.acquire("obj_1", "dispatch_prep", "user_A", "update");
    const result = guard.acquire("obj_1", "dispatch_prep", "user_B", "update");
    expect(result.acquired).toBe(false);
    expect(result.currentHolder?.acquiredBy).toBe("user_A");
  });

  it("should not allow different actor to release", () => {
    const guard = createConcurrencyGuard();
    guard.acquire("obj_1", "dispatch_prep", "user_A", "update");
    expect(guard.release("obj_1", "user_B")).toBe(false);
    expect(guard.isLocked("obj_1")).toBe(true);
  });
});

// ══════════════════════════════════════════════
// HE2: Concurrency Guard — timeout auto-release
// ══════════════════════════════════════════════
describe("HE2: Concurrency Guard Timeout", () => {
  it("should auto-expire lock after timeout", () => {
    const guard = createConcurrencyGuard(1); // 1ms timeout
    guard.acquire("obj_1", "dispatch_prep", "user_A", "update");

    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }

    // Should be able to acquire now
    const result = guard.acquire("obj_1", "dispatch_prep", "user_B", "update");
    expect(result.acquired).toBe(true);
  });

  it("sweep should clear expired locks", () => {
    const guard = createConcurrencyGuard(1);
    guard.acquire("obj_1", "dispatch_prep", "user_A", "u1");
    guard.acquire("obj_2", "stock_release", "user_B", "u2");

    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }

    const swept = guard.sweep();
    expect(swept).toBe(2);
    expect(guard.getActiveLocks().length).toBe(0);
  });
});

// ══════════════════════════════════════════════
// HE3: Concurrency Guard — force release
// ══════════════════════════════════════════════
describe("HE3: Force Release", () => {
  it("should force release regardless of actor", () => {
    const guard = createConcurrencyGuard();
    guard.acquire("obj_1", "dispatch_prep", "user_A", "update");
    expect(guard.forceRelease("obj_1", "admin override")).toBe(true);
    expect(guard.isLocked("obj_1")).toBe(false);
  });
});

// ══════════════════════════════════════════════
// HE4: Event Gap Analysis — no gap
// ══════════════════════════════════════════════
describe("HE4: Event Gap — No Gap", () => {
  it("should detect no gap when checkpoint is current", () => {
    const bus = createGovernanceEventBus();
    const evt = createGovernanceEvent("dispatch_prep", "test", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "test",
    });
    bus.publish(evt);

    const checkpoint = createReplayCheckpoint(["dispatch_prep"], evt.eventId);
    const gap = analyzeEventGap(bus, checkpoint);
    expect(gap.missedCount).toBe(0);
    expect(gap.needsReplay).toBe(false);
  });
});

// ══════════════════════════════════════════════
// HE5: Event Gap Analysis — missed events
// ══════════════════════════════════════════════
describe("HE5: Event Gap — Missed Events", () => {
  it("should detect missed events after checkpoint", () => {
    const bus = createGovernanceEventBus();
    const evt1 = createGovernanceEvent("dispatch_prep", "evt1", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "first",
    });
    bus.publish(evt1);

    const checkpoint = createReplayCheckpoint(["dispatch_prep"], evt1.eventId);

    // More events arrive after checkpoint
    const evt2 = createGovernanceEvent("dispatch_prep", "evt2", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "b", toStatus: "c",
      actor: "sys", detail: "second",
    });
    bus.publish(evt2);

    const gap = analyzeEventGap(bus, checkpoint);
    expect(gap.missedCount).toBe(1);
    expect(gap.needsReplay).toBe(true);
    expect(gap.missedEvents[0].eventId).toBe(evt2.eventId);
  });
});

// ══════════════════════════════════════════════
// HE6: Event Gap — domain filtering
// ══════════════════════════════════════════════
describe("HE6: Event Gap — Domain Filter", () => {
  it("should only count missed events for subscribed domains", () => {
    const bus = createGovernanceEventBus();
    const evt1 = createGovernanceEvent("dispatch_prep", "evt1", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "first",
    });
    bus.publish(evt1);

    const checkpoint = createReplayCheckpoint(["stock_release"], evt1.eventId);

    // Event in different domain
    const evt2 = createGovernanceEvent("dispatch_prep", "evt2", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "b", toStatus: "c",
      actor: "sys", detail: "second",
    });
    bus.publish(evt2);

    const gap = analyzeEventGap(bus, checkpoint);
    expect(gap.missedCount).toBe(0); // dispatch_prep not in subscribed domains
  });
});

// ══════════════════════════════════════════════
// HE7: Replay execution
// ══════════════════════════════════════════════
describe("HE7: Replay Execution", () => {
  it("should replay missed events and update checkpoint", () => {
    const replayed: string[] = [];
    const events = [
      createGovernanceEvent("dispatch_prep", "evt1", {
        caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
        actor: "sys", detail: "1",
      }),
      createGovernanceEvent("dispatch_prep", "evt2", {
        caseId: "c1", poNumber: "PO-001", fromStatus: "b", toStatus: "c",
        actor: "sys", detail: "2",
      }),
    ];

    const checkpoint = createReplayCheckpoint(["dispatch_prep"]);
    const result = replayMissedEvents(events, (evt) => replayed.push(evt.eventId), checkpoint);

    expect(result.replayedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.updatedCheckpoint.lastProcessedEventId).toBe(events[1].eventId);
    expect(replayed.length).toBe(2);
  });

  it("should continue replay on individual handler error", () => {
    let callCount = 0;
    const events = [
      createGovernanceEvent("dispatch_prep", "evt1", {
        caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
        actor: "sys", detail: "1",
      }),
      createGovernanceEvent("dispatch_prep", "evt2", {
        caseId: "c1", poNumber: "PO-001", fromStatus: "b", toStatus: "c",
        actor: "sys", detail: "2",
      }),
    ];

    const checkpoint = createReplayCheckpoint(["dispatch_prep"]);
    const result = replayMissedEvents(events, () => {
      callCount++;
      if (callCount === 1) throw new Error("handler failed");
    }, checkpoint);

    expect(result.replayedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors.length).toBe(1);
  });
});

// ══════════════════════════════════════════════
// HE8: Persistence — envelope create / validate
// ══════════════════════════════════════════════
describe("HE8: Persistence Envelope", () => {
  it("should create and validate envelope", () => {
    const payload = { status: "evaluating", blockers: [] };
    const envelope = createPersistenceEnvelope("StockReleaseState", "stock_release", "sr_001", payload, "evt_1");

    expect(envelope.version).toBe(1);
    expect(envelope.contentHash).toBeTruthy();

    const validation = validateEnvelope(envelope, "evt_1");
    expect(validation.valid).toBe(true);
    expect(validation.stale).toBe(false);
  });

  it("should detect stale envelope", () => {
    const payload = { status: "evaluating" };
    const envelope = createPersistenceEnvelope("State", "stock_release", "sr_001", payload, "evt_1");

    const validation = validateEnvelope(envelope, "evt_2");
    expect(validation.stale).toBe(true);
  });

  it("should detect integrity failure on tampered payload", () => {
    const payload = { status: "evaluating" };
    const envelope = createPersistenceEnvelope("State", "stock_release", "sr_001", payload, "evt_1");

    // Tamper with payload
    (envelope.payload as any).status = "released";

    const validation = validateEnvelope(envelope, "evt_1");
    expect(validation.valid).toBe(false);
    expect(validation.integrityMatch).toBe(false);
  });
});

// ══════════════════════════════════════════════
// HE9: Persistence Store — CRUD
// ══════════════════════════════════════════════
describe("HE9: Persistence Store", () => {
  it("should save, load, list, remove", () => {
    const store = createInMemoryPersistenceStore();
    const envelope = createPersistenceEnvelope("State", "dispatch_prep", "dp_001", { a: 1 }, null);

    expect(store.save(envelope)).toBe(true);
    expect(store.load("dispatch_prep", "dp_001")).toBeTruthy();
    expect(store.list().length).toBe(1);
    expect(store.list("dispatch_prep").length).toBe(1);
    expect(store.list("stock_release").length).toBe(0);
    expect(store.remove("dispatch_prep", "dp_001")).toBe(true);
    expect(store.load("dispatch_prep", "dp_001")).toBeNull();
  });

  it("clear should empty store", () => {
    const store = createInMemoryPersistenceStore();
    store.save(createPersistenceEnvelope("S", "dispatch_prep", "1", {}, null));
    store.save(createPersistenceEnvelope("S", "stock_release", "2", {}, null));
    store.clear();
    expect(store.list().length).toBe(0);
  });
});

// ══════════════════════════════════════════════
// HE10: Content Hash — deterministic
// ══════════════════════════════════════════════
describe("HE10: Content Hash", () => {
  it("should produce same hash for same content", () => {
    const a = computeContentHash({ x: 1, y: 2 });
    const b = computeContentHash({ x: 1, y: 2 });
    expect(a).toBe(b);
  });

  it("should produce different hash for different content", () => {
    const a = computeContentHash({ x: 1 });
    const b = computeContentHash({ x: 2 });
    expect(a).not.toBe(b);
  });
});

// ══════════════════════════════════════════════
// HE11: Idempotency Guard — duplicate detection
// ══════════════════════════════════════════════
describe("HE11: Idempotency Guard", () => {
  it("should detect duplicate mutation", () => {
    const guard = createIdempotencyGuard();
    guard.record("dispatch_prep", "dp_001", "update_readiness", "hash_abc", "applied");

    const check = guard.check("dispatch_prep", "dp_001", "update_readiness", "hash_abc");
    expect(check.isDuplicate).toBe(true);
    expect(check.existingFingerprint?.resultSummary).toBe("applied");
  });

  it("should not detect duplicate for different content hash", () => {
    const guard = createIdempotencyGuard();
    guard.record("dispatch_prep", "dp_001", "update_readiness", "hash_abc", "applied");

    const check = guard.check("dispatch_prep", "dp_001", "update_readiness", "hash_def");
    expect(check.isDuplicate).toBe(false);
  });

  it("prune should remove old fingerprints", () => {
    const guard = createIdempotencyGuard();
    guard.record("dispatch_prep", "dp_001", "update", "h1", "ok");

    // Prune with 0ms TTL — should clear everything
    const pruned = guard.prune(0);
    expect(pruned).toBe(1);
    expect(guard.getFingerprints().length).toBe(0);
  });
});

// ══════════════════════════════════════════════
// HE12: Error Boundary — recoverable
// ══════════════════════════════════════════════
describe("HE12: Error Boundary — Recoverable", () => {
  it("should return success for normal execution", () => {
    const result = executeWithBoundary("dispatch_prep", "update", "dp_001", () => ({ ok: true }));
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ ok: true });
    expect(result.error).toBeNull();
  });

  it("should catch error and return structured result", () => {
    const result = executeWithBoundary("dispatch_prep", "update", "dp_001", () => {
      throw new Error("validation failed");
    });
    expect(result.success).toBe(false);
    expect(result.error?.severity).toBe("recoverable");
    expect(result.error?.domain).toBe("dispatch_prep");
    expect(result.error?.recovery.type).toBe("refresh_state");
  });

  it("should classify timeout as degraded", () => {
    const result = executeWithBoundary("dispatch_prep", "update", "dp_001", () => {
      throw new Error("connection timeout");
    });
    expect(result.error?.severity).toBe("degraded");
    expect(result.error?.recovery.type).toBe("retry");
  });

  it("should classify stack overflow as fatal", () => {
    const result = executeWithBoundary("dispatch_prep", "update", "dp_001", () => {
      throw new Error("Maximum call stack size exceeded");
    });
    expect(result.error?.severity).toBe("fatal");
    expect(result.error?.recovery.type).toBe("escalate");
  });
});

// ══════════════════════════════════════════════
// HE13: Error Tracker — circuit breaker
// ══════════════════════════════════════════════
describe("HE13: Error Tracker Circuit Breaker", () => {
  it("should track consecutive failures", () => {
    const tracker = createErrorTracker();
    const err = createGovernanceError(
      "dispatch_prep", "update", "dp_001", "recoverable", "test", { type: "retry", delayMs: 1000 },
    );

    tracker.record(err);
    tracker.record(err);
    tracker.record(err);

    expect(tracker.getConsecutiveFailures("dp_001")).toBe(3);
    expect(tracker.isCircuitOpen("dp_001", 5)).toBe(false);
    expect(tracker.isCircuitOpen("dp_001", 3)).toBe(true);
  });

  it("clearForObject should reset circuit", () => {
    const tracker = createErrorTracker();
    const err = createGovernanceError(
      "dispatch_prep", "update", "dp_001", "recoverable", "test", { type: "retry", delayMs: 1000 },
    );
    tracker.record(err);
    tracker.record(err);
    tracker.record(err);

    tracker.clearForObject("dp_001");
    expect(tracker.getConsecutiveFailures("dp_001")).toBe(0);
    expect(tracker.isCircuitOpen("dp_001", 3)).toBe(false);
  });
});

// ══════════════════════════════════════════════
// HE14: Error Tracker — recent errors window
// ══════════════════════════════════════════════
describe("HE14: Recent Errors Window", () => {
  it("should filter errors by time window", () => {
    const tracker = createErrorTracker();
    tracker.record(createGovernanceError(
      "dispatch_prep", "op", "dp_001", "recoverable", "err1", { type: "retry", delayMs: 1000 },
    ));

    const recent = tracker.getRecentErrors(60_000); // last 60s
    expect(recent.length).toBe(1);

    const old = tracker.getRecentErrors(0); // 0ms window
    expect(old.length).toBe(0);
  });
});

// ══════════════════════════════════════════════
// HE15: Hardened Pipeline — successful mutation
// ══════════════════════════════════════════════
describe("HE15: Pipeline — Success", () => {
  it("should execute mutation through full pipeline", () => {
    const pipeline = createHardenedMutationPipeline();
    const result = pipeline.execute({
      domain: "dispatch_prep",
      objectId: "dp_001",
      mutationType: "update_readiness",
      contentHash: "hash_1",
      actor: "operator",
      execute: () => ({ newStatus: "ready" }),
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.result).toEqual({ newStatus: "ready" });
    }
  });
});

// ══════════════════════════════════════════════
// HE16: Pipeline — duplicate rejection
// ══════════════════════════════════════════════
describe("HE16: Pipeline — Duplicate", () => {
  it("should silently reject duplicate mutation", () => {
    const pipeline = createHardenedMutationPipeline();
    let callCount = 0;

    const input = {
      domain: "dispatch_prep" as const,
      objectId: "dp_001",
      mutationType: "update_readiness",
      contentHash: "hash_same",
      actor: "operator",
      execute: () => { callCount++; return { ok: true }; },
    };

    pipeline.execute(input);
    const result = pipeline.execute(input); // duplicate

    expect(result.status).toBe("duplicate");
    expect(callCount).toBe(1); // executed only once
  });
});

// ══════════════════════════════════════════════
// HE17: Pipeline — lock rejection
// ══════════════════════════════════════════════
describe("HE17: Pipeline — Lock Rejection", () => {
  it("should reject when object is locked by another actor", () => {
    const pipeline = createHardenedMutationPipeline();

    // First actor acquires lock directly
    pipeline.getConcurrencyGuard().acquire("dp_001", "dispatch_prep", "user_A", "long_op");

    const result = pipeline.execute({
      domain: "dispatch_prep",
      objectId: "dp_001",
      mutationType: "update",
      contentHash: "h1",
      actor: "user_B",
      execute: () => ({ ok: true }),
    });

    expect(result.status).toBe("lock_rejected");
  });
});

// ══════════════════════════════════════════════
// HE18: Pipeline — circuit breaker
// ══════════════════════════════════════════════
describe("HE18: Pipeline — Circuit Breaker", () => {
  it("should open circuit after consecutive failures", () => {
    const pipeline = createHardenedMutationPipeline({ circuitBreakerThreshold: 3 });

    // Force 3 consecutive errors
    for (let i = 0; i < 3; i++) {
      pipeline.execute({
        domain: "dispatch_prep",
        objectId: "dp_001",
        mutationType: `fail_${i}`,
        contentHash: `h_${i}`,
        actor: "operator",
        execute: () => { throw new Error("always fails"); },
      });
    }

    // Circuit should now be open
    const result = pipeline.execute({
      domain: "dispatch_prep",
      objectId: "dp_001",
      mutationType: "new_op",
      contentHash: "h_new",
      actor: "operator",
      execute: () => ({ ok: true }),
    });

    expect(result.status).toBe("circuit_open");
  });
});

// ══════════════════════════════════════════════
// HE19: Pipeline — error clears after success
// ══════════════════════════════════════════════
describe("HE19: Pipeline — Error Recovery", () => {
  it("successful mutation should clear consecutive failures", () => {
    const pipeline = createHardenedMutationPipeline({ circuitBreakerThreshold: 5 });

    // 2 failures
    for (let i = 0; i < 2; i++) {
      pipeline.execute({
        domain: "dispatch_prep",
        objectId: "dp_001",
        mutationType: `fail_${i}`,
        contentHash: `h_${i}`,
        actor: "operator",
        execute: () => { throw new Error("fails"); },
      });
    }

    expect(pipeline.getErrorTracker().getConsecutiveFailures("dp_001")).toBe(2);

    // Success clears
    pipeline.execute({
      domain: "dispatch_prep",
      objectId: "dp_001",
      mutationType: "success_op",
      contentHash: "h_ok",
      actor: "operator",
      execute: () => ({ ok: true }),
    });

    expect(pipeline.getErrorTracker().getConsecutiveFailures("dp_001")).toBe(0);
  });
});

// ══════════════════════════════════════════════
// HE20: Pipeline — lock always released
// ══════════════════════════════════════════════
describe("HE20: Pipeline — Lock Always Released", () => {
  it("lock should be released even on execution error", () => {
    const pipeline = createHardenedMutationPipeline();

    pipeline.execute({
      domain: "dispatch_prep",
      objectId: "dp_001",
      mutationType: "failing_op",
      contentHash: "h1",
      actor: "operator",
      execute: () => { throw new Error("boom"); },
    });

    // Lock should NOT be held
    expect(pipeline.getConcurrencyGuard().isLocked("dp_001")).toBe(false);

    // Another actor should be able to acquire
    const result = pipeline.execute({
      domain: "dispatch_prep",
      objectId: "dp_001",
      mutationType: "recovery_op",
      contentHash: "h2",
      actor: "operator",
      execute: () => ({ recovered: true }),
    });

    expect(result.status).toBe("applied");
  });
});

// ══════════════════════════════════════════════
// HE21: Full flow — reconnect → replay → mutate
// ══════════════════════════════════════════════
describe("HE21: Full Reconnect Flow", () => {
  it("should detect gap, replay, then mutate through pipeline", () => {
    const bus = createGovernanceEventBus();
    const pipeline = createHardenedMutationPipeline();
    const replayed: string[] = [];

    // Simulate pre-disconnect events
    const evt1 = createGovernanceEvent("dispatch_prep", "evt1", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "a", toStatus: "b",
      actor: "sys", detail: "before disconnect",
    });
    bus.publish(evt1);

    // Create checkpoint at evt1
    const checkpoint = createReplayCheckpoint(["dispatch_prep"], evt1.eventId);

    // Events during disconnect
    const evt2 = createGovernanceEvent("dispatch_prep", "evt2", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "b", toStatus: "c",
      actor: "sys", detail: "during disconnect",
    });
    bus.publish(evt2);

    // Reconnect: analyze gap
    const gap = analyzeEventGap(bus, checkpoint);
    expect(gap.needsReplay).toBe(true);
    expect(gap.missedCount).toBe(1);

    // Replay
    const replayResult = replayMissedEvents(gap.missedEvents, (e) => replayed.push(e.eventId), checkpoint);
    expect(replayResult.replayedCount).toBe(1);

    // Now mutate through pipeline
    const mutResult = pipeline.execute({
      domain: "dispatch_prep",
      objectId: "dp_001",
      mutationType: "post_reconnect_update",
      contentHash: "h_reconnect",
      actor: "operator",
      execute: () => ({ reconnected: true }),
    });
    expect(mutResult.status).toBe("applied");
  });
});

// ══════════════════════════════════════════════
// HE22: Persistence + Replay integration
// ══════════════════════════════════════════════
describe("HE22: Persistence + Replay", () => {
  it("should persist state with event checkpoint and detect stale on restore", () => {
    const bus = createGovernanceEventBus();
    const store = createInMemoryPersistenceStore();

    // Publish event and persist state
    const evt1 = createGovernanceEvent("stock_release", "released", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "evaluating", toStatus: "released",
      actor: "sys", detail: "released",
    });
    bus.publish(evt1);

    const state = { status: "released", releasedQty: 100 };
    const envelope = createPersistenceEnvelope("StockReleaseState", "stock_release", "sr_001", state, evt1.eventId);
    store.save(envelope);

    // New event arrives
    const evt2 = createGovernanceEvent("stock_release", "hold_placed", {
      caseId: "c1", poNumber: "PO-001", fromStatus: "released", toStatus: "hold_active",
      actor: "sys", detail: "new hold",
    });
    bus.publish(evt2);

    // Restore and validate — should be stale
    const loaded = store.load<typeof state>("stock_release", "sr_001")!;
    const validation = validateEnvelope(loaded, evt2.eventId);
    expect(validation.valid).toBe(true); // structure OK
    expect(validation.stale).toBe(true); // but outdated
  });
});
