/**
 * S0 — Release Mode (Runtime)
 *
 * release mode 전환 검증
 */

import type { ReleaseMode } from "../../types/stabilization";

/** 허용되는 release mode 전환 */
const ALLOWED_RELEASE_MODE_TRANSITIONS: ReadonlyMap<ReleaseMode, ReadonlySet<ReleaseMode>> = new Map([
  ["CANARY_ROLLOUT", new Set<ReleaseMode>(["FULL_ACTIVE_STABILIZATION"])],
  ["FULL_ACTIVE_STABILIZATION", new Set<ReleaseMode>(["POST_STABILIZATION"])],
  ["POST_STABILIZATION", new Set<ReleaseMode>([])], // terminal
]);

export function isValidReleaseModeTransition(from: ReleaseMode, to: ReleaseMode): boolean {
  const allowed = ALLOWED_RELEASE_MODE_TRANSITIONS.get(from);
  return allowed !== undefined && allowed.has(to);
}

export function getReleaseModeTransitionReason(from: ReleaseMode, to: ReleaseMode): string {
  if (isValidReleaseModeTransition(from, to)) {
    return `release mode transition ${from} → ${to} allowed`;
  }
  return `INVALID_RELEASE_MODE_TRANSITION: ${from} → ${to} not allowed`;
}
