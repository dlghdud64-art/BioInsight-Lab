/**
 * 문명 규모 보증 및 적응형 거버넌스 모듈 (Phase T)
 *
 * Civilizational-Scale Assurance, Adaptive Governance,
 * Self-Evolving Trust Infrastructure
 */

// 1. 문명 규모 신뢰 앵커
export type { TrustAnchorType, TrustAnchor } from "./civilizational-trust-anchor";
export {
  establishAnchor,
  verifyAnchor,
  getAnchorChain,
  listActiveAnchors,
} from "./civilizational-trust-anchor";

// 2. 포스트 양자 증거 패브릭
export type {
  HashAlgorithm,
  QuantumResistantEvidence,
  QuantumReadinessReport,
} from "./post-quantum-evidence-fabric";
export {
  createEvidence,
  migrateHashAlgorithm,
  verifyIntegrity,
  assessQuantumReadiness,
} from "./post-quantum-evidence-fabric";

// 3. 영지식 증명 게이트웨이
export type { ProofType, ZKProof } from "./zero-knowledge-gateway";
export {
  generateProof,
  verifyProof,
  batchVerify as batchVerifyProofs,
  getProofHistory,
} from "./zero-knowledge-gateway";

// 4. 기계 간 신뢰 협상기
export type {
  NegotiationProtocol,
  NegotiationStatus,
  TrustNegotiation,
} from "./m2m-trust-negotiator";
export {
  initiateNegotiation,
  respondToChallenge,
  establishTrust,
  revokeMachineTrust,
} from "./m2m-trust-negotiator";

// 5. 적응형 거버넌스 엔진
export type {
  GovernanceMode,
  RuleStatus,
  GovernanceRule,
  GovernanceState,
  GovernanceHistoryEntry,
} from "./adaptive-governance-engine";
export {
  evaluateGovernanceState,
  proposeRuleChange,
  adoptRule,
  retireRule,
  getGovernanceHistory,
} from "./adaptive-governance-engine";

// 6. 정책 형식 검증기
export type {
  VerificationMethod,
  VerificationResult,
  PolicySpec,
} from "./policy-formal-verifier";
export {
  registerPolicy,
  verifyPolicy,
  checkInvariant,
  findCounterExample,
  batchVerify as batchVerifyPolicies,
} from "./policy-formal-verifier";

// 7. 다세대 아카이브
export type {
  ArchiveTier,
  MigrationRecord,
  ArchiveEntry,
  ArchiveStats,
} from "./multi-generational-archive";
export {
  archiveEntry,
  retrieveEntry,
  migrateTier,
  setRetentionPolicy,
  getArchiveStats,
} from "./multi-generational-archive";

// 8. 실존적 위협 격리
export type {
  ThreatCategory,
  ContainmentAction,
  ThreatAssessment,
  PostIncidentReport,
} from "./existential-threat-containment";
export {
  assessThreat,
  triggerContainment,
  evaluateContainmentEffectiveness,
  getPostIncidentReport,
} from "./existential-threat-containment";

// 9. 문명 규모 리스크 대시보드
export type {
  CivilizationalRiskData,
  LongTermReport,
  ResilienceAssessment,
} from "./civilizational-risk-dashboard";
export {
  getCivilizationalDashboard,
  generateLongTermReport,
  assessSystemicResilience,
} from "./civilizational-risk-dashboard";

// 10. 범용 보증 빌더
export type {
  AssuranceFramework,
  AssuranceReport,
  CrossReferenceResult,
} from "./universal-assurance-builder";
export {
  buildFramework,
  assessAgainstFramework,
  issueAssurance,
  crossReferenceFrameworks,
} from "./universal-assurance-builder";
