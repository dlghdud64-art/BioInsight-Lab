/**
 * @module federation
 * @description Phase V: Inter-Institutional Stewardship Federation
 *
 * 기관 간 스튜어드십 연합, 공유 헌법적 거버넌스, 영속적 신뢰 커먼즈를 위한
 * 전체 모듈 배럴 익스포트.
 */

// ── A. Federation Governance & Admission ──

export type {
  CharterSection,
  SignatureStatus,
  CharterArticle,
  CharterSignature,
} from './federation-charter';

export {
  getCharter,
  addCharterArticle,
  signCharter,
  revokeSignature,
  validateCharterCompliance,
  isCharterViolation,
  getSignatureHistory,
} from './federation-charter';

export type {
  MemberStatus,
  ApprovedScope,
  SuspensionRecord,
  InstitutionEntry,
} from './interinstitutional-registry';

export {
  registerInstitution,
  updateStatus,
  suspendMember,
  expelMember,
  listActiveMembers,
  getMemberProfile,
  listAllMembers,
} from './interinstitutional-registry';

export type {
  CompatibilityVerdict,
  CompatibilityCheck,
  CompatibilityReport,
  CompatibilityInput,
} from './constitutional-compatibility-engine';

export {
  evaluateCompatibility,
} from './constitutional-compatibility-engine';

// ── B. Perpetual Trust Commons & Access Control ──

export type {
  TrustAssetType,
  TrustAsset,
} from './shared-trust-commons';

export {
  contributeAsset,
  getAsset,
  searchAssets,
  retireAsset,
  getContributionStats,
} from './shared-trust-commons';

export type {
  AccessPurpose,
  AccessDenialReason,
  AccessGrant,
  AccessRequestResult,
  AccessLogEntry,
} from './commons-access-governor';

export {
  requestAccess,
  grantAccess,
  revokeAccess,
  checkAccess,
  getAccessLog,
} from './commons-access-governor';

export type {
  RedactionLevel,
  AttestationChainEntry,
  StandardizedFormat,
  EvidenceValidation,
  RedactionProfile,
} from './commons-evidence-standard';

export {
  standardizeEvidence,
  validateAgainstStandard,
  applyRedactionProfile,
  verifyAttestationChain,
} from './commons-evidence-standard';

// ── C. Federated Decision & Conflict Resolution ──

export type {
  DecisionCategory,
  VoteType,
  DecisionStatus,
  VoteRecord,
  DissentRecord,
  DecisionOutcome,
  CouncilDecision,
} from './federated-decision-council';

export {
  proposeDecision,
  castVote,
  recordDissent,
  finalizeDecision,
  getPendingDecisions,
  getDecisionHistory,
} from './federated-decision-council';

export type {
  ConflictPhase,
  ConflictType,
  ConflictEvidence,
  InterimRuling,
  FinalResolution,
  ConflictCase,
} from './cross-institution-conflict-resolution';

export {
  openConflict,
  advancePhase,
  submitEvidence,
  issueInterimRuling,
  resolveConflict,
  getActiveConflicts,
  getAllConflicts,
} from './cross-institution-conflict-resolution';

// ── D. Network Resilience & Shared Remediation ──

export type {
  ResilienceMetric,
  Vulnerability,
  Recommendation,
  MetricScore,
  ResilienceAssessment,
  CommonModeRisk,
  ExpansionThrottleResult,
} from './federation-resilience-engine';

export {
  assessNetworkResilience,
  detectCommonModeRisks,
  throttleExpansion,
  getResilienceTrend,
} from './federation-resilience-engine';

export type {
  RemediationScope,
  RemediationStatus,
  RemediationStep,
  RemediationProgram,
  ProgramDashboard,
} from './shared-remediation-coordinator';

export {
  createProgram,
  assignInstitutions,
  trackProgress,
  verifyRemediation,
  updateProgramStatus,
  getProgramDashboard,
} from './shared-remediation-coordinator';

export type {
  TransitionRisk,
  ScopeRestriction,
  SuccessionInput,
  SuccessionInstabilityResult,
  TransitionLogEntry,
} from './constitutional-succession-bridge';

export {
  detectSuccessionInstability,
  applyScopeRestriction,
  monitorTransition,
  restoreScope,
  getTransitionLog,
} from './constitutional-succession-bridge';

// ── E. Maturity Index & Observability ──

export type {
  MaturityGrade,
  MaturityDimension,
  DimensionScore,
  MaturityAssessment,
  ImprovementArea,
} from './institutional-maturity-index';

export {
  assessMaturity,
  getMaturityProfile,
  getMaturityTrend,
  identifyImprovementAreas,
} from './institutional-maturity-index';

export type {
  DebtType,
  DebtSeverity,
  CommonsDebt,
  DebtInventory,
  DebtTrendPoint,
} from './commons-debt-monitor';

export {
  scanForDebt,
  getDebtInventory,
  resolveDebt,
  getDebtTrend,
  calculateDebtScore,
} from './commons-debt-monitor';

export type {
  AssuranceTier,
  AssuranceEvidence,
  MutualAssurance,
  AssuranceNode,
  AssuranceNetwork,
} from './mutual-assurance-framework';

export {
  establishAssurance,
  verifyMutualAssurance,
  upgradeAssuranceTier,
  getAssuranceNetwork,
} from './mutual-assurance-framework';

export type {
  RecentAction,
  FederationAlert,
  CommonsHealth,
  FederationDashboardData,
  FederationReport,
} from './multi-institution-dashboard';

export {
  getFederationDashboard,
  generateFederationReport,
  getAlertFeed,
  addAlert,
  acknowledgeAlert,
  recordAction,
} from './multi-institution-dashboard';
