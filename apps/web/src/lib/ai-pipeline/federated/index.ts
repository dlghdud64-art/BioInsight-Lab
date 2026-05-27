/**
 * @module federated
 * @description Phase Q: Federated Intelligence & External Trust Network
 *
 * 연합 인텔리전스 및 외부 신뢰 네트워크 모듈.
 * B2B SaaS AI 카나리 롤아웃 시스템에서 외부 파트너 조직과의
 * 신뢰 관리, 증거 교환, 정책 동기화, 분쟁 해결 등을 담당한다.
 */

// 1. 신뢰 등록소
export {
  type TrustLevel,
  type PartnerEntry,
  type RegisterPartnerInput,
  registerPartner,
  updateTrustLevel,
  getPartner,
  listByTrustLevel,
  suspendPartner,
  revokePartner,
} from "./trust-registry";

// 2. 신뢰 계약 관리
export {
  type ContractType,
  type ContractStatus,
  type ContractTerms,
  type TrustContract,
  type CreateContractInput,
  createContract,
  activateContract,
  suspendContract,
  terminateContract,
  getActiveContracts,
} from "./trust-contracts";

// 3. 증거 교환 게이트웨이
export {
  type ExchangeDirection,
  type ExchangeStatus,
  type ExchangeRecord,
  type InitiateExchangeInput,
  type ValidationResult,
  initiateExchange,
  acknowledgeReceipt,
  getExchangeHistory,
  validateInboundEvidence,
} from "./evidence-exchange-gateway";

// 4. 인증 발급/검증 엔진
export {
  type AttestationType,
  type AttestationClaim,
  type Attestation,
  type IssueAttestationInput,
  type VerificationResult,
  issueAttestation,
  verifyAttestation,
  revokeAttestation,
  getValidAttestations,
} from "./attestation-engine";

// 5. 연합 정책 경계 관리
export {
  type SyncDirection,
  type PolicyItem,
  type PolicyBoundary,
  type DefineBoundaryInput,
  type SyncPoliciesInput,
  type CompatibilityResult,
  type SyncResult,
  defineBoundary,
  syncPolicies,
  checkPolicyCompatibility,
  getSharedPolicies,
} from "./federated-policy-boundary";

// 6. 동의/철회 관리
export {
  type ConsentScope,
  type ConsentRecord,
  type GrantConsentInput,
  type ConsentAuditEntry,
  grantConsent,
  revokeConsent,
  checkConsent,
  getActiveConsents,
  auditConsentHistory,
} from "./consent-revocation";

// 7. 조직 간 워크플로우
export {
  type WorkflowType,
  type WorkflowStatus,
  type WorkflowStep,
  type CrossOrgWorkflow,
  type InitiateWorkflowInput,
  initiateWorkflow,
  advanceStep,
  completeWorkflow,
  getActiveWorkflows,
} from "./cross-org-workflow";

// 8. 외부 보증 수준 평가
export {
  type AssuranceLevel,
  type AssuranceFactor,
  type AssuranceAssessment,
  assessPartnerAssurance,
  getAssuranceLevel,
  scheduleReassessment,
} from "./external-assurance";

// 9. 네트워크 리스크 총괄
export {
  type RiskCategory,
  type RiskSeverity,
  type MitigationStatus,
  type NetworkRisk,
  type RiskProfile,
  type AssessNetworkRiskInput,
  assessNetworkRisk,
  getNetworkRiskProfile,
  mitigateRisk,
  getAggregateRiskScore,
} from "./network-risk-governor";

// 10. 파트너 통합 준비도 게이트
export {
  type ReadinessCategory,
  type ReadinessCheck,
  type ReadinessReport,
  type PartnerCapabilities,
  checkPartnerReadiness,
  getReadinessReport,
} from "./partner-integration-readiness";

// 11. 분쟁 해결 프로세스
export {
  type DisputeStatus,
  type DisputeCategory,
  type DisputeEvidence,
  type Dispute,
  type OpenDisputeInput,
  openDispute,
  investigateDispute,
  proposeResolution,
  resolveDispute,
  escalateDispute,
} from "./dispute-resolution";

// 12. 서드파티 감사 수출 패키지
export {
  type AuditExportFormat,
  type AuditScope,
  type RedactionPolicy,
  type AuditSection,
  type AuditPackage,
  type GenerateAuditPackageInput,
  type CompletenessResult,
  generateAuditPackage,
  applyRedaction,
  validatePackageCompleteness,
  getExportHistory,
} from "./third-party-audit-export";
