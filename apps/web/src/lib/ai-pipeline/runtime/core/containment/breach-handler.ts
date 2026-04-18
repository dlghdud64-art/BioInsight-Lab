/**
 * S2 — Breach Handler
 *
 * breach 탐지 → final containment pipeline 진입.
 * silent recovery 금지, 일반 오류 경로 우회 금지.
 */

import { randomUUID } from "crypto";
import type { BreachType, BreachEntry } from "../../types/stabilization";
import { emitStabilizationAuditEvent } from "../audit/audit-events";

// ── Breach Store ──

const _breaches = new Map<string, BreachEntry>();

/** breach 탐지 + 등록 (dedupe 포함) */
export function detectBreach(
  breachType: BreachType,
  actor: string,
  mutatedScope: string,
  correlationId: string,
  detail: string
): BreachEntry {
  // dedupe: same correlationId + breachType
  const dedupeKey = `${correlationId}:${breachType}`;
  const existing = _breaches.get(dedupeKey);
  if (existing) {
    // duplicate — audit 기록만 남기고 기존 entry 반환
    emitStabilizationAuditEvent({
      eventType: "BREACH_DETECTED",
      baselineId: "",
      baselineVersion: "",
      baselineHash: "",
      snapshotId: "",
      correlationId,
      documentType: "",
      performedBy: actor,
      detail: `DUPLICATE breach detected (original=${existing.breachId}): ${detail}`,
    });
    return existing;
  }

  const incidentId = `incident-${randomUUID().slice(0, 8)}`;
  const entry: BreachEntry = {
    breachId: `breach-${randomUUID().slice(0, 8)}`,
    breachType,
    correlationId,
    incidentId,
    actor,
    mutatedScope,
    detectedAt: new Date(),
    detail,
  };

  _breaches.set(dedupeKey, entry);

  emitStabilizationAuditEvent({
    eventType: "BREACH_DETECTED",
    baselineId: "",
    baselineVersion: "",
    baselineHash: "",
    snapshotId: "",
    correlationId,
    documentType: "",
    performedBy: actor,
    detail: `${breachType}: ${detail}`,
  });

  return entry;
}

export function getBreachEntry(dedupeKey: string): BreachEntry | undefined {
  return _breaches.get(dedupeKey);
}

/** 테스트용 */
export function _resetBreaches(): void {
  _breaches.clear();
}
