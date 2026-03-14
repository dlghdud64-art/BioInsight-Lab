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

// P1: Backlog (types only)
export {
  P1Feature,
  type P1BacklogItem,
  getP1Backlog,
} from "./p1-backlog";
