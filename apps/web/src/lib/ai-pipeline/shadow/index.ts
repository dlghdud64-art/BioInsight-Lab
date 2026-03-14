/**
 * Shadow Mode — Barrel Export
 */

export type {
  MismatchCategory,
  ShadowReviewTag,
  ShadowRuntimeConfig,
  ShadowComparisonRecord,
  ShadowReport,
  RolloutGateResult,
} from "./types";

export { MISMATCH_CATEGORIES, REVIEW_TAGS } from "./types";
export { loadShadowConfig, isInRollout } from "./config";
export { logShadowComparison } from "./comparison-logger";
export { ShadowRuntimeGateway } from "./runtime-gateway";
export { generateShadowReport } from "./report-aggregator";
export { evaluateRolloutGate } from "./rollout-gate";
