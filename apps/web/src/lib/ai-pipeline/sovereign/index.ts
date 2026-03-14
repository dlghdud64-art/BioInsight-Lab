/**
 * @module sovereign
 * @description Phase S: Global Interoperability, Sovereign Control, Cross-Jurisdiction Operating Mesh
 * 글로벌 상호운용성, 주권 통제, 교차 관할권 운영 메시를 위한 배럴 익스포트
 */

// 관할권 레지스트리
export type {
  JurisdictionType,
  DataSovereigntyLevel,
  Jurisdiction,
} from './jurisdiction-registry';
export {
  registerJurisdiction,
  getJurisdiction,
  listActiveJurisdictions,
  getApplicableLaws,
} from './jurisdiction-registry';

// 주권 테넌시 관리
export type {
  IsolationLevel,
  SovereignTenant,
  TenantComplianceResult,
} from './sovereign-tenancy';
export {
  registerTenant,
  getTenantProfile,
  updateIsolation,
  validateTenantCompliance,
} from './sovereign-tenancy';

// 주권 통제 플레인
export type {
  SovereignAction,
  SovereignPolicy,
  SovereignDecision,
} from './sovereign-control-plane';
export {
  evaluateSovereignAction,
  getSovereignPolicy,
  overrideSovereignPolicy,
  getDecisionLog,
} from './sovereign-control-plane';

// 데이터 레지던시 매니저
export type {
  ResidencyRule,
  DataLocation,
  ResidencyViolation,
  ResidencyReport,
} from './data-residency-manager';
export {
  defineResidencyRule,
  checkResidencyCompliance,
  getViolations,
  migrateData,
  getResidencyReport,
} from './data-residency-manager';

// 국경 간 정책 관리
export type {
  TransferMechanism,
  CrossBorderTransfer,
} from './cross-border-policy';
export {
  evaluateTransfer,
  getAvailableMechanisms,
  registerMechanismMapping,
  recordTransfer,
  getTransferHistory,
} from './cross-border-policy';

// 규제 분산 관리
export type {
  VarianceType,
  RegulatoryVariance,
  VarianceMatrixEntry,
} from './regulatory-variance';
export {
  identifyVariances,
  resolveVariance,
  getVarianceMatrix,
  getHighestStandard,
} from './regulatory-variance';

// 증거 라우팅 엔진
export type {
  RoutingDecision,
} from './evidence-router';
export {
  registerRoutingRule,
  routeEvidence,
  checkRoutingPermission,
  applyJurisdictionalRedaction,
  getRoutingLog,
} from './evidence-router';

// 국경 간 조정 엔진
export type {
  ReconciliationType,
  Discrepancy,
  ReconciliationResult,
} from './cross-border-reconciliation';
export {
  runReconciliation,
  getDiscrepancies,
  resolveDiscrepancy,
  getReconciliationHistory,
} from './cross-border-reconciliation';

// 글로벌 리스크 코디네이터
export type {
  RiskCategory,
  RiskStatus,
  SeverityLevel,
  GlobalRisk,
  GlobalRiskProfile,
  GlobalRiskReport,
} from './global-risk-coordinator';
export {
  assessGlobalRisk,
  coordinateResponse,
  getGlobalRiskProfile,
  generateGlobalRiskReport,
} from './global-risk-coordinator';

// 지리적 장애 조치 거버넌스
export type {
  FailoverType,
  TestStatus,
  FailoverTestResult,
  FailoverPlan,
  FailoverExecution,
} from './geo-failover-governance';
export {
  defineFailoverPlan,
  evaluateFailoverCompliance,
  executeFailover,
  testFailover,
  getFailoverHistory,
} from './geo-failover-governance';
