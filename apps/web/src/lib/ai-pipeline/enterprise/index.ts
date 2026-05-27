/**
 * Enterprise Integration — Barrel Export
 */

// System Registry & Source of Truth
export { registerSystem, getSystem, getAllSystems, updateSystemStatus, getSystemsByCategory, getHealthySystems, getDegradedSystems, getSystemHealthSummary } from "./system-registry";
export type { SystemRegistryEntry, IntegrationMode, SystemStatus, RecoveryMode } from "./system-registry";
export { getWriteAuthority, validateWriteAccess, validateReadAccess, getFullMatrix, getOwnedDomains } from "./source-of-truth-matrix";
export type { DataDomain, SoTEntry } from "./source-of-truth-matrix";

// Event Bus
export { subscribe, publish, createEvent, getDeadLetterQueue, getEventLog, drainDeadLetter } from "./event-bus-contracts";
export type { EnterpriseEvent, EventDomain, EventAction, DocumentVerifiedPayload, BudgetBreachedPayload, IncidentOpenedPayload, InventoryDiscrepancyPayload, ProcurementOrderMatchedPayload } from "./event-bus-contracts";

// Workflow Orchestrator
export { startDocumentVerifiedWorkflow, startVerificationFailedWorkflow, executeNextStep, getWorkflow, getWorkflowsByTenant, getActiveWorkflows } from "./workflow-orchestrator";
export type { WorkflowInstance, WorkflowStep, WorkflowStatus } from "./workflow-orchestrator";

// Domain Bridges
export { matchProcurementOrder, checkInventoryDiscrepancy, syncIAMRoles, createIncidentTicket, checkBudgetAvailability } from "./domain-bridges";
export type { ProcurementMatchRequest, ProcurementMatchResult, InventoryCheckRequest, InventoryDiscrepancy, IAMSyncRequest, TicketCreateRequest, BudgetCheckRequest } from "./domain-bridges";

// Reconciliation & Evidence
export { recordReconciliation, processRetryQueue, getReconciliationRecords, getReconciliationStats, getRetryQueueSize } from "./reconciliation-engine";
export type { ReconciliationRecord, ReconciliationStatus, ReconciliationDomain } from "./reconciliation-engine";
export { createEvidenceChain, addEvidenceLink, sealChain, verifyChainIntegrity, getEvidenceChain, getChainsBySubject, getChainsByTenant, exportEvidencePackage } from "./evidence-fabric";
export type { EvidenceChain, EvidenceLink } from "./evidence-fabric";

// Business Continuity
export { initCircuitBreaker, recordFailure, recordSuccess, tryHalfOpen, canRequest, getCircuitBreakerState, getDegradedModeAction, queueForReplay, getReplayQueueSize, drainReplayQueue, getContinuityStatus } from "./business-continuity";
export type { SystemCircuitBreaker, CircuitState, DegradedModeAction, DegradedModeConfig } from "./business-continuity";

// Integration Readiness
export { evaluateIntegrationReadiness } from "./integration-readiness-gate";
export type { IntegrationReadinessResult, IntegrationReadinessCheck } from "./integration-readiness-gate";

// Business Operating Views
export { getProcurementOpsView, getFinanceEvidenceView, getIntegrationKPIMetrics } from "./business-operating-views";
export type { ProcurementOpsView, FinanceEvidenceView, IntegrationKPIMetrics } from "./business-operating-views";
