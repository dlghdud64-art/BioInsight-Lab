/**
 * Open Assurance Protocol (Phase W) — Barrel Export
 */

export { defineProtocol, issueAssurance, revokeAssurance, checkRevocationStatus, declareCompatibility } from "./open-assurance-protocol";
export type { AssuranceExchange, RevocationSignal } from "./open-assurance-protocol";

export { registerPrimitive, getPrimitive, deprecatePrimitive, listActivePrimitives, validateInstance } from "./trust-primitive-registry";
export type { PrimitiveType, TrustPrimitive } from "./trust-primitive-registry";

export { createAssertion, parseAssertion as parsePortableAssertion, validateAssertion as validatePortableAssertion, isExpired, isRevoked } from "./portable-assertion-format";
export type { PortableAssertion } from "./portable-assertion-format";

export { sealEnvelope, openEnvelope, verifyIntegrity, checkRevocation, applyRedaction } from "./open-evidence-envelope";
export type { EvidenceEnvelope, RedactionProfile } from "./open-evidence-envelope";

export { assignTier, upgradeTier, downgradeTier, getTierCapabilities, validateTierAction } from "./participation-tiering";
export type { ParticipantTier, TierCapabilities, ParticipantProfile } from "./participation-tiering";

export { checkCompatibility, getAdapterRequirements } from "./protocol-compatibility-engine";
export type { CompatibilityResult, CompatibilityCheck } from "./protocol-compatibility-engine";

export { evaluateAdmission, getAdmissionRequirements, recordAdmission, getAdmissionHistory } from "./protocol-admission-gate";
export type { AdmissionResult } from "./protocol-admission-gate";

export { registerEntry, updateEntry, searchDirectory, getConformanceHistory, flagNonCompliance } from "./public-trust-directory";
export type { DirectoryEntry, ConformanceRecord } from "./public-trust-directory";

export { evaluateRoute, addRoutingRule, getApplicableRules, blockRoute, getRoutingLog } from "./assurance-routing-layer";
export type { RoutingRule, RoutingDecision } from "./assurance-routing-layer";

export { fileContestation, reviewContestation, upholdContestation, dismissContestation, broadcastRevocation } from "./revocation-and-contestation";
export type { ContestationStatus, Contestation } from "./revocation-and-contestation";

export { registerNode, propagateSignal, getNetworkTopology, measurePropagationLatency } from "./shared-assurance-network";
export type { RelayNode, PropagationRecord } from "./shared-assurance-network";

export { proposeAmendment, voteOnAmendment, ratifyAmendment, getAmendmentHistory } from "./protocol-governance-council";
export type { AmendmentType, Amendment } from "./protocol-governance-council";

export { assessNeutrality, detectConcentration, detectBias, getConcentrationMetrics, escalateToGovernance } from "./commons-neutrality-guard";
export type { CaptureRisk, NeutralityStatus, NeutralityAlert } from "./commons-neutrality-guard";

export { measureResilience, getRevocationLag, getFragmentationIndex, getResilienceTrend } from "./protocol-resilience-engine";
export type { ResilienceMetric, ResilienceReport } from "./protocol-resilience-engine";

export { registerVersion, promoteToCandidate, promoteToStable, deprecateVersion, retireVersion, getVersion, getStableVersions, getVersionHistory } from "./protocol-version-lifecycle";
export type { VersionStatus, ProtocolVersion } from "./protocol-version-lifecycle";

export { validateAssertion, validateEnvelope, runTestHarness, parseAssertion, getTestSuite } from "./public-reference-implementation";
export type { TestCase, ValidationResult } from "./public-reference-implementation";

export { getEcosystemDashboard, generateEcosystemReport, getAlertFeed } from "./ecosystem-coordination-dashboard";
export type { EcosystemDashboardData, EcosystemEvent, EcosystemAlert, EcosystemReport } from "./ecosystem-coordination-dashboard";
