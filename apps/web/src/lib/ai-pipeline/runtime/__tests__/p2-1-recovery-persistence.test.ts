/**
 * P2-1 Slice A — Recovery Record Persistence Tests
 *
 * 8 tests:
 * SA1: Memory adapter — save → find by recoveryId
 * SA2: Memory adapter — update with optimistic lock
 * SA3: Memory adapter — optimistic lock conflict on stale updatedAt
 * SA4: Memory adapter — findActiveRecovery (non-terminal state)
 * SA5: Memory adapter — findActiveRecovery returns null for terminal state
 * SA6: Memory adapter — duplicate recoveryId rejected
 * SA7: Memory adapter — findByCorrelationId
 * SA8: PersistenceAdapters bundle includes recoveryRecord
 *
 * Babel constraints: var + require(), no `import type`, no `as any`.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
var { MemoryRecoveryRecordRepository } = require("../core/persistence/memory/recovery-record");
var { createMemoryAdapters } = require("../core/persistence/memory");
var { _resetPersistenceBootstrap, bootstrapPersistence } = require("../core/persistence/bootstrap");

function buildRecoveryInput(overrides) {
  var base = {
    recoveryId: "rec-" + Math.random().toString(36).slice(2, 8),
    correlationId: "corr-" + Math.random().toString(36).slice(2, 8),
    incidentId: "inc-001",
    baselineId: "bl-001",
    lifecycleState: "INCIDENT_LOCKDOWN",
    releaseMode: "FULL_ACTIVE_STABILIZATION",
    recoveryState: "RECOVERY_REQUESTED",
    recoveryStage: null,
    lockKey: null,
    lockToken: null,
    operatorId: "operator-1",
    overrideUsed: false,
    overrideReason: null,
    signOffMetadata: null,
    startedAt: new Date(),
    completedAt: null,
    lastHeartbeatAt: null,
    failureReasonCode: null,
    stageResults: null,
    preconditionResults: null,
  };
  if (overrides) {
    for (var key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        base[key] = overrides[key];
      }
    }
  }
  return base;
}

describe("P2-1 Slice A: Recovery Record Persistence", function () {

  // ══════════════════════════════════════════════════════════════════════════
  // Memory Adapter Tests
  // ══════════════════════════════════════════════════════════════════════════

  describe("MemoryRecoveryRecordRepository", function () {

    it("SA1: save → find by recoveryId", function () {
      var repo = new MemoryRecoveryRecordRepository();
      var input = buildRecoveryInput({ recoveryId: "rec-sa1" });
      return repo.saveRecoveryRecord(input).then(function (result) {
        expect(result.ok).toBe(true);
        expect(result.data.recoveryId).toBe("rec-sa1");
        expect(result.data.id).toBeTruthy();
        expect(result.data.createdAt).toBeInstanceOf(Date);
        expect(result.data.updatedAt).toBeInstanceOf(Date);
        return repo.findByRecoveryId("rec-sa1");
      }).then(function (found) {
        expect(found.ok).toBe(true);
        expect(found.data.recoveryId).toBe("rec-sa1");
        expect(found.data.operatorId).toBe("operator-1");
      });
    });

    it("SA2: update with optimistic lock", function () {
      var repo = new MemoryRecoveryRecordRepository();
      var input = buildRecoveryInput({ recoveryId: "rec-sa2" });
      var savedRecord;
      return repo.saveRecoveryRecord(input).then(function (result) {
        savedRecord = result.data;
        return repo.updateRecoveryRecord({
          id: savedRecord.id,
          expectedUpdatedAt: savedRecord.updatedAt,
          patch: {
            recoveryState: "RECOVERY_VALIDATED",
            preconditionResults: [{ name: "CHECK_1", passed: true }],
          },
        });
      }).then(function (updated) {
        expect(updated.ok).toBe(true);
        expect(updated.data.recoveryState).toBe("RECOVERY_VALIDATED");
        expect(updated.data.preconditionResults).toEqual([{ name: "CHECK_1", passed: true }]);
        expect(updated.data.updatedAt.getTime()).toBeGreaterThan(savedRecord.updatedAt.getTime());
      });
    });

    it("SA3: optimistic lock conflict on stale updatedAt", function () {
      var repo = new MemoryRecoveryRecordRepository();
      var input = buildRecoveryInput({ recoveryId: "rec-sa3" });
      var savedRecord;
      return repo.saveRecoveryRecord(input).then(function (result) {
        savedRecord = result.data;
        // First update succeeds
        return repo.updateRecoveryRecord({
          id: savedRecord.id,
          expectedUpdatedAt: savedRecord.updatedAt,
          patch: { recoveryState: "RECOVERY_VALIDATED" },
        });
      }).then(function () {
        // Second update with stale updatedAt fails
        return repo.updateRecoveryRecord({
          id: savedRecord.id,
          expectedUpdatedAt: savedRecord.updatedAt, // stale!
          patch: { recoveryState: "RECOVERY_EXECUTING" },
        });
      }).then(function (conflict) {
        expect(conflict.ok).toBe(false);
        expect(conflict.error.code).toBe("OPTIMISTIC_LOCK_CONFLICT");
      });
    });

    it("SA4: findActiveRecovery — non-terminal state without completedAt", function () {
      var repo = new MemoryRecoveryRecordRepository();
      var input = buildRecoveryInput({
        recoveryId: "rec-sa4",
        recoveryState: "RECOVERY_EXECUTING",
        completedAt: null,
      });
      return repo.saveRecoveryRecord(input).then(function () {
        return repo.findActiveRecovery();
      }).then(function (active) {
        expect(active).not.toBeNull();
        expect(active.recoveryId).toBe("rec-sa4");
        expect(active.recoveryState).toBe("RECOVERY_EXECUTING");
      });
    });

    it("SA5: findActiveRecovery — returns null for terminal state", function () {
      var repo = new MemoryRecoveryRecordRepository();
      var input = buildRecoveryInput({
        recoveryId: "rec-sa5",
        recoveryState: "RECOVERY_RESTORED",
        completedAt: new Date(),
      });
      return repo.saveRecoveryRecord(input).then(function () {
        return repo.findActiveRecovery();
      }).then(function (active) {
        expect(active).toBeNull();
      });
    });

    it("SA6: duplicate recoveryId rejected", function () {
      var repo = new MemoryRecoveryRecordRepository();
      var input = buildRecoveryInput({ recoveryId: "rec-sa6" });
      return repo.saveRecoveryRecord(input).then(function (first) {
        expect(first.ok).toBe(true);
        var dup = buildRecoveryInput({ recoveryId: "rec-sa6" });
        return repo.saveRecoveryRecord(dup);
      }).then(function (second) {
        expect(second.ok).toBe(false);
        expect(second.error.code).toBe("DUPLICATE");
      });
    });

    it("SA7: findByCorrelationId", function () {
      var repo = new MemoryRecoveryRecordRepository();
      var input = buildRecoveryInput({
        recoveryId: "rec-sa7",
        correlationId: "corr-sa7",
      });
      return repo.saveRecoveryRecord(input).then(function () {
        return repo.findByCorrelationId("corr-sa7");
      }).then(function (found) {
        expect(found.ok).toBe(true);
        expect(found.data.correlationId).toBe("corr-sa7");
        expect(found.data.recoveryId).toBe("rec-sa7");
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Bundle Integration
  // ══════════════════════════════════════════════════════════════════════════

  describe("PersistenceAdapters Bundle", function () {

    beforeEach(function () {
      _resetPersistenceBootstrap();
    });

    it("SA8: bundle includes recoveryRecord repository", function () {
      var adapters = bootstrapPersistence({ mode: "MEMORY" });
      expect(adapters.recoveryRecord).toBeTruthy();
      expect(typeof adapters.recoveryRecord.saveRecoveryRecord).toBe("function");
      expect(typeof adapters.recoveryRecord.updateRecoveryRecord).toBe("function");
      expect(typeof adapters.recoveryRecord.findByRecoveryId).toBe("function");
      expect(typeof adapters.recoveryRecord.findActiveRecovery).toBe("function");
      expect(typeof adapters.recoveryRecord.findByCorrelationId).toBe("function");
    });
  });
});
