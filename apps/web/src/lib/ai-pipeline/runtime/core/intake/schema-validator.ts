/**
 * S3 — Schema Validator
 *
 * schema invalid → routing 진입 금지.
 */

import type { CanonicalIntake } from "../../types/stabilization";

export interface SchemaValidationResult {
  valid: boolean;
  reasonCode: string;
  detail: string;
}

const SUPPORTED_INTAKE_TYPES: ReadonlySet<string> = new Set([
  "QUOTE",
  "INVOICE",
  "PURCHASE_ORDER",
  "VENDOR_EMAIL",
  "INTERNAL_REQUEST",
]);

const SUPPORTED_SCHEMA_VERSIONS: ReadonlySet<string> = new Set([
  "1.0",
  "1.1",
  "2.0",
]);

export function validateSchema(intake: CanonicalIntake): SchemaValidationResult {
  if (!SUPPORTED_INTAKE_TYPES.has(intake.intakeType)) {
    return {
      valid: false,
      reasonCode: "INTAKE_SCHEMA_INVALID",
      detail: `unsupported intakeType: ${intake.intakeType}`,
    };
  }

  if (!SUPPORTED_SCHEMA_VERSIONS.has(intake.schemaVersion)) {
    return {
      valid: false,
      reasonCode: "INTAKE_SCHEMA_INVALID",
      detail: `unsupported schemaVersion: ${intake.schemaVersion}`,
    };
  }

  if (!intake.payloadChecksum || intake.payloadChecksum.length < 8) {
    return {
      valid: false,
      reasonCode: "INTAKE_SCHEMA_INVALID",
      detail: "payloadChecksum too short or missing",
    };
  }

  return { valid: true, reasonCode: "SCHEMA_VALID", detail: "schema validation passed" };
}
