/**
 * LabAxis Ontology Layer — Phase 1
 *
 * DB CRUD를 넘어선 비즈니스 의미 기반 객체-액션-관계 모델.
 * Palantir AIP/Foundry 스타일의 Object → Action → Link 삼각 구조.
 *
 * 사용처:
 * - UI Store: Domain Object로 상태 관리, Action으로 상태 전이
 * - API Route: Mapper로 DB ↔ Domain 변환
 * - AI Engine: Registry에서 객체 스키마 조회, Action Schema로 Function Calling
 * - Governance: 기존 grammar-registry와 연계
 *
 * 디렉토리 구조:
 * ontology/
 * ├── types/      — Domain Object 타입 (Prisma 분리)
 * ├── actions/    — Atomic Business Action 인터페이스
 * ├── mappers/    — Supabase Row ↔ Domain Object 변환
 * └── registry/   — Object/Action 중앙 등록소
 */

// ── Types (Domain Objects) ──
export type {
  ObjectIdentity,
  OntologyObjectType,
  OntologyLink,
  OntologyLinkType,
  ProductObject,
  ProductCategory,
  SafetyProfile,
  VendorObject,
  VendorTradingStatus,
  BudgetObject,
  BudgetControlState,
  BudgetRiskLevel,
  QuoteObject,
  QuoteBusinessStatus,
  PurchaseOrderObject,
  PurchaseOrderComputed,
  POBusinessStatus,
  ApprovalBusinessStatus,
  DispatchReadinessLevel,
  InventoryObject,
  InventoryStockStatus,
  DispatchPackageObject,
  DispatchRecipientInfo,
  DispatchAttachment,
  ReceivingRecordObject,
  ReceivingInspectionResult,
  StateTransitionRule,
  FastTrackRecommendationObject,
  FastTrackStatus,
  FastTrackReason,
  FastTrackReasonCode,
  FastTrackBlocker,
  FastTrackBlockerCode,
  FastTrackEvaluationSnapshot,
} from "./types";

// ── Actions ──
export type {
  ActionContract,
  ActionRiskLevel,
  PreconditionResult,
  PreconditionViolation,
  ActionResult,
  ActionError,
  AuditTrace,
  ActionRegistryEntry,
  // Concrete Action I/O types
  SubmitQuoteRequestInput,
  SubmitQuoteRequestOutput,
  ShortlistQuoteInput,
  ApproveQuoteInput,
  ConvertQuoteToPOInput,
  ConvertQuoteToPOOutput,
  AuthorizeDispatchInput,
  AuthorizeDispatchOutput,
  ReserveBudgetInput,
  ReserveBudgetOutput,
  CommitBudgetInput,
  ReleaseBudgetInput,
  RecordStockReceiptInput,
  RecordStockReceiptOutput,
  ReleaseStockInput,
  ExecuteReorderDecisionInput,
  ExecuteReorderDecisionOutput,
} from "./actions";

export {
  ACTION_REGISTRY,
  lookupAction,
  getActionsForObjectType,
  getIrreversibleActions,
} from "./actions";

// ── Mappers ──
export {
  mapProductRowToObject,
  mapVendorRowToObject,
  mapBudgetRowToObject,
  mapQuoteRowToObject,
  mapInventoryRowToObject,
  buildLink,
  buildQuoteProductLinks,
  buildPOBudgetLink,
} from "./mappers";

export type {
  SupabaseProductRow,
  SupabaseVendorRow,
  SupabaseBudgetRow,
  SupabaseQuoteRow,
  SupabaseInventoryRow,
} from "./mappers";

// ── Registry ──
export {
  OBJECT_REGISTRY,
  lookupObjectType,
  getStateTransitions,
  getAvailableTransitions,
  getActionsForObject,
  getAvailableActionsForState,
  buildOntologySchemaForAI,
} from "./registry";

export type {
  ObjectRegistryEntry,
  OntologySchemaForAI,
} from "./registry";

// ── Cross-Object Actions (Phase 2) ──
export {
  executeFinalizeApproval,
  checkFinalizeApprovalPreconditions,
  executeReceiveOrder,
  checkReceiveOrderPreconditions,
} from "./actions/cross-object-actions";

export type {
  FinalizeApprovalInput,
  FinalizeApprovalOutput,
  ReceiveOrderInput,
  ReceiveOrderOutput,
} from "./actions/cross-object-actions";

// ── AI-Ontology Binding (Phase 3) ──
export {
  analyzeOrderOntology,
  parseNaturalLanguageAction,
  resolveNLActionTargets,
  setNLLocalOrderProvider,
  buildGeminiToolDescription,
  buildExecutionPlan,
} from "./ai/ontology-ai-service";

export type {
  OntologyAnalysisContext,
  OntologyAnalysisResult,
  AiSuggestedAction,
  SuggestedActionType,
  NLActionParseResult,
  NLTargetFilter,
  NLLocalOrderSnapshot,
  ExecutionStep,
  ExecutionPlan,
} from "./ai/ontology-ai-service";

// ── Fast-Track Recommendation Engine ──
export {
  evaluateFastTrack,
  detectFastTrackSnapshotDrift,
  FAST_TRACK_THRESHOLDS,
} from "./fast-track/fast-track-engine";

export type {
  FastTrackCandidateItem,
  FastTrackHistoryRecord,
  FastTrackEvaluationInput,
} from "./fast-track/fast-track-engine";

// ── Fast-Track Event Publisher ──
export {
  evaluateAndPublishFastTrack,
  publishFastTrackDismissed,
  FAST_TRACK_EVENT_TYPES,
} from "./fast-track/fast-track-publisher";

export type {
  EvaluateAndPublishResult,
  FastTrackEventType,
} from "./fast-track/fast-track-publisher";

// ── Fast-Track Governance Guard ──
export {
  evaluateFastTrackGovernanceGuard,
} from "./fast-track/fast-track-governance-guard";

export type {
  FastTrackGovernanceGuardResult,
  FastTrackGovernanceGuardInput,
  FastTrackGuardBlockReason,
  FastTrackGuardBlockCode,
} from "./fast-track/fast-track-governance-guard";

// ── Fast-Track Guard Input Resolver ──
export { resolveGuardInputs } from "./fast-track/fast-track-guard-inputs";

// ── Policy Engine Slot (Future RBAC/ABAC/ReBAC) ──
export {
  evaluatePolicy,
  evaluatePolicySync,
} from "./policy";

export type {
  PolicyActionName,
  PolicyContext,
  PolicyEvaluationResult,
} from "./policy";

// ── What-if Simulation Engine (Phase 4) ──
export {
  simulateBudgetImpact,
  simulateInventoryDepletion,
  compareScenarios,
} from "./simulation/what-if-engine";

export type {
  BudgetSimulationInput,
  BudgetSimulationResult,
  BudgetRiskCategory,
  InventorySimulationInput,
  InventorySimulationResult,
  SimulationWarning,
  ScenarioComparison,
} from "./simulation/what-if-engine";
