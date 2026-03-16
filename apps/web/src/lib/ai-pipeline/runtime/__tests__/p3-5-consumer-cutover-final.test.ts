/**
 * P3 Slice 5 — Remaining Consumer Cutover + Legacy Deprecation (9 tests)
 *
 * Validates:
 * - CF1: authority consumer: checkAuthorityIntegrityFromRepo uses repo-first path
 * - CF2: incident consumer: hasUnacknowledgedIncidentsFromRepo uses repo-first path
 * - CF3: stabilization audit consumer: getAuditEventsFromRepo reads from repo
 * - CF4: canonical timeline: buildTimelineFromRepo uses repo-first path
 * - CF5: recovery-preconditions check #5 audit chain uses repo-first
 * - CF6: deprecated sync checkAuthorityIntegrity emits LEGACY_SYNC_COMPAT_PATH_USED
 * - CF7: direct access guardrail: authority _assertNoDirectStoreAccess blocks
 * - CF8: mixed repo/fallback: timeline remains deterministic when repo has partial data
 * - CF9: reconstruction remains valid after cutover: buildTimelineFromRepo same result as buildTimeline
 */

var { describe, it, expect, beforeEach } = require("@jest/globals");

var { getDiagnosticLog, _resetDiagnostics } = require("../core/ontology/diagnostics");
var { createMemoryAdapters } = require("../core/persistence/memory");
var { registerAdapterFactory, _resetAdapterRegistry } = require("../core/persistence/factory");
var { bootstrapPersistence, _resetPersistenceBootstrap, getPersistenceAdapters } = require("../core/persistence/bootstrap");
var {
  createSnapshotPair,
  _resetSnapshotStore,
} = require("../core/baseline/snapshot-manager");
var {
  createCanonicalBaseline,
  _resetBaselineRegistry,
} = require("../core/baseline/baseline-registry");
var {
  createAuthorityLine,
  checkAuthorityIntegrity,
  checkAuthorityIntegrityFromRepo,
  _resetAuthorityRegistry,
  _assertNoDirectStoreAccess: _assertNoDirectStoreAccessAuthority,
} = require("../core/authority/authority-registry");
var {
  escalateIncident,
  hasUnacknowledgedIncidentsFromRepo,
  _resetIncidents,
} = require("../core/incidents/incident-escalation");
var {
  emitStabilizationAuditEvent,
  getAuditEventsFromRepo,
  _resetAuditEvents,
} = require("../core/audit/audit-events");
var {
  writeCanonicalAudit,
  createCanonicalEvent,
  buildTimeline,
  buildTimelineFromRepo,
  _resetCanonicalAudit,
} = require("../core/observability/canonical-event-schema");
var {
  runRecoveryPreconditions,
} = require("../core/recovery/recovery-preconditions");
var {
  _resetRecoveryCoordinator,
} = require("../core/recovery/recovery-coordinator");
var {
  _resetMutationFreeze,
} = require("../core/containment/mutation-freeze");

// ── Test Fixtures ──

var SCOPE_DATA = {
  CONFIG: { maxRetries: 3, timeout: 5000 },
  FLAGS: { enableNewUI: true, darkMode: false },
  ROUTING: { primary: "us-east-1", fallback: "eu-west-1" },
  AUTHORITY: { owner: "admin", level: "root" },
  POLICY: { retention: 90, encryption: "AES256" },
  QUEUE_TOPOLOGY: { queues: ["intake", "process", "output"], concurrency: 4 },
};

function setupAll() {
  _resetDiagnostics();
  _resetPersistenceBootstrap();
  _resetAdapterRegistry();
  _resetBaselineRegistry();
  _resetSnapshotStore();
  _resetAuthorityRegistry();
  _resetIncidents();
  _resetAuditEvents();
  _resetRecoveryCoordinator();
  _resetMutationFreeze();
  _resetCanonicalAudit();
  registerAdapterFactory(createMemoryAdapters);
  bootstrapPersistence();
}

function createFullScenario() {
  var pair = createSnapshotPair({
    baselineId: "bl-cf-test",
    capturedBy: "op-cf",
    scopeData: SCOPE_DATA,
  });

  var baseline = createCanonicalBaseline({
    documentType: "TEST",
    baselineVersion: "v1.0",
    activeSnapshotId: pair.active.snapshotId,
    rollbackSnapshotId: pair.rollback.snapshotId,
    activePathManifestId: "manifest-1",
    policySetVersion: "p1",
    routingRuleVersion: "r1",
    authorityRegistryVersion: "a1",
    freezeReason: "cf test freeze",
    performedBy: "tester",
  });

  createAuthorityLine("line-cf-1", "auth-A", "bl-cf-test", "tester", "corr-cf");

  return { pair: pair, baseline: baseline };
}

// ── Suite ──

describe("P3 Slice 5 — Remaining Consumer Cutover + Legacy Deprecation", function () {
  beforeEach(function () {
    setupAll();
  });

  it("CF1: checkAuthorityIntegrityFromRepo uses repo-first path", async function () {
    var scenario = createFullScenario();

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    var report = await checkAuthorityIntegrityFromRepo();

    // Should return a valid integrity report
    expect(report).toBeDefined();
    expect(typeof report.splitBrain).toBe("boolean");
    expect(typeof report.orphanCount).toBe("number");

    // Should have emitted CONSUMER_CUTOVER_APPLIED
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("checkAuthorityIntegrityFromRepo") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("CF2: hasUnacknowledgedIncidentsFromRepo uses repo-first path", async function () {
    createFullScenario();

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    var result = await hasUnacknowledgedIncidentsFromRepo();

    // No incidents escalated, so should be false
    expect(result).toBe(false);

    // Should have emitted CONSUMER_CUTOVER_APPLIED
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("hasUnacknowledgedIncidentsFromRepo") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("CF3: getAuditEventsFromRepo reads from repository with eventType filter", async function () {
    createFullScenario();

    // Emit some audit events
    emitStabilizationAuditEvent({
      eventType: "BASELINE_CREATED",
      baselineId: "bl-cf-test",
      baselineVersion: "v1.0",
      baselineHash: "hash-cf",
      snapshotId: "snap-cf",
      correlationId: "corr-cf3",
      documentType: "TEST",
      performedBy: "tester",
      detail: "CF3 test event",
    });

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    // Use eventType filter — hits repo listAuditEventsByEventType
    var events = await getAuditEventsFromRepo({ eventType: "BASELINE_CREATED" });

    // Should return events from repo (or fallback to legacy)
    expect(events.length).toBeGreaterThanOrEqual(1);

    // Each event should have required fields
    var ev = events[0];
    expect(ev.eventId).toBeDefined();
    expect(ev.eventType).toBe("BASELINE_CREATED");
  });

  it("CF4: buildTimelineFromRepo uses repo-first path", async function () {
    var scenario = createFullScenario();
    var corrId = "corr-cf4-timeline";

    // Write canonical events with the correlation ID
    writeCanonicalAudit(createCanonicalEvent({
      eventType: "BREACH_DETECTED",
      correlationId: corrId,
      sourceModule: "containment",
      reasonCode: "THRESHOLD_EXCEEDED",
    }));
    writeCanonicalAudit(createCanonicalEvent({
      eventType: "FINAL_CONTAINMENT_STARTED",
      correlationId: corrId,
      sourceModule: "containment",
      reasonCode: "CONTAINMENT_INITIATED",
    }));

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    var timeline = await buildTimelineFromRepo(corrId);

    expect(timeline).toBeDefined();
    expect(timeline.orderedEvents.length).toBeGreaterThanOrEqual(2);
    expect(timeline.correlationId).toBe(corrId);

    // Should have emitted CONSUMER_CUTOVER_APPLIED
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("buildTimelineFromRepo") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("CF5: recovery-preconditions check #5 audit chain uses repo-first", async function () {
    var scenario = createFullScenario();

    await new Promise(function (r) { setTimeout(r, 50); });
    _resetDiagnostics();

    var result = await runRecoveryPreconditions({
      recoveryId: "rec-cf5",
      correlationId: "corr-cf5",
      rollbackSnapshotId: scenario.pair.rollback.snapshotId,
      activeSnapshotId: scenario.pair.active.snapshotId,
    });

    // Check #5: AUDIT_CHAIN_RECONSTRUCTABLE should pass
    var check5 = result.results.find(function (r) {
      return r.name === "AUDIT_CHAIN_RECONSTRUCTABLE";
    });
    expect(check5).toBeDefined();
    expect(check5.passed).toBe(true);

    // Should have emitted CONSUMER_CUTOVER_APPLIED for check #5
    var cutoverDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "CONSUMER_CUTOVER_APPLIED" &&
        d.reasonCode.indexOf("checkAuditChainReconstructable") !== -1;
    });
    expect(cutoverDiags.length).toBeGreaterThanOrEqual(1);
  });

  it("CF6: deprecated sync checkAuthorityIntegrity emits LEGACY_SYNC_COMPAT_REMOVED (P5-1)", function () {
    createFullScenario();
    _resetDiagnostics();

    var report = checkAuthorityIntegrity();
    expect(report).toBeDefined();

    // Should have emitted REMOVED diagnostic (P5-1 soft removal)
    var removedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_SYNC_COMPAT_REMOVED" &&
        d.reasonCode.indexOf("checkAuthorityIntegrity:removed") !== -1;
    });
    expect(removedDiags.length).toBe(1);
    expect(removedDiags[0].moduleName).toBe("authority-registry");
  });

  it("CF7: direct access guardrail: authority _assertNoDirectStoreAccess blocks", function () {
    _resetDiagnostics();

    expect(function () {
      _assertNoDirectStoreAccessAuthority("test-cf7-caller");
    }).toThrow("DIRECT_STORE_ACCESS_BLOCKED: test-cf7-caller must use repo-first API");

    // Should have emitted LEGACY_DIRECT_ACCESS_BLOCKED
    var blockedDiags = getDiagnosticLog().filter(function (d) {
      return d.type === "LEGACY_DIRECT_ACCESS_BLOCKED";
    });
    expect(blockedDiags.length).toBe(1);
    expect(blockedDiags[0].moduleName).toBe("authority-registry");
    expect(blockedDiags[0].reasonCode).toContain("test-cf7-caller");
  });

  it("CF8: timeline remains deterministic when repo has partial data", async function () {
    createFullScenario();
    var corrId = "corr-cf8-partial";

    // Write only ONE event — timeline should still reconstruct
    writeCanonicalAudit(createCanonicalEvent({
      eventType: "BREACH_DETECTED",
      correlationId: corrId,
      sourceModule: "containment",
      reasonCode: "THRESHOLD_EXCEEDED",
    }));

    await new Promise(function (r) { setTimeout(r, 50); });

    var timeline = await buildTimelineFromRepo(corrId);

    expect(timeline).toBeDefined();
    expect(timeline.orderedEvents.length).toBe(1);
    expect(timeline.correlationId).toBe(corrId);
    // Single event — missing hops expected, but deterministic
    expect(timeline.reconstructionStatus).toBeDefined();
  });

  it("CF9: buildTimelineFromRepo same result as buildTimeline", async function () {
    createFullScenario();
    var corrId = "corr-cf9-equiv";

    // Write canonical events
    writeCanonicalAudit(createCanonicalEvent({
      eventType: "BREACH_DETECTED",
      correlationId: corrId,
      sourceModule: "containment",
      reasonCode: "THRESHOLD_EXCEEDED",
    }));
    writeCanonicalAudit(createCanonicalEvent({
      eventType: "ROUTING_DECISION_LOGGED",
      correlationId: corrId,
      sourceModule: "routing",
      reasonCode: "ROUTE_SELECTED",
    }));

    await new Promise(function (r) { setTimeout(r, 50); });

    // Build both timelines
    var syncTimeline = buildTimeline(corrId);
    var repoTimeline = await buildTimelineFromRepo(corrId);

    // Event counts should match
    expect(repoTimeline.orderedEvents.length).toBe(syncTimeline.orderedEvents.length);
    expect(repoTimeline.correlationId).toBe(syncTimeline.correlationId);
    expect(repoTimeline.reconstructionStatus).toBe(syncTimeline.reconstructionStatus);

    // Event IDs should be the same set
    var syncIds = syncTimeline.orderedEvents.map(function (e) { return e.eventId; }).sort();
    var repoIds = repoTimeline.orderedEvents.map(function (e) { return e.eventId; }).sort();
    expect(repoIds).toEqual(syncIds);
  });
});
