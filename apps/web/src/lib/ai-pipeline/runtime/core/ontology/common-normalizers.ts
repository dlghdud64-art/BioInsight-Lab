/**
 * P3 Slice 1 — Common Normalizers
 *
 * Pure functions for normalizing field shapes across the
 * legacy → canonical → persistence boundary.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Null / Undefined Normalization
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Convert undefined to null. Prisma rejects undefined for nullable columns.
 */
export function toNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

// ══════════════════════════════════════════════════════════════════════════════
// ID Normalization
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize an optional ID: trim, empty → null.
 */
export function normalizeId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Require a non-empty ID. Throws if missing.
 */
export function requireId(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeId(value);
  if (normalized === null) {
    throw new TypeError(`requireId: ${fieldName} is required but got empty/null/undefined`);
  }
  return normalized;
}

// ══════════════════════════════════════════════════════════════════════════════
// Enum / String Normalization
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize an enum value: trim, validate against allowed set, return fallback if invalid.
 */
export function normalizeEnum<T extends string>(
  value: string | null | undefined,
  validValues: readonly T[],
  fallback: T
): T {
  if (value === null || value === undefined) return fallback;
  const trimmed = value.trim();
  if ((validValues as readonly string[]).includes(trimmed)) {
    return trimmed as T;
  }
  return fallback;
}

// ══════════════════════════════════════════════════════════════════════════════
// Array / JSON Normalization
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Guarantee an array from a possibly null/undefined/array input.
 */
export function normalizeArray<T>(value: T[] | null | undefined | unknown): T[] {
  if (Array.isArray(value)) return value;
  return [];
}

/**
 * Normalize a JSON-serializable value. null/undefined → null.
 */
export function normalizeJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return value;
}

// ══════════════════════════════════════════════════════════════════════════════
// Empty String ↔ Null Normalization
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Convert empty string to null (legacy → canonical direction).
 */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value === "" ? null : value;
}

/**
 * Convert null to empty string (canonical → legacy direction).
 */
export function nullToEmpty(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value;
}

// ══════════════════════════════════════════════════════════════════════════════
// Field Alias Constants (documentation + diagnostic reference)
// ══════════════════════════════════════════════════════════════════════════════

export interface FieldAlias {
  legacy: string;
  canonical: string;
  persisted: string;
}

export const RECOVERY_ALIASES: readonly FieldAlias[] = [
  { legacy: "actor", canonical: "operatorId", persisted: "operatorId" },
  { legacy: "failReason", canonical: "failureReasonCode", persisted: "failureReasonCode" },
  { legacy: "currentState", canonical: "recoveryState", persisted: "recoveryState" },
  { legacy: "stages", canonical: "stageResults", persisted: "stageResults" },
  { legacy: "preconditionResults", canonical: "preconditionResults", persisted: "preconditionResults" },
] as const;

export const BASELINE_ALIASES: readonly FieldAlias[] = [
  { legacy: "canonicalBaselineId", canonical: "baselineId", persisted: "id" },
] as const;

export const AUTHORITY_ALIASES: readonly FieldAlias[] = [
  { legacy: "registryVersion(number)", canonical: "registryVersion(string)", persisted: "registryVersion(string)" },
] as const;

export const INCIDENT_ALIASES: readonly FieldAlias[] = [
  { legacy: "actor", canonical: "acknowledgedBy", persisted: "acknowledgedBy" },
  { legacy: "escalatedAt", canonical: "createdAt", persisted: "createdAt" },
  { legacy: "acknowledged(boolean)", canonical: "status(string)", persisted: "status(string)" },
] as const;

export const STABILIZATION_AUDIT_ALIASES: readonly FieldAlias[] = [
  { legacy: "performedBy", canonical: "actor", persisted: "actor" },
  { legacy: "detail", canonical: "reasonCode", persisted: "reasonCode" },
  { legacy: "timestamp", canonical: "occurredAt", persisted: "occurredAt" },
] as const;

export const CANONICAL_AUDIT_ALIASES: readonly FieldAlias[] = [
  { legacy: "schemaVersion", canonical: "(none)", persisted: "(none)" },
] as const;

export const SNAPSHOT_ALIASES: readonly FieldAlias[] = [
  { legacy: "tag", canonical: "snapshotType", persisted: "snapshotType" },
  { legacy: "capturedAt", canonical: "capturedAt", persisted: "createdAt" },
  { legacy: "scopes(full)", canonical: "scopes(full)", persisted: "checksums-only" },
] as const;
