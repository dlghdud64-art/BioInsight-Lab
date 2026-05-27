/**
 * S0 — Merge Gate
 *
 * stabilizationTag 없는 patch는 merge 금지
 * non-stabilization patch 차단
 */

import type { MergeGateResult, ChangeRequestMetadata } from "../../types/stabilization";
import { evaluateFreezeGate } from "./stabilization-policy";

/** merge gate 최종 판정: freeze gate + 추가 검사 */
export function evaluateMergeGate(
  metadata: Partial<ChangeRequestMetadata>,
  stabilizationActive: boolean
): MergeGateResult {
  // delegate to freeze gate
  const gate = evaluateFreezeGate(metadata, stabilizationActive);

  if (!gate.allowed) {
    return {
      allowed: false,
      reason: gate.reason,
      missingFields: gate.missingFields,
    };
  }

  // 추가 검사: empty justification
  if (metadata.justification && metadata.justification.trim().length < 10) {
    return {
      allowed: false,
      reason: "JUSTIFICATION_TOO_SHORT: justification must be >= 10 chars",
      missingFields: [],
    };
  }

  return { allowed: true, reason: "merge gate passed", missingFields: [] };
}
