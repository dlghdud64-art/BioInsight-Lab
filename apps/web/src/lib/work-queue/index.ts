export {
  resolveState,
  resolveInitialState,
  resolveLegacyState,
  TASK_STATUS_SORT_ORDER,
  TASK_STATUS_BADGE,
  APPROVAL_STATUS_BADGE,
} from "./state-mapper";

export type {
  TaskStatus,
  ApprovalStatus,
  AiActionType,
  StateMapping,
} from "./state-mapper";

export {
  transitionWorkItem,
  createWorkItem,
  queryWorkQueue,
} from "./work-queue-service";

export type {
  TransitionParams,
  CreateWorkItemParams,
  WorkQueueFilters,
  WorkQueueItem,
} from "./work-queue-service";

export {
  computeImpactScore,
  computeUrgencyScore,
  computeApprovalBoost,
  computeTotalScore,
  getUrgencyReason,
} from "./scoring";

export type {
  ScoredItem,
  ScoreResult,
} from "./scoring";

export {
  OPS_SUBSTATUS_DEFS,
  OPS_HANDOFF_RULES,
  OPS_FUNNEL_STAGES,
  OPS_STALL_LABELS,
  OPS_ACTIVITY_LABELS,
  OPS_QUEUE_ITEM_TYPES,
  OPS_QUEUE_CTA_MAP,
  OPS_OWNERSHIP_TRANSFERS,
  OPS_CTA_COMPLETION_DEFS,
  getOpsStage,
  isOpsTerminal,
  isOpsSubstatus,
  isOpsSlaBreach,
  isOpsStale,
  determineOpsStallPoint,
  determineOpsQueueItemType,
  findCompletionDef,
  resolveOwnershipTransfer,
} from "./ops-queue-semantics";

export type {
  OpsStage,
  OpsSubstatusDefinition,
  OpsHandoffRule,
  OpsStallPoint,
  OpsQueueItemType,
  OpsOwnershipTransfer,
  OpsQueueItemTypeInput,
  OpsCTACompletionDef,
} from "./ops-queue-semantics";

export {
  detectEntityQueueDrift,
  detectQueueAnomalies,
} from "./ops-reconciliation";

export type {
  DriftResult,
  DriftType,
  QueueAnomaly,
} from "./ops-reconciliation";

export {
  OPS_RETRY_POLICIES,
  resolveRetryPolicy,
  resolveRetryPolicyFromResponse,
} from "./ops-retry-semantics";

export type {
  RetryPolicy,
  RecoveryAction,
} from "./ops-retry-semantics";

export {
  assignPriorityTier,
  applyPromotionRules,
  computeFinalTier,
  PRIORITY_TIER_DEFS,
} from "./console-priorities";

export type {
  PriorityTier,
  PriorityTierDef,
} from "./console-priorities";

export {
  groupForConsole,
  groupForConsoleWithView,
  resolveOwnerRole,
  resolveConsoleCta,
  computeConsoleSummary,
  OWNER_ROLE_LABELS,
} from "./console-grouping";

export type {
  ConsoleGroupId,
  ConsoleGroup,
  GroupedItem,
  ConsoleSummary,
} from "./console-grouping";

export {
  resolveAssignmentState,
  canTransition,
  validateAction,
  buildHandoffPayload,
  extractHandoffInfo,
  isMyWork,
  isUnassigned,
  shouldActorAct,
  filterForView,
  getAvailableActions,
  ASSIGNMENT_STATE_DEFS,
  ASSIGNMENT_ACTION_DEFS,
  ASSIGNMENT_STATE_LABELS,
  ASSIGNMENT_ACTION_LABELS,
  CONSOLE_VIEW_LABELS,
} from "./console-assignment";

export type {
  AssignmentState,
  AssignmentAction,
  ConsoleView,
  HandoffInfo,
  AssignmentStateDef,
  AssignmentActionDef,
} from "./console-assignment";

export {
  executeAssignmentAction,
  queryAccountabilityData,
} from "./work-queue-service";

export type {
  AssignmentActionParams,
} from "./work-queue-service";

export {
  computeAccountabilityMetrics,
  evaluateEscalations,
  getEscalationBoost,
  filterForPersonalView,
  computeOwnerReport,
  buildAssignmentAuditTrail,
  ACCOUNTABILITY_METRIC_DEFS,
  ESCALATION_RULE_DEFS,
  PERSONAL_WORKLOAD_VIEW_DEFS,
  PERSONAL_WORKLOAD_VIEW_LABELS,
} from "./console-accountability";

export type {
  ActivityLogEntry,
  AccountabilityMetricId,
  AccountabilityMetricDef,
  AccountabilityMetrics,
  EscalationRuleId,
  EscalationRuleDef,
  EscalationResult,
  PersonalWorkloadViewId,
  PersonalWorkloadViewDef,
  AssignmentAuditTrail,
  OwnerReport,
} from "./console-accountability";

export {
  applyEscalationBoost,
} from "./console-priorities";

export {
  computeConsoleSummaryWithAccountability,
} from "./console-grouping";

export {
  selectDailyReviewItems,
  getAvailableEscalationActions,
  getAvailableReviewOutcomes,
  buildReviewRecord,
  applyReviewOutcome,
  applyEscalationAction,
  computeCarryOver,
  splitByVisibility,
  DAILY_REVIEW_CATEGORY_DEFS,
  DAILY_REVIEW_CATEGORY_LABELS,
  ESCALATION_ACTION_DEFS as DAILY_REVIEW_ESCALATION_ACTION_DEFS,
  ESCALATION_ACTION_LABELS,
  REVIEW_OUTCOME_DEFS,
  REVIEW_OUTCOME_LABELS,
  CARRY_OVER_DEFS,
} from "./console-daily-review";

export type {
  DailyReviewCategoryId,
  DailyReviewCategoryDef,
  EscalationActionId,
  EscalationActionDef,
  ReviewOutcomeId,
  ReviewOutcomeDef,
  ReviewRecord,
  CarryOverReason,
  CarryOverEntry,
  CarryOverDef,
  DailyReviewItem,
  DailyReviewSurface,
} from "./console-daily-review";

export {
  executeDailyReviewAction,
  queryDailyReviewData,
  queryCadenceGovernanceData,
  logCadenceStepCompletion,
} from "./work-queue-service";

export type {
  DailyReviewActionParams,
} from "./work-queue-service";

export {
  evaluateCadenceStatuses,
  evaluateSLAStatuses,
  evaluateLeadInterventionTriggers,
  computeGovernanceSignals,
  generateGovernanceReport,
  getReviewOutcomeGovernance,
  getCarryOverReasonForOutcome,
  CADENCE_STEP_DEFS,
  CADENCE_STEP_LABELS,
  SLA_CATEGORY_DEFS,
  SLA_CATEGORY_LABELS,
  LEAD_INTERVENTION_CASE_DEFS,
  LEAD_INTERVENTION_LABELS,
  GOVERNANCE_SIGNAL_DEFS,
  GOVERNANCE_SIGNAL_LABELS,
  REVIEW_OUTCOME_GOVERNANCE,
} from "./console-cadence-governance";

export type {
  CadenceStepId,
  CadenceStepDef,
  SLACategoryId,
  SLACategoryDef,
  LeadInterventionCaseId,
  LeadInterventionCaseDef,
  GovernanceSignalId,
  GovernanceSignalDef,
  CadenceStatus,
  SLAStatus,
  LeadInterventionTrigger,
  GovernanceSignalValue,
  GovernanceReport,
  ReviewOutcomeGovernanceDef,
} from "./console-cadence-governance";

export {
  queryBottleneckRemediationData,
  saveRemediationItems,
} from "./work-queue-service";

export {
  detectBottlenecks,
  canTransitionRemediation,
  applyRemediationTransition,
  buildRemediationItem,
  buildWeeklyReviewOutcome,
  buildRemediationConsoleView,
  computeRemediationReportSignals,
  BOTTLENECK_CLASS_DEFS,
  BOTTLENECK_CLASS_LABELS,
  REMEDIATION_STATUS_DEFS,
  REMEDIATION_STATUS_LABELS,
  GOVERNANCE_REMEDIATION_LINKS,
} from "./console-bottleneck-remediation";

export type {
  BottleneckClassId,
  BottleneckClassDef,
  BottleneckSeverity,
  RemediationStatus,
  RemediationItem,
  RemediationCreationMode,
  GovernanceRemediationLinkDef,
  DetectedBottleneck,
  WeeklyReviewOutcome,
  RemediationConsoleView,
  RemediationReportSignals,
} from "./console-bottleneck-remediation";

export {
  CANONICAL_TERMS,
  SEVERITY_STYLES,
  SLA_COMPLIANCE_STYLES,
  getSLAComplianceStyle,
  formatRelativeTime,
  formatDuration,
  CTA_VARIANTS,
  EDGE_STATE_MESSAGES,
  detectEdgeStates,
  CONSOLE_MODE_DEFS,
  CONSOLE_MODE_LABELS,
  CONSOLE_MODE_ORDER,
  PILOT_SCENARIOS,
  PILOT_CHECKLIST,
  PRE_EXISTING_ISSUES,
  hasBlockerIssues,
} from "./console-v1-productization";

export type {
  CanonicalTermKey,
  EdgeStateId,
  EdgeStateMessage,
  ConsoleMode,
  StabilityClassification,
  PreExistingIssue,
  PilotScenario,
} from "./console-v1-productization";

export {
  MERGE_GATE_ISSUES,
  RUNTIME_VALIDATION_CHECKLIST,
  PILOT_WALKTHROUGH_RESULTS,
  RUNTIME_DEFECTS,
  V1_MERGE_RECOMMENDATION,
  getMergeGateBlockers,
  getMergeGateNonBlockers,
  getMergeGateDeferred,
  getRuntimeValidationFailures,
  getPilotFailures,
  isMergeApproved,
  isPilotReady,
} from "./console-v1-merge-gate";

export type {
  MergeSeverity,
  MergeGateIssue,
  ValidationStatus,
  RuntimeValidationItem,
  PilotResult,
  PilotWalkthroughResult,
  DefectSeverity,
  RuntimeDefect,
  MergeRecommendation,
} from "./console-v1-merge-gate";

export {
  OBSERVATION_POINTS,
  classifyPilotIssue,
  buildObservationSummary,
  NON_BLOCKER_REASSESSMENTS,
  SCOPE_DECISION_CRITERIA,
  getV11Fixes,
  getV2Defers,
  getMonitorItems,
  isPilotObservationComplete,
  canClosePilot,
} from "./console-v1-pilot-observation";

export type {
  ObservationPointId,
  ObservationPoint,
  PilotIssueClass,
  PilotIssue,
  ObservationLogEntry,
  PilotObservationSummary,
  PriorityAction,
  NonBlockerReassessment,
  ScopeDecisionCriteria,
} from "./console-v1-pilot-observation";

export {
  TYPOGRAPHY,
  SPACING,
  SURFACE,
  SEVERITY_INDICATORS,
  CTA_HIERARCHY,
  QUEUE_COLUMNS,
  METADATA_ORDER,
  getSeverityIndicator,
  getCtaVariant,
} from "./console-visual-grammar";

export type {
  SeverityIndicator,
  QueueColumnDef,
  CtaRule,
  CtaLevel,
  TypographyKey,
  SpacingKey,
  SurfaceKey,
  MetadataField,
} from "./console-visual-grammar";
