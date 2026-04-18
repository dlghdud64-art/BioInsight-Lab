/**
 * S3 — Intake Normalizer
 *
 * canonical intake object 정규화.
 * 누락 필드 → reject/dead-letter. silent generate 금지.
 */

import type { CanonicalIntake } from "../../types/stabilization";

export interface NormalizationResult {
  success: boolean;
  intake: CanonicalIntake | null;
  reasonCode: string;
  missingFields: string[];
}

const REQUIRED_FIELDS: readonly string[] = [
  "intakeId",
  "intakeType",
  "sourceChannel",
  "requestedAction",
  "actor",
  "payloadChecksum",
  "correlationId",
  "schemaVersion",
  "requestedPriority",
];

export function normalizeIntake(raw: Record<string, unknown>): NormalizationResult {
  const missing: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (raw[field] === undefined || raw[field] === null || raw[field] === "") {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      success: false,
      intake: null,
      reasonCode: "INTAKE_REQUIRED_FIELD_MISSING",
      missingFields: missing,
    };
  }

  const intake: CanonicalIntake = {
    intakeId: raw["intakeId"] as string,
    intakeType: raw["intakeType"] as string,
    sourceChannel: raw["sourceChannel"] as string,
    requestedAction: raw["requestedAction"] as string,
    actor: raw["actor"] as string,
    payloadChecksum: raw["payloadChecksum"] as string,
    correlationId: raw["correlationId"] as string,
    incidentId: raw["incidentId"] as string | undefined,
    receivedAt: new Date(),
    schemaVersion: raw["schemaVersion"] as string,
    requestedPriority: raw["requestedPriority"] as string,
    requestedDestination: raw["requestedDestination"] as string | undefined,
  };

  return { success: true, intake, reasonCode: "NORMALIZED", missingFields: [] };
}
