/**
 * P3 Slice 1 — Ontology Diagnostics
 *
 * Structured diagnostic emitter for ontology adapter operations.
 * Never throws — non-fatal observability only.
 * Same pattern as persistence/bridge-logger.ts.
 */

import type { OntologyDiagnosticEvent, OntologyDiagnosticType, AdapterDirection } from "./types";

// ── In-memory diagnostic log (for test assertions) ──

const _diagnosticLog: OntologyDiagnosticEvent[] = [];

// ── Registered bridge routes (for guardrail) ──

const _registeredRoutes = new Set<string>([
  "recovery-coordinator",
  "baseline-registry",
  "authority-registry",
  "incident-escalation",
  "audit-events",
  "canonical-event-schema",
  "snapshot-manager",
]);

// ══════════════════════════════════════════════════════════════════════════════
// Emitter
// ══════════════════════════════════════════════════════════════════════════════

export function emitOntologyDiagnostic(event: OntologyDiagnosticEvent): void {
  try {
    _diagnosticLog.push(event);
    // eslint-disable-next-line no-console
    console.warn(
      `[OntologyBridge] type=${event.type} module=${event.moduleName} adapter=${event.adapterName} ` +
      `entity=${event.entityType} dir=${event.direction} reason=${event.reasonCode} fallback=${event.fallbackUsed}`
    );
  } catch (_ignored) {
    // never throw from diagnostics
  }
}

/**
 * Convenience: emit a diagnostic with common defaults.
 */
export function emitDiagnostic(
  type: OntologyDiagnosticType,
  moduleName: string,
  adapterName: string,
  entityType: string,
  direction: AdapterDirection,
  reasonCode: string,
  opts?: {
    entityId?: string;
    correlationId?: string;
    fallbackUsed?: boolean;
  }
): void {
  emitOntologyDiagnostic({
    type,
    moduleName,
    adapterName,
    entityType,
    entityId: opts?.entityId,
    correlationId: opts?.correlationId,
    direction,
    reasonCode,
    fallbackUsed: opts?.fallbackUsed ?? false,
    timestamp: new Date(),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Bridge Route Guardrail
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Assert that a module is using the bridge route.
 * Logs a warning if the module is not registered — placeholder for future lint-like guardrail.
 */
export function assertBridgeRoute(moduleName: string, operation: string): void {
  if (!_registeredRoutes.has(moduleName)) {
    emitDiagnostic(
      "ONTOLOGY_ADAPTER_CONTRACT_VIOLATION",
      moduleName,
      "unknown",
      "unknown",
      "legacy_to_canonical",
      `unregistered bridge route: ${moduleName}/${operation}`,
      { fallbackUsed: true }
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Query + Reset (for tests)
// ══════════════════════════════════════════════════════════════════════════════

export function getDiagnosticLog(filter?: {
  type?: OntologyDiagnosticType;
  moduleName?: string;
  adapterName?: string;
}): OntologyDiagnosticEvent[] {
  if (!filter) return [..._diagnosticLog];
  return _diagnosticLog.filter(function (e) {
    if (filter.type && e.type !== filter.type) return false;
    if (filter.moduleName && e.moduleName !== filter.moduleName) return false;
    if (filter.adapterName && e.adapterName !== filter.adapterName) return false;
    return true;
  });
}

export function _resetDiagnostics(): void {
  _diagnosticLog.length = 0;
}
