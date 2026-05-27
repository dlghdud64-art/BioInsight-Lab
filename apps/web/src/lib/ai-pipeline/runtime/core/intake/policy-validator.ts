/**
 * S3 — Policy Validator
 *
 * policy 위반 → verified routing 생성 금지.
 */

import type { CanonicalIntake, AllowedAction } from "../../types/stabilization";
import { checkActionPermission } from "../runtime/action-permission-map";

export interface PolicyValidationResult {
  valid: boolean;
  reasonCode: string;
  detail: string;
}

export function validatePolicy(
  intake: CanonicalIntake,
  lifecycleState: string,
  releaseMode: string
): PolicyValidationResult {
  // action permission 검사
  const actionCheck = checkActionPermission(
    lifecycleState as any,
    releaseMode as any,
    intake.requestedAction
  );

  if (!actionCheck.allowed) {
    return {
      valid: false,
      reasonCode: "ACTION_NOT_ALLOWED_BY_STABILIZATION_POLICY",
      detail: `${intake.requestedAction}: ${actionCheck.reasonCode}`,
    };
  }

  // requestedDestination override 검사
  if (intake.requestedDestination) {
    return {
      valid: true,
      reasonCode: "POLICY_VALID_REQUESTED_DESTINATION_IGNORED",
      detail: "requestedDestination present but will be overridden by verified resolver",
    };
  }

  return { valid: true, reasonCode: "POLICY_VALID", detail: "policy validation passed" };
}
