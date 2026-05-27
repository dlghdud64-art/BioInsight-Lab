/**
 * @module regulatory
 * @description Phase R: Industry Trust Fabric & Regulatory-Grade Operating Standard
 * 산업 신뢰 패브릭 및 규제 등급 운영 표준 — B2B SaaS AI 카나리 롤아웃 시스템을 위한 규제 대응 모듈
 */

// 규제 통제 매트릭스
export type {
  ControlCategory,
  ControlStatus,
  ControlEvidence,
  RegulatoryControl,
  ControlGapAnalysis,
} from './regulatory-control-matrix';
export {
  registerControl,
  updateControlStatus,
  getControlsByFramework,
  getControlGapAnalysis,
} from './regulatory-control-matrix';

// 컴플라이언스 매핑 엔진
export type {
  Framework,
  MappingGap,
  MappingEntry,
  CoverageReport,
  FrameworkCompliance,
} from './compliance-mapping';
export {
  mapRequirementToControls,
  getCoverageReport,
  identifyGaps,
  getFrameworkCompliance,
} from './compliance-mapping';

// 보증 케이스 빌더
export type {
  NodeType,
  NodeStatus,
  AssuranceCaseNode,
  AssuranceCase,
  CompletenessResult,
  ExportedCase,
} from './assurance-case-builder';
export {
  createCase,
  addNode,
  linkEvidence,
  validateCaseCompleteness,
  exportCase,
} from './assurance-case-builder';

// 증거 표준화 엔진
export type {
  EvidenceFormat,
  EvidenceIntegrity,
  StandardizedEvidence,
  FormatValidationResult,
  EvidenceCatalogEntry,
} from './evidence-standardization';
export {
  standardizeEvidence,
  validateFormat,
  applyRetentionPolicy,
  getEvidenceCatalog,
} from './evidence-standardization';

// 통제 테스트 엔진
export type {
  TestType,
  TestResult,
  TestFinding,
  ControlTest,
} from './control-testing-engine';
export {
  executeTest,
  scheduleTest,
  getTestHistory,
  getOverdueTests,
} from './control-testing-engine';

// 예외 및 시정조치 관리
export type {
  ExceptionSeverity,
  RemediationStatus,
  Exception,
} from './exception-remediation';
export {
  raiseException,
  updateRemediation,
  acceptRisk,
  getOpenExceptions,
  getOverdueRemediations,
} from './exception-remediation';

// 독립 검토 관리
export type {
  ReviewType,
  FindingSeverity,
  FindingStatus,
  ReviewFinding,
  OverallAssessment,
  ReviewRecord,
} from './independent-review';
export {
  initiateReview,
  recordFinding,
  completeReview,
  getReviewHistory,
  trackFindingClosure,
} from './independent-review';

// 통제 드리프트 모니터
export type {
  DriftType,
  DriftSeverity,
  DriftAlert,
  DriftTrendPoint,
} from './control-drift-monitor';
export {
  scanForDrift,
  getDriftAlerts,
  resolveDrift,
  getDriftTrend,
} from './control-drift-monitor';

// 인증 패키지 생성기
export type {
  CertificationType,
  PackageControlSummary,
  PackageEvidenceRef,
  PackageTestSummary,
  PackageExceptionSummary,
  PackageCompletenessResult,
  CertificationPackage,
} from './certification-packager';
export {
  generatePackage,
  validateCompleteness,
  exportPackage,
  getPackageHistory,
} from './certification-packager';

// 산업 준비도 게이트
export type {
  ReadinessArea,
  ReadinessCheck,
  ReadinessBlocker,
  IndustryReadinessResult,
  ReadinessTimelineEntry,
  ReadinessInput,
} from './industry-readiness-gate';
export {
  evaluateReadiness,
  getReadinessTimeline,
} from './industry-readiness-gate';

// 신뢰 마크 프레임워크
export type {
  TrustMarkLevel,
  TrustMark,
} from './trust-mark-framework';
export {
  issueTrustMark,
  verifyTrustMark,
  revokeTrustMark,
  renewTrustMark,
  getTrustMarkHistory,
} from './trust-mark-framework';

// 산업 규제 대시보드
export type {
  ControlHealthSummary,
  TestingStatusSummary,
  ExceptionSummary,
  CertificationStatus,
  IndustryDashboardData,
  ComplianceTrendPoint,
  RegulatoryReport,
} from './industry-dashboard';
export {
  getIndustryDashboard,
  generateRegulatoryReport,
  getComplianceTrend,
} from './industry-dashboard';
