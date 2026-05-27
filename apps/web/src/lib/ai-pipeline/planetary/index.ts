/**
 * Planetary Trust Substrate (Phase X) — Barrel Export
 */

export { initializeSubstrate, publishMessage, consumeMessage, verifyMessageIntegrity } from "./planetary-trust-substrate";
export type { SubstrateLayer, SubstrateMessage } from "./planetary-trust-substrate";

export { createPrimitive, composePrimitives, validatePrimitive, decomposePrimitive } from "./civil-coordination-primitives";
export type { PrimitiveKind, CoordinationPrimitive } from "./civil-coordination-primitives";

export { computeMinimalConstitution } from "./collective-constitutional-computation";
export type { ConstitutionalProfile, ComputationResult } from "./collective-constitutional-computation";

export { evaluateConstraint, enforceConstraint, getConstraintLog } from "./constitutional-constraint-engine";
export type { ConstraintDecision, ConstraintEvaluation } from "./constitutional-constraint-engine";

export { evaluateInteropRoute, blockRoute, delayRoute, getRoutingAuditLog } from "./multi-network-interop-router";
export type { RouterCheck, RoutingResult } from "./multi-network-interop-router";

export { broadcastRevocation, checkFreshness, syncMeshNode, getRevocationStatus, measurePropagationDelay } from "./planetary-revocation-mesh";
export type { MeshNode, RevocationBroadcast, FreshnessCheck } from "./planetary-revocation-mesh";

export { applyLimitation, removeLimitation, validateLimitationPresence, getLimitationsByAsset } from "./shared-limitation-taxonomy";
export type { LimitationCategory, StandardLimitation } from "./shared-limitation-taxonomy";

export { fileContestation, routeToJurisdiction, markCaution, suspendAsset, resolveContestation } from "./contestability-fabric";
export type { ContestationPhase, ContestationCase } from "./contestability-fabric";

export { initiateResolution, proposeResolution, finalizeResolution, getResolutionPrecedents } from "./cross-network-resolution-layer";
export type { ResolutionType, ResolutionRecord } from "./cross-network-resolution-layer";

export { scanForFragmentation, detectAdapterBypass, detectSemanticDrift, getFragmentationTrend } from "./constitutional-fragmentation-monitor";
export type { FragmentationRisk, FragmentationAlert } from "./constitutional-fragmentation-monitor";

export { proposeUpgrade, analyzeCompatibility, startPilot, conductVote, beginAdoption, completeAdoption, getUpgradeHistory } from "./collective-upgrade-mechanism";
export type { UpgradePhase, UpgradeProposal, UpgradeVote } from "./collective-upgrade-mechanism";

export { measureResilience, getHealthStatus, getResilienceTrend, triggerRefoundationReview } from "./substrate-resilience-engine";
export type { SubstrateHealth, ResilienceMetric, MetricValue, ResilienceReport } from "./substrate-resilience-engine";

export { getCivilDashboard, generateCivilReport, getContestationHotspots } from "./open-civil-dashboard";
export type { CivilDashboardData, ContestationHotspot, CivilAlert, CivilReport } from "./open-civil-dashboard";
