/**
 * S0 — Lifecycle State (Runtime)
 *
 * ACTIVE_100 + FULL_ACTIVE_STABILIZATION + FROZEN 조합만
 * canonical active baseline으로 인정.
 */

import type { LifecycleState, ReleaseMode, BaselineStatus } from "../../types/stabilization";

export interface RuntimeLifecycleState {
  lifecycleState: LifecycleState;
  releaseMode: ReleaseMode;
  baselineStatus: BaselineStatus;
  stabilizationOnly: boolean;
  featureExpansionAllowed: boolean;
  devOnlyPathAllowed: boolean;
}

/** canonical active 진입 가능 여부 판정 */
export function isCanonicalActiveRuntime(state: RuntimeLifecycleState): boolean {
  return (
    state.lifecycleState === "ACTIVE_100" &&
    state.releaseMode === "FULL_ACTIVE_STABILIZATION" &&
    state.baselineStatus === "FROZEN" &&
    state.stabilizationOnly === true &&
    state.featureExpansionAllowed === false &&
    state.devOnlyPathAllowed === false
  );
}

/** canonical active 조합 외 진입 시 차단 사유 */
export function getActiveRuntimeBlockReason(state: RuntimeLifecycleState): string | null {
  if (state.lifecycleState !== "ACTIVE_100") {
    return `LIFECYCLE_NOT_ACTIVE_100: ${state.lifecycleState}`;
  }
  if (state.releaseMode !== "FULL_ACTIVE_STABILIZATION") {
    return `RELEASE_MODE_NOT_STABILIZATION: ${state.releaseMode}`;
  }
  if (state.baselineStatus !== "FROZEN") {
    return `BASELINE_NOT_FROZEN: ${state.baselineStatus}`;
  }
  if (!state.stabilizationOnly) {
    return "STABILIZATION_ONLY_FALSE";
  }
  if (state.featureExpansionAllowed) {
    return "FEATURE_EXPANSION_ALLOWED_TRUE";
  }
  if (state.devOnlyPathAllowed) {
    return "DEV_ONLY_PATH_ALLOWED_TRUE";
  }
  return null;
}
