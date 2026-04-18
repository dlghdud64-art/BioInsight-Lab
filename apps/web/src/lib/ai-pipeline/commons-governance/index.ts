/**
 * 커먼즈 거버넌스 모듈 (Phase Y)
 *
 * 공익 헌법적 배분, 세대 간 스튜어드십, 신뢰 커먼즈 거버넌스를 위한
 * 13개 모듈의 배럴 익스포트.
 *
 * 핵심 원칙:
 * 1. 정당성 보존 배분 — 시장 논리가 아닌 시민적 중요도와 기여 의무 기반
 * 2. 제로 외부화 & 반포획 — 비용 외부화 행위자 즉시 제한/차단
 * 3. 세대 간 부채 이전 금지 — 미래 부담 생성 시 불변 원장에 기록
 */

// ─── A. Constitutional Allocation ───

export {
  type ParticipantClass,
  type AccessLevel,
  type UseCaseCategory,
  type AllocationRule,
  type ParticipantEvaluationInput,
  type AllocationMatrixEntry,
  getAllocationRules,
  evaluateParticipantClass,
  getAllocationMatrix,
} from './constitutional-allocation-matrix';

export {
  type AllocationDecision,
  type AllocationInput,
  type AllocationObligation,
  type AllocationResult,
  type AllocationHistoryEntry,
  computeAllocation,
  overrideMarketLogic,
  getAllocationHistory,
} from './public-interest-allocation-engine';

export {
  type CivicTag,
  type PriorityLane,
  type Workflow,
  type RoutingResult,
  type PriorityLaneStats,
  tagWorkflow,
  routeByCivicPriority,
  getPriorityLaneStats,
} from './civic-priority-router';

// ─── B. Benefit-Burden Balance ───

export {
  type BenefitCapture,
  type BurdenExternalized,
  type ImbalanceAction,
  type BalanceResult,
  type BalanceHistoryEntry,
  computeBalance,
  detectImbalance,
  enforceBalance,
  getBalanceHistory,
} from './benefit-burden-balancer';

export {
  type ObligationType,
  type Obligation,
  type EvictionResult,
  registerObligation,
  fulfillObligation,
  getOutstandingObligations,
  evictNonCompliant,
} from './contribution-obligation-registry';

// ─── C. Anti-Capture & Equity ───

export {
  type CapturePattern,
  type CaptureAlertStatus,
  type CaptureSeverity,
  type CaptureAlert,
  type CaptureRiskStatus,
  type CaptureDetectionInput,
  type CaptureRiskAssessment,
  detectCapturePatterns,
  assessCaptureRisk,
  escalateCapture,
  getCaptureHistory,
} from './anti-capture-guard';

export {
  type EquityMetric,
  type CorrectionAction,
  type EquityAlertSeverity,
  type EquityAlert,
  type EquityMeasurementInput,
  type EquityMeasurement,
  type EquityTrendEntry,
  measureEquity,
  detectStarvation,
  triggerCorrectiveReallocation,
  getEquityTrend,
} from './access-equity-monitor';

// ─── D. Generational Stewardship ───

export {
  type DebtCategory,
  type GenerationalHealth,
  type GenerationalDebt,
  type DebtTrendEntry,
  assessGenerationalHealth,
  registerDebt,
  resolveDebt,
  getDebtTrend,
} from './generational-stewardship-engine';

export {
  type LedgerEntryType,
  type LedgerEntry,
  recordEntry,
  getLedger,
  searchByDecisionMaker,
  calculateAccumulatedDebt,
} from './future-impact-ledger';

// ─── E. Dispute Resolution & Succession ───

export {
  type DisputeCategory,
  type DisputePhase,
  type RulingOutcome,
  type AllocationDispute,
  fileDispute,
  investigateDispute,
  issueRuling,
  enforceRuling,
  getDisputeHistory,
} from './allocation-dispute-resolution';

export {
  type WithdrawalBlockReason,
  type ObligationTransferItem,
  type WithdrawalRequest,
  requestWithdrawal,
  validateWithdrawal,
  transferObligations,
  approveWithdrawal,
  blockWithdrawal,
} from './succession-obligation-transfer';

// ─── F. Dashboard & Budget ───

export {
  type TopRisk,
  type DashboardAlert,
  type ImbalanceSummary,
  type LegitimacyDashboardData,
  type LegitimacyReport,
  type PublicInterestReviewData,
  getLegitimacyDashboard,
  generateLegitimacyReport,
  getPublicInterestReviewData,
} from './commons-legitimacy-dashboard';

export {
  type BudgetPool,
  type BudgetAllocation,
  type SpendRecord,
  type LongTermProjection,
  allocateBudget,
  spendFromPool,
  getPoolBalance,
  projectLongTermNeeds,
} from './long-term-commons-budget';
