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
  FinalDecision,
  AutoVerifyBlockReason,
  AutoVerifyEligibilityDecision,
  OpsApproval,
  AutoVerifyAuditFields,
  AutoVerifyPolicy,
  CriticalField,
  CriticalConflictType,
  CriticalFieldConflict,
} from "./types";

export {
  MISMATCH_CATEGORIES, REVIEW_TAGS, PROCESSING_PATHS, CANARY_STAGES,
  FINAL_DECISIONS, AUTO_VERIFY_BLOCK_REASONS, AUTO_VERIFY_ELIGIBILITY_DECISIONS,
  CRITICAL_FIELDS, CRITICAL_CONFLICT_TYPES,
} from "./types";

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
export { evaluateAutoVerify, evaluateAutoVerifyEligibility, detectFalseSafePatterns } from "./auto-verify-policy";
export type { AutoVerifyDecision, AutoVerifyInput, EligibilityResult, FalseSafePattern } from "./auto-verify-policy";
export { checkCriticalFieldConflicts, hasCriticalConflict, summarizeConflicts } from "./critical-field-checker";
export type { FieldPair } from "./critical-field-checker";
export { resolveRollbackTarget, getRollbackLadderMatrix, evaluateExpansionEligibility } from "./rollback-ladder";
export type { RollbackDecision, RollbackSeverity, ExpansionEligibility } from "./rollback-ladder";
export { resolveDecision, validateOpsApproval, createApprovalLog } from "./decision-service";
export type { DecisionInput, DecisionResult, OpsApprovalLog } from "./decision-service";
export { evaluateFinalPromotion, runFinalPreflight, extractReviewSamples } from "./final-promotion";
export type { FinalPromotionReport, FinalPromotionDecision, FinalPreflightItem, ReviewSample } from "./final-promotion";
export { getStabilizationDashboard, buildLongTailBacklog, generateStandardPlaybook, evaluatePolicyAdjustments } from "./stabilization";
export type { StabilizationDashboard, StabilizationTrend, LongTailAnomaly, OperatingState, PolicyAdjustmentAdvice } from "./stabilization";
export { selectSecondCandidate, checkParallelOpsReadiness, generateTightenedConfig, evaluateSecondPromotion, runSecondDocTypePreflight, extractSecondDocTypeReviewSamples } from "./second-doctype-rollout";
export type { SecondCandidateReport, SecondPromotionReport, SecondPromotionDecision, TightenedLaunchConfig, ParallelOpsCheck } from "./second-doctype-rollout";

// ── Phase J: Rollout Control Plane ──
export { validateTransition, toCanaryStage, toOperatingState, isActiveState, STATE_ORDER } from "./rollout-state-machine";
export type { LifecycleState, TransitionRequest, TransitionResult, TransitionType } from "./rollout-state-machine";
export { initializeRegistry, getRegistryEntry, updateRegistryEntry, getAllRegistryEntries, markAsFirstDocType, getFirstDocTypeState } from "./doctype-registry";
export type { DocTypeRegistryEntry } from "./doctype-registry";
export { createApprovalRequest, approveRequest, rejectRequest, markExecuted, getValidApproval, expireStaleApprovals, getPendingApprovals, requiresApproval } from "./approval-store";
export type { ApprovalRequest, ApprovalStatus } from "./approval-store";
export { runTransitionGuard } from "./stage-transition-guard";
export type { GuardResult, GuardCheck } from "./stage-transition-guard";
export { emitAlert, acknowledgeAlert, getAlertFeed, alertInvariantViolation, alertFalseSafe, alertRollback, alertApprovalPending } from "./alerting-service";
export type { AlertEvent, AlertSeverity, AlertEventType } from "./alerting-service";
export { runCertification } from "./certification-runner";
export type { CertificationReport, CertificationMode, CertificationResult } from "./certification-runner";
export { generateStageHealthReport, generatePromotionReadinessReport, generateAutoVerifySafetyReport, generateStabilizationReport, generateRollbackIncidentReport, generateSecondDocTypeReport, getPortfolioSummary } from "./rollout-reporting";
export type { ReportType, ReportEnvelope } from "./rollout-reporting";
export { requestPromotion, approvePromotion, rejectPromotion, rollbackToStage, emergencyOff, disableAutoVerify, forceHold, markStabilizationComplete } from "./ops-control-plane";
export type { OpsActionResult } from "./ops-control-plane";
export { runOrchestrationCycle, runPortfolioOrchestration } from "./rollout-orchestrator";
export type { OrchestrationResult } from "./rollout-orchestrator";
export { E2E_SCENARIOS, getScenarioById, getScenariosByCategory, listScenarioSummaries } from "./e2e-scenarios";
export type { E2EScenario, E2EStep } from "./e2e-scenarios";
