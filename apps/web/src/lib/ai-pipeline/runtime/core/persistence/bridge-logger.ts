/**
 * P1-1 Slice-1F — Bridge Logger + Truth Source Contract
 *
 * Dual-write bridge 실패 시 구조화된 경고 로그 출력.
 * 절대 throw 하지 않음 — non-fatal observability only.
 */

// ── Bridge Failure Logger ──

/**
 * Log a dual-write bridge failure as a structured warning.
 * Never throws — always returns void.
 */
export function logBridgeFailure(moduleName: string, operation: string, error: unknown): void {
  try {
    const message =
      error instanceof Error
        ? error.message
        : error !== null && error !== undefined
          ? String(error)
          : "unknown error";

    // eslint-disable-next-line no-console
    console.warn(
      `[PersistenceBridge] module=${moduleName} op=${operation} err=${message}`
    );
  } catch (_ignored) {
    // absolute last resort — never throw from the logger itself
  }
}

// ── Truth Source Contract ──

/**
 * Documents the current read/write truth source for each data path.
 * Used for operational awareness and future migration planning.
 */
export const TRUTH_SOURCE_CONTRACT = {
  baseline:           { write: "DUAL", read: "REPO_ONLY" },
  snapshot:           { write: "DUAL", read: "REPO_ONLY" },
  authority:          { write: "DUAL", read: "REPO_ONLY" },
  incident:           { write: "DUAL", read: "REPO_ONLY" },
  stabilizationAudit: { write: "DUAL", read: "REPO_ONLY" },
  canonicalAudit:     { write: "DUAL", read: "REPO_ONLY" },
  recoveryRecord:     { write: "REPO_FIRST_MEMORY_SHIM", read: "REPO_FIRST_MEMORY_FALLBACK" },
} as const;
