/**
 * P3 Slice 1 — Ontology Date Normalizer
 *
 * Wraps the existing persistence/date-normalizer with diagnostic emission.
 * The original normalizer stays untouched — this adds observability.
 */

import { normalizeDate, normalizeDateOptional } from "../persistence/date-normalizer";
import { emitDiagnostic } from "./diagnostics";

// Re-export originals for backward compat
export { normalizeDate, normalizeDateOptional };

export interface DateNormalizerContext {
  adapterName: string;
  entityType: string;
  entityId?: string;
  correlationId?: string;
}

/**
 * Normalize a date value with diagnostic tracking.
 *
 * - null/undefined → null (no diagnostic)
 * - Date instance (valid) → as-is (no diagnostic)
 * - string/number → normalizeDate() + DATE_NORMALIZATION_APPLIED diagnostic
 * - invalid → DATE_NORMALIZATION_FAILED diagnostic + throw
 */
export function normalizeDateWithDiagnostic(
  value: Date | string | number | null | undefined,
  fieldName: string,
  context: DateNormalizerContext
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      emitDiagnostic(
        "DATE_NORMALIZATION_FAILED",
        context.adapterName,
        context.adapterName,
        context.entityType,
        "legacy_to_canonical",
        `invalid Date instance for field ${fieldName}`,
        { entityId: context.entityId, correlationId: context.correlationId }
      );
      throw new TypeError(`normalizeDateWithDiagnostic: invalid Date for field ${fieldName}`);
    }
    return value;
  }

  // string or number — conversion needed
  try {
    const result = normalizeDate(value);
    emitDiagnostic(
      "DATE_NORMALIZATION_APPLIED",
      context.adapterName,
      context.adapterName,
      context.entityType,
      "legacy_to_canonical",
      `${typeof value} → Date for field ${fieldName}`,
      { entityId: context.entityId, correlationId: context.correlationId }
    );
    return result;
  } catch (err) {
    emitDiagnostic(
      "DATE_NORMALIZATION_FAILED",
      context.adapterName,
      context.adapterName,
      context.entityType,
      "legacy_to_canonical",
      `cannot parse ${typeof value} "${String(value)}" for field ${fieldName}`,
      { entityId: context.entityId, correlationId: context.correlationId }
    );
    throw err;
  }
}

/**
 * Normalize a required date field — throws if null/undefined.
 */
export function requireDateWithDiagnostic(
  value: Date | string | number | null | undefined,
  fieldName: string,
  context: DateNormalizerContext
): Date {
  const result = normalizeDateWithDiagnostic(value, fieldName, context);
  if (result === null) {
    emitDiagnostic(
      "DATE_NORMALIZATION_FAILED",
      context.adapterName,
      context.adapterName,
      context.entityType,
      "legacy_to_canonical",
      `required date field ${fieldName} is null/undefined`,
      { entityId: context.entityId, correlationId: context.correlationId }
    );
    throw new TypeError(`requireDateWithDiagnostic: ${fieldName} is required but got null/undefined`);
  }
  return result;
}
