/**
 * Ops Reconciliation & Retry Semantics Tests
 *
 * 큐↔엔티티 drift 감지, 큐 이상 탐지, 재시도 정책 검증.
 */

import {
  detectEntityQueueDrift,
  detectQueueAnomalies,
  type DriftResult,
} from "@/lib/work-queue/ops-reconciliation";

import {
  OPS_RETRY_POLICIES,
  resolveRetryPolicy,
  resolveRetryPolicyFromResponse,
} from "@/lib/work-queue/ops-retry-semantics";

// ── 1. Drift Detection ──

describe("detectEntityQueueDrift", () => {
  test("returns hasDrift: false when entity and queue are in sync", () => {
    const result = detectEntityQueueDrift(
      { status: "SENT", entityType: "QUOTE" },
      { substatus: "email_sent", taskStatus: "WAITING_RESPONSE" },
    );
    expect(result.hasDrift).toBe(false);
    expect(result.driftType).toBeNull();
    expect(result.recommendation).toBe("ignore");
  });

  test("returns substatus_mismatch when entity is active but queue is completed", () => {
    const result = detectEntityQueueDrift(
      { status: "SENT", entityType: "QUOTE" },
      { substatus: "quote_completed", taskStatus: "COMPLETED" },
    );
    expect(result.hasDrift).toBe(true);
    expect(result.driftType).toBe("substatus_mismatch");
    expect(result.recommendation).toBe("resync");
  });

  test("returns missing_queue when entity is active but no queue item", () => {
    const result = detectEntityQueueDrift(
      { status: "SENT", entityType: "QUOTE" },
      null,
    );
    expect(result.hasDrift).toBe(true);
    expect(result.driftType).toBe("missing_queue");
    expect(result.recommendation).toBe("create");
    expect(result.expected).toBe("ops_quote_followup");
  });

  test("returns orphan_queue when entity is terminal but queue is active", () => {
    const result = detectEntityQueueDrift(
      { status: "ACCEPTED", entityType: "QUOTE" },
      { substatus: "email_sent", taskStatus: "WAITING_RESPONSE" },
    );
    expect(result.hasDrift).toBe(true);
    expect(result.driftType).toBe("orphan_queue");
    expect(result.recommendation).toBe("close");
  });

  test("returns no drift when entity is terminal and no queue item", () => {
    const result = detectEntityQueueDrift(
      { status: "DELIVERED", entityType: "ORDER" },
      null,
    );
    expect(result.hasDrift).toBe(false);
    expect(result.recommendation).toBe("ignore");
  });
});

// ── 2. Queue Anomalies ──

describe("detectQueueAnomalies", () => {
  test("returns empty for well-formed queue items", () => {
    const items = [
      { id: "a", taskStatus: "ACTION_NEEDED", substatus: "email_sent", updatedAt: new Date().toISOString() },
    ];
    expect(detectQueueAnomalies(items)).toEqual([]);
  });

  test("detects duplicate active items", () => {
    const items = [
      { id: "a", taskStatus: "ACTION_NEEDED", substatus: "s1", updatedAt: new Date().toISOString() },
      { id: "b", taskStatus: "REVIEW_NEEDED", substatus: "s2", updatedAt: new Date().toISOString() },
    ];
    const anomalies = detectQueueAnomalies(items);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].anomaly).toBe("duplicate_active");
    expect(anomalies[0].itemId).toBe("b");
  });

  test("detects stale active items (30+ days)", () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const items = [
      { id: "a", taskStatus: "WAITING_RESPONSE", substatus: "s1", updatedAt: oldDate },
    ];
    const anomalies = detectQueueAnomalies(items);
    expect(anomalies.some((a) => a.anomaly === "stale_active")).toBe(true);
  });

  test("handles null queue item gracefully via empty array", () => {
    expect(detectQueueAnomalies([])).toEqual([]);
  });
});

// ── 3. Retry Policies ──

describe("resolveRetryPolicy", () => {
  test("returns non-retryable for 409_conflict", () => {
    const policy = resolveRetryPolicy("409_conflict");
    expect(policy).not.toBeNull();
    expect(policy!.retryable).toBe(false);
    expect(policy!.maxRetries).toBe(0);
    expect(policy!.recoveryAction).toBe("none");
  });

  test("returns retryable with max 1 for execution_failed", () => {
    const policy = resolveRetryPolicy("execution_failed");
    expect(policy).not.toBeNull();
    expect(policy!.retryable).toBe(true);
    expect(policy!.maxRetries).toBe(1);
    expect(policy!.recoveryAction).toBe("retry");
  });

  test("returns retryable with max 2 for network_error", () => {
    const policy = resolveRetryPolicy("network_error");
    expect(policy).not.toBeNull();
    expect(policy!.retryable).toBe(true);
    expect(policy!.maxRetries).toBe(2);
  });

  test("returns null for nonexistent error code", () => {
    expect(resolveRetryPolicy("nonexistent")).toBeNull();
  });
});

// ── 4. Integration ──

describe("OPS_RETRY_POLICIES", () => {
  const allPolicies = Object.values(OPS_RETRY_POLICIES);

  test("all policies have required fields", () => {
    for (const policy of allPolicies) {
      expect(typeof policy.errorType).toBe("string");
      expect(policy.errorType.length).toBeGreaterThan(0);
      expect(typeof policy.retryable).toBe("boolean");
      expect(typeof policy.maxRetries).toBe("number");
      expect(policy.maxRetries).toBeGreaterThanOrEqual(0);
      expect(typeof policy.userMessage).toBe("string");
      expect(policy.userMessage.length).toBeGreaterThan(0);
      expect(["retry", "resync", "manual", "none"]).toContain(policy.recoveryAction);
    }
  });

  test("all userMessages are non-empty Korean strings", () => {
    for (const policy of allPolicies) {
      expect(policy.userMessage.length).toBeGreaterThan(0);
      // Korean text contains at least one Hangul character
      expect(/[\uAC00-\uD7AF]/.test(policy.userMessage)).toBe(true);
    }
  });
});

describe("resolveRetryPolicyFromResponse", () => {
  test("maps 409 status to conflict policy", () => {
    const policy = resolveRetryPolicyFromResponse(409);
    expect(policy?.errorType).toBe("409_conflict");
  });

  test("maps 500 status to execution_failed policy", () => {
    const policy = resolveRetryPolicyFromResponse(500);
    expect(policy?.errorType).toBe("execution_failed");
  });

  test("maps DUPLICATE_ACTION error body to conflict policy", () => {
    const policy = resolveRetryPolicyFromResponse(409, { error: "DUPLICATE_ACTION" });
    expect(policy?.errorType).toBe("409_conflict");
  });

  test("maps INVALID_STATE error body to invalid_state policy", () => {
    const policy = resolveRetryPolicyFromResponse(400, { error: "INVALID_STATE" });
    expect(policy?.errorType).toBe("invalid_state");
    expect(policy?.recoveryAction).toBe("resync");
  });
});
