/**
 * Shadow Mode + Canary Rollout — Barrel Export
 */

export type {
  MismatchCategory,
  ShadowReviewTag,
  ShadowRuntimeConfig,
  ShadowComparisonRecord,
  ShadowReport,
  RolloutGateResult,
  ProcessingPath,
  CanaryStage,
  CanaryConfig,
  DocTypeCanaryConfig,
  DocTypeMetrics,
  CanaryHaltEvent,
} from "./types";

export { MISMATCH_CATEGORIES, REVIEW_TAGS, PROCESSING_PATHS, CANARY_STAGES } from "./types";
export { loadShadowConfig, isInRollout } from "./config";
export { loadCanaryConfig, getDocTypeConfig, resolveProcessingPath, stableBucket, isInCanaryBucket, validatePromotion } from "./canary-config";
export { logShadowComparison } from "./comparison-logger";
export { ShadowRuntimeGateway } from "./runtime-gateway";
export { generateShadowReport } from "./report-aggregator";
export { evaluateRolloutGate } from "./rollout-gate";
export { checkCircuitBreaker } from "./circuit-breaker";
export { getPerDocTypeMetrics } from "./canary-metrics";
export { runPreflightCheck } from "./preflight";
export type { PreflightCheckResult, PreflightItem } from "./preflight";
export { getWatchboardMetrics, generateCanaryRunSummary } from "./watchboard";
export type { WatchboardMetrics, WatchboardQuery, CanaryRunSummary } from "./watchboard";
export { evaluatePromotionGate } from "./promotion-gate";
export type { PromotionGateReport, PromotionDecision, PromotionThresholds } from "./promotion-gate";
export { analyzeAnomalies } from "./anomaly-analyzer";
export type { AnomalyReport, VendorHotspot, ConfidenceBand } from "./anomaly-analyzer";
