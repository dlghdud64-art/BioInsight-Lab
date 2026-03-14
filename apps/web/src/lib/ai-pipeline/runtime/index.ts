/**
 * P0 Runtime — AI Canary Rollout & Safety Layer
 * 실운영 AI 도입을 위한 최소 운영 루프.
 */

// P0-1: Runtime Safety Layer
export {
  type SafetyLayerConfig,
  type SafetyLayerResult,
  type ExecuteWithSafetyParams,
  DEFAULT_SAFETY_CONFIG,
  getCanaryConfig,
  computeRequestHash,
  shouldApplyAiResult,
  isShadowMode,
  computeRuleBasedResult,
  computeComparisonDiff,
  executeWithSafety,
} from "./safety-layer";

// P0-2: DocumentType Rollout Spine
export {
  MismatchCategory,
  type ComparisonLogEntry,
  type ComparisonSummary,
  type DocTypeCanaryState,
  getStageProgression,
  getDocTypeConfig,
  ensureCanaryConfig,
  promoteStage,
  rollbackStage,
  holdStage,
  activateKillSwitch,
  deactivateKillSwitch,
  compareResults,
  getComparisonSummary,
} from "./doctype-rollout";

// P0-3: Restricted Auto-Verify
export {
  type AutoVerifyDecision,
  type CriticalFieldConflict,
  type FalseSafeResult,
  type ExclusionConfig,
  type EvaluateAutoVerifyParams,
  checkCriticalFieldConflict,
  detectFalseSafe,
  isExcluded,
  toggleAutoVerify,
  evaluateAutoVerify,
} from "./auto-verify";

// P0-5: Audit / Observability / Incident Loop
export {
  type IncidentType,
  type IncidentTriggerCondition,
  type IncidentAlert,
  type ProcessingStats,
  type DailySummary,
  type RecordProcessingParams,
  DEFAULT_INCIDENT_CONDITIONS,
  recordProcessing,
  checkIncidentTriggers,
  getProcessingStats,
  getDailySummary,
} from "./audit-loop";

// P0-6: Human Ops Minimum
export {
  type ReviewCandidate,
  type ChecklistItem,
  type DailyOpsReport,
  type RunbookEntry,
  getReviewQueue,
  getLaunchChecklist,
  getRollbackChecklist,
  generateDailyOpsReport,
  getRunbook,
} from "./ops-checklist";

// P0-7: Rollout Execution Config
export {
  type RolloutStep,
  type RolloutConstraint,
  type RolloutPlan,
  type PromoteCheck,
  type ConstraintValidation,
  getRolloutPlan,
  getNextStep,
  canPromote,
  validateConstraints,
} from "./rollout-config";

// Shadow Validation & ACTIVE_5 Entry
export {
  type ShadowValidationRecord,
  type ShadowReport,
  type ConfidenceBandDist,
  type Active5CriteriaTable,
  type ShadowDecision,
  type ShadowDecisionResult,
  type PreflightItem,
  type PreflightResult,
  type Active5LaunchConfig,
  generateShadowReport,
  lockActive5Criteria,
  evaluateShadowDecision,
  runActive5Preflight,
  createActive5LaunchConfig,
} from "./shadow-validation";

// Watchboard Metrics
export {
  type WatchboardMetrics,
  type WatchboardTrend,
  type WatchboardInterval,
  collectWatchboardMetrics,
  collectWatchboardTrend,
} from "./watchboard";

// ACTIVE_5 Post-Run & ACTIVE_25 Entry
export {
  type Active5Decision,
  type Active5PostRunReport,
  type Active5Thresholds,
  type Active25LaunchConfig,
  generateActive5PostRunReport,
  createActive25LaunchConfig,
} from "./active5-postrun";

// ACTIVE_25 Post-Run & ACTIVE_50 Eval
export {
  type Active25Decision,
  type Active25PostRunReport,
  type Active25Thresholds,
  type HotspotSummary,
  type FalseSafeSummary,
  type CriticalFieldConflictSummary,
  type Active25FullLaunchConfig,
  generateActive25PostRunReport,
  createActive25FullLaunchConfig,
} from "./active25-postrun";

// ACTIVE_50 Eligibility & Restricted Auto-Verify
export {
  type Active50Decision,
  type ConfidenceBandAnalysis,
  type CriticalFieldType,
  type ConflictRiskLevel,
  type CriticalFieldConflictDetail,
  type CriticalFieldConflictReport,
  type ExclusionProposal,
  type RestrictedAutoVerifyPolicy,
  type EligibilityEvaluationReport,
  type Active50LaunchConfig,
  type Active50Thresholds,
  type AutoVerifyGateInput,
  type AutoVerifyGateResult,
  analyzeConfidenceBands,
  analyzeCriticalFieldConflicts,
  buildExclusionProposal,
  buildRestrictedAutoVerifyPolicy,
  generateEligibilityReport,
  checkAutoVerifyGate,
} from "./active50-eligibility";

// ACTIVE_50 Post-Run & ACTIVE_100 (STABLE) Promotion
export {
  type Active50PostRunDecision,
  type RestrictedAutoVerifySafetyReport,
  type AutoVerifyBlockReasonSummary,
  type Active50PostRunReport,
  type Active50PostRunThresholds,
  type Active100LaunchConfig,
  generateActive50PostRunReport,
  createActive100LaunchConfig,
} from "./active50-postrun";

// P1: Backlog (types only)
export {
  P1Feature,
  type P1BacklogItem,
  getP1Backlog,
} from "./p1-backlog";
