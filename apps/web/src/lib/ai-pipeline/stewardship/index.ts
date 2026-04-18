/**
 * Institutional Stewardship (Phase U) — Barrel Export
 */

export { registerRight, delegateRight, revokeRight, getActiveRights, validateAuthority } from "./decision-rights-registry";
export type { DecisionDomain, DecisionRight } from "./decision-rights-registry";

export { defineRole, assignRole, getReportingChain, getCapabilityMatrix, validateRoleCompatibility } from "./role-lattice";
export type { RoleLevel, RoleNode } from "./role-lattice";

export { proposeTransfer, approveTransfer, executeTransfer, revertTransfer, getTransferHistory } from "./authority-transfer-protocol";
export type { TransferType, TransferStatus, AuthorityTransfer } from "./authority-transfer-protocol";

export { assessReadiness, getReadinessProfile, identifyGaps, certifyOperator, getTeamReadiness } from "./operator-readiness-index";
export type { ReadinessDimension, ReadinessScore } from "./operator-readiness-index";

export { recordMemory, searchMemory, assessRelevance, pruneObsolete, getKnowledgeMap } from "./institutional-memory-governor";
export type { MemoryCategory, InstitutionalMemory } from "./institutional-memory-governor";

export { createPlan, testPlan, updatePlan, getContinuityDashboard, identifyGaps as identifyContinuityGaps } from "./continuity-assurance";
export type { ContinuityScenario, ContinuityPlan } from "./continuity-assurance";

export { assessMissionAlignment, detectDrift, generateDriftReport, proposeCorrection } from "./mission-drift-monitor";
export type { DriftIndicator, DriftAssessment } from "./mission-drift-monitor";

export { declareEmergency, getEmergencyAuthority, escalateLevel, deescalate, getEmergencyLog } from "./emergency-authority-charter";
export type { EmergencyLevel, EmergencyAuthority } from "./emergency-authority-charter";

export { runSimulation, compareScenarios, generateSuccessionPlan, identifyKeyPersonRisks } from "./succession-simulation";
export type { SimulationScenario, SimulationResult } from "./succession-simulation";

export { proposeSunset, approveSunset, executeWindDown, archiveSystem, proposeRefoundation, getSunsetPlan, getAllSunsetPlans } from "./sunset-refoundation";
export type { LifecyclePhase, DataDisposition, WindDownStep, SunsetPlan } from "./sunset-refoundation";

export { getStewardshipDashboard, generateStewardshipReport, identifyRisks, getKeyMetrics } from "./stewardship-dashboard";
export type { StewardshipGrade, StewardshipHealth, StewardshipRisk, StewardshipAction, StewardshipDashboardData, StewardshipReport } from "./stewardship-dashboard";
