// @ts-nocheck — shadow pipeline: experimental code, type-check deferred
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

// ── Phase K: Ops Launch Readiness & Day-2 Operations ──
export { SLO_DEFINITIONS, ALERT_ROUTING_RULES, resolveAlertSeverity, getSLOForSeverity, getAutoAction, checkSLACompliance } from "./slo-alert-routing";
export type { SeverityLevel, SLODefinition, AlertRoutingRule } from "./slo-alert-routing";
export { STANDARD_RUNBOOKS, getRunbookById, getRunbooksBySeverity, createPostmortemTemplate } from "./ops-runbook";
export type { RunbookEntry, RunbookStep, PostmortemTemplate } from "./ops-runbook";
export { evaluateLaunchReadiness, createFreezeWindow, cancelFreezeWindow, getActiveFreezeWindows, isInFreezeWindow, checkFreezeBlock } from "./launch-readiness-gate";
export type { LaunchReadinessResult, ReadinessCheckItem, FreezeWindow } from "./launch-readiness-gate";
export { enqueueReview, assignReview, resolveReview, getReviewQueue, getReviewQueueStats } from "./review-ops-queue";
export type { ReviewItem, ReviewQueueStats, ReviewPriority, ReviewStatus, ReviewResolutionType } from "./review-ops-queue";
export { getPortfolioDashboardData, generateWeeklyCouncilReport, generateDailyOpsSummary } from "./ops-dashboard";
export type { PortfolioDashboardData, WeeklyCouncilReport, DailyOpsSummary } from "./ops-dashboard";
export { DRILL_DEFINITIONS, startDrill, markDrillDetected, markDrillRolledBack, completeDrill, getDrillHistory, getDrillDefinition, summarizeDrillResult } from "./incident-drill";
export type { DrillScenario, DrillExecution, DrillDefinition } from "./incident-drill";

// ── Phase L: Portfolio Governance & Multi-DocType Expansion Control ──
export { classifyDocTypeTier, validateConcurrentPromotion, TIER_LABELS } from "./doctype-tiering";
export type { RiskTier, TieringInput, TieringResult } from "./doctype-tiering";
export { assessCapacity, collectCapacityInput } from "./capacity-manager";
export type { CapacityStatus, CapacityInput, CapacityAssessment } from "./capacity-manager";
export { enqueuePromotion, evaluateQueue, markQueueItemExecuting, markQueueItemCompleted, cancelQueueItem, getQueuedItems, getFullQueue, getQueueStats } from "./promotion-queue";
export type { PromotionQueueItem, QueueItemStatus } from "./promotion-queue";
export { computeReadinessScore, compareByReadiness } from "./ops-load-scoring";
export type { OpsLoadInput, ReadinessScoreResult } from "./ops-load-scoring";
export { registerExclusion, getExclusionsForNewDocType, checkExclusion, applyExclusionsToDocType, deactivateExclusion, getExclusionRegistry, getExclusionStats } from "./shared-exclusion-registry";
export type { ExclusionEntry, ExclusionSource, ExclusionScope, ExclusionMatchResult } from "./shared-exclusion-registry";
export { checkExpansionPolicy, getPortfolioMode, setPortfolioMode, EXPANSION_LIMITS, evaluateAutoModeTransition, checkThirdDocTypeAdmission } from "./expansion-policy";
export type { PortfolioMode, PortfolioModeState, ExpansionPolicyResult } from "./expansion-policy";
export { evaluateExpansionRequest, getPortfolioRiskSummary } from "./portfolio-governor";
export type { GovernorDecision, PortfolioRiskSummary } from "./portfolio-governor";
export { getPortfolioRiskDashboard, generateExpansionCouncilReport } from "./portfolio-risk-dashboard";
export type { PortfolioRiskDashboardData, ExpansionCouncilReport } from "./portfolio-risk-dashboard";

// ── Phase M: Policy Learning Loop & Cost/Quality Optimization ──
export { registerPolicy, updatePolicy, getPolicyById, getPoliciesByScope, getActivePolicies, getPolicyHistory } from "./policy-registry";
export { analyzeCostQuality, identifyInefficientSegments, identifySafeSegments } from "./cost-quality-analyzer";
export { proposeModelAllocations } from "./model-allocation-engine";
export { proposeBandTuning } from "./confidence-band-tuner";
export { proposeExclusionChanges } from "./exclusion-learning";
export { runLearningCycle } from "./policy-learning-loop";
export { createExperiment, advanceExperiment, getExperimentResults } from "./experiment-runner";
export { evaluateOptimizationProposal } from "./optimization-approval";
export { monitorPolicyDrift, getPolicyDriftHistory } from "./policy-drift-monitoring";
export { computeReviewRouting, optimizeQueueRouting } from "./review-routing-optimizer";

// ── Phase P: Strategic Command Layer ──
export { generateRecommendations } from "./recommendation-engine";
export { rankExpansionCandidates } from "./expansion-priority-engine";
export { computeAllocation } from "./risk-budget-allocator";
export { runSimulation, PREDEFINED_SCENARIOS } from "./portfolio-scenario-simulator";
export { buildDecisionPackage, recordDecision, vetoDecision, getPendingDecisions } from "./executive-decision-matrix";
export { logStrategicAction, getStrategicAuditLog } from "./strategic-audit-log";
export { forecastCapacity, forecastMultiHorizon } from "./capacity-forecast-engine";
export { generateHeatmap, identifyHotspots, identifyInefficientCells } from "./anomaly-heatmap-engine";
export { getCommandCenterData } from "./command-center-dashboard";
export { computeOrgBenchmarks, rankOrgs, identifyOutliers } from "./org-benchmarking";
