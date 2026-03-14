/**
 * @module terminal-charter
 * @description Phase Z: 헌법적 종결, 영구 갱신, 터미널 운영 헌장.
 * 시스템의 최종 운영 원칙과 종결 조건을 정의하고 관리한다.
 *
 * Zero-Tolerance 원칙:
 * 1. 개정 불가 코어 — 승인 계보, 롤백 무결성, False-safe 격리는 영구 불변
 * 2. 무음 지속 금지 — 만료된 신뢰 자산/예외는 자동 강등/일몰
 * 3. 목적 연속성 잠금 — 공익 의무 축소 시도 = 헌법적 위반 → 최종 격리
 */

// A. Terminal Operating Charter & Non-Amendable Core
export {
  type CharterSectionType,
  type CharterSection,
  type TerminalCharter,
  getCharter,
  getSectionsByType,
  isImmutableSection,
  validateCharterIntegrity,
} from "./terminal-operating-charter";

export {
  type CoreCategory,
  type CorePrinciple,
  type ViolationLogEntry,
  type BlockResult,
  registerPrinciple,
  isPrincipleViolated,
  blockModificationAttempt,
  getCoreRegistry,
  getViolationLog,
} from "./nonamendable-core-registry";

// B. Constitutional Closure Engine
export {
  type ClosureStatus,
  type ClosureCheck,
  type UnresolvedAmbiguity,
  type StalePathway,
  type DuplicatePattern,
  type ClosureReport,
  scanForClosure,
  getClosureStatus,
  resolveAmbiguity,
  removeStalePathway,
  registerAmbiguity,
  registerStalePathway,
  registerDuplicatePattern,
} from "./constitutional-closure-engine";

export {
  type ControlCategory,
  type CanonicalControl,
  type SpineStats,
  buildCanonicalSpine,
  getControlsByCategory,
  findDuplicates,
  getSpineStats,
} from "./canonical-control-spine";

export {
  type ReadinessCheck,
  type ReadinessResult,
  type ReadinessInputs,
  evaluateClosureReadiness,
} from "./closure-readiness-gate";

// C. Amendment Protocol & Perpetual Renewal
export {
  type AmendmentPhase,
  type AmendmentRequest,
  type AmendmentApproval,
  proposeAmendment,
  advancePhase,
  approveAmendment,
  archiveInterpretation,
  recordPilotResults,
  getAmendmentHistory,
  getPendingAmendments,
} from "./amendment-protocol";

export {
  type RenewalFrequency,
  type RenewalOutcome,
  type RenewalStatus,
  type RenewalItem,
  type RenewalExecution,
  scheduleRenewal,
  executeRenewal,
  autoDowngradeExpired,
  getSunsetCandidates,
  getRenewalQueue,
  getRenewalExecutionLog,
} from "./perpetual-renewal-loop";

export {
  type CadenceRule,
  type CadenceSchedule,
  type CadenceStats,
  computeCadence,
  getOverdueItems,
  escalateOverdue,
  getCadenceStats,
  registerCadenceRule,
} from "./renewal-cadence-engine";

// D. Purpose Lock & Refoundation
export {
  type PurposeStatus,
  type PurposeCheck,
  type DriftIndicator,
  type PurposeAssessment,
  type PurposeHistoryEntry,
  assessPurposeAlignment,
  detectPurposeDrift,
  freezeExpansion,
  isExpansionFrozen,
  getPurposeHistory,
} from "./continuity-of-purpose-lock";

export {
  type RefoundationStatus,
  type RefoundationIndicator,
  type IndicatorAssessment,
  type SafeguardStep,
  type ArchivalPlan,
  type RefoundationPlan,
  assessRefoundationNeed,
  triggerRefoundation,
  getRefoundationPlan,
  executeControlledShutdown,
  updateIndicatorValue,
  getRefoundationHistory,
} from "./refoundation-trigger-system";

// E. Final Obligation & Terminal Audit
export {
  type ObligationCategory,
  type PerpetualObligation,
  type FulfillmentVerification,
  registerObligation,
  getObligationsByRole,
  getObligationsByCategory,
  verifyFulfillment,
  getUnfulfilledObligations,
  getAllObligations,
  getFulfillmentLog,
} from "./final-obligation-ledger";

export {
  type AuditVerdict,
  type TerminalAuditCheck,
  type TerminalAuditReport,
  type AuditInputs,
  runTerminalAudit,
  getCoreIntegrity,
  getPurposeAlignment,
  getAuditHistory,
} from "./terminal-audit-framework";

export {
  type MemoryEntry,
  indexMemory,
  searchMemory,
  getMemoriesByPhase,
  getConstitutionalPrecedents,
  getMemoriesByTopic,
  getMemoryCount,
} from "./constitutional-memory-index";

// F. Fail-safe & Dashboard
export {
  type ContainmentLevel,
  type ContainmentAction,
  type ContainmentEvent,
  type ThreatAssessment,
  evaluateThreat,
  triggerContainment,
  escalateContainment,
  resolveContainment,
  getContainmentLog,
  getCurrentContainmentLevel,
} from "./final-failure-containment";

export {
  type DashboardAlert,
  type ClosureDashboardData,
  type ClosureReport as ClosureDashboardReport,
  getClosureDashboard,
  generateClosureReport,
  getClosureAlerts,
} from "./closure-dashboard";

// G. Constitutional Breach Simulation (Post-Z E2E Scenario 7)
export {
  type BreachClassification,
  type AttemptPath,
  type ActorRole,
  type ClassificationEvidence,
  type BreachClassificationResult,
  type ContainmentSeverity,
  type IsolationScope,
  type GateStep,
  type GateStepResult,
  type PreExecutionGateResult,
  type RollbackStatus,
  type RollbackRecord,
  type EvidencePackage,
  type PostContainmentDecision,
  type HardeningAction,
  type StructuralGapAnalysis,
  type IncidentArtifactSet,
  type ActorFollowUp,
  type SimulationResult,
  classifyBreachAttempt,
  executePreExecutionGate,
  determineIsolationScope,
  executeRollback,
  preserveEvidence,
  determineActorFollowUp,
  evaluatePostContainment,
  analyzeStructuralGap,
  createIncidentArtifacts,
  runBreachSimulation,
  runAllBreachScenarios,
  getClassificationLog,
  getGateLog,
  getRollbackLog,
  getEvidenceStore,
  getIncidentStore,
  getSimulationResults,
} from "./constitutional-breach-simulation";

// H. Systemic Resilience Simulation (Post-Z E2E Scenario 8)
export {
  type CrisisType,
  type CrisisEvent,
  type CompoundedCrisisScenario,
  type DegradedModeState,
  type FunctionCategory,
  type FunctionStatus,
  type TransitionCondition,
  type DeadlockType,
  type DeadlockResolution,
  type GovernanceDeadlock,
  type PartitionState,
  type PartitionedNode,
  type RefoundationScoreBreakdown,
  type RefoundationTriggerResult,
  type CoreInvariantCheck,
  type ScenarioSimResult,
  type ResilienceSimulationReport,
  defineCompoundedScenarios,
  transitionDegradedMode,
  getDegradedModeLog,
  getCurrentDegradedState,
  getStateTransitions,
  detectDeadlock,
  resolveDeadlock,
  getDeadlockLog,
  detectPartition,
  reconcilePartitionedNode,
  getPartitionLog,
  simulateRefoundationTrigger,
  verifyCoreInvariants,
  runSystemicResilienceSimulation,
} from "./systemic-resilience-simulation";

// I. Resilience Stress Tester (Scenario 8 Test Suite)
export {
  type StressCategory,
  type ExpectedBehavior,
  type StressScenario,
  type InjectedRequest,
  type RequestProcessingResult,
  type ScenarioExecutionResult,
  type AssertionResult,
  defineStressScenarios,
  executeStressScenario,
  runAllStressScenarios,
  getStressExecutionLog,
} from "./resilience-stress-tester";

// J. Multi-Crisis Simulator (Orchestrator)
export {
  type CrisisPhase,
  type CrisisTimelineEntry,
  type IntegratedSimulationResult,
  assembleIntegratedSimulation,
  getIntegratedSimulations,
} from "./multi-crisis-simulator";

// K. Role Misalignment Detector
export {
  type RoleMisalignmentType,
  type RoleMisalignmentIncident,
  type RoleMisalignmentFollowUp,
  validateRolePermission,
  detectEmergencyPersistentUse,
  detectCrossRoleCollusion,
  getRoleMisalignmentIncidents,
  getEmergencyUsageLog,
  getRolePermissions,
} from "./role-misalignment-detector";

// L. Borderline Adjudication Protocol
export {
  type AdjudicationStatus,
  type BorderlineType,
  type AdjudicationCase,
  detectBorderlineCase,
  resolveAdjudicationCase,
  processTimeouts,
  getAdjudicationCases,
  getPendingCases,
  getDetectionRules,
} from "./borderline-adjudication-protocol";

// M. Degraded Mode Containment
export {
  type InfraComponent,
  type InfraHealth,
  type InfraStatus,
  type ContainmentMode,
  updateInfraHealth,
  evaluateAndTransition,
  verifyCoreProtection,
  deferEvidence,
  flushDeferredEvidence,
  getCurrentContainmentMode,
  getModeTransitionLog,
  getAllInfraStatuses,
  getDeferredEvidenceQueue,
} from "./degraded-mode-containment";

// N. Resilience Scorecard
export {
  type ResilienceVerdict,
  type PostScenarioDecision,
  type DimensionScore,
  type ResilienceScorecard,
  generateResilienceScorecard,
} from "./resilience-scorecard";

// O. Structural Realignment Backlog
export {
  type BacklogPriority,
  type BacklogStatus,
  type BacklogCategory,
  type BacklogItem,
  addBacklogItem,
  updateBacklogStatus,
  generateBacklogFromScenario8,
  getBacklog,
  getBacklogByPriority,
  getOpenBacklog,
  getOverdueBacklog,
  getBacklogStats,
} from "./structural-realignment-backlog";

// Updated closure-dashboard exports
export {
  type ResilienceDashboardCard,
  getResilienceDashboardCards,
} from "./closure-dashboard";
