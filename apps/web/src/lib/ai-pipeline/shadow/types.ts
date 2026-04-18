/**
 * Shadow Mode 타입 정의
 *
 * AI Shadow 트래픽 검증을 위한 타입 시스템.
 * 실제 Write Path에 영향 없이 AI vs Rules 비교 분석 전용.
 */

// ── Mismatch Category ──
export const MISMATCH_CATEGORIES = [
  "NO_DIFF",
  "DOC_TYPE_DIFF",
  "VERIFICATION_DIFF",
  "AUTO_VERIFY_RISK",
  "TASK_MAPPING_DIFF",
  "EXTRACTION_DIFF",
  "LOW_CONFIDENCE_FALLBACK",
  "SCHEMA_INVALID_FALLBACK",
  "PROVIDER_ERROR_FALLBACK",
  "TIMEOUT_FALLBACK",
  "UNKNOWN_CLASSIFICATION",
  "ORG_SCOPE_BLOCKED",
] as const;

export type MismatchCategory = (typeof MISMATCH_CATEGORIES)[number];

// ── Review Tags ──
export const REVIEW_TAGS = [
  "AI_AUTO_VERIFY_VS_RULES_MANUAL",
  "DOC_TYPE_CONFLICT",
  "VENDOR_AMOUNT_MISMATCH",
  "HIGH_CONFIDENCE_RULES_CONFLICT",
  "REPEATED_VENDOR_MISMATCH",
] as const;

export type ShadowReviewTag = (typeof REVIEW_TAGS)[number];

// ── Runtime Config ──
export interface ShadowRuntimeConfig {
  enabled: boolean;
  shadowMode: boolean;
  asyncShadow: boolean;
  provider: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  minConfidence: number;
  fallbackToRules: boolean;
  rolloutPercent: number;
  dailyCostLimitUsd: number;
}

// ── Shadow Comparison Record ──
export interface ShadowComparisonRecord {
  requestId: string;
  orgId: string;
  documentId: string | null;

  // Rules path 결과
  documentTypeByRules: string | null;
  verificationByRules: string | null;
  taskMappingByRules: string | null;
  dedupOutcomeByRules: string | null;

  // AI path 결과
  documentTypeByAi: string | null;
  verificationByAi: string | null;
  taskMappingByAi: string | null;
  dedupOutcomeByAiIfApplied: string | null;

  // 분석
  mismatchCategory: MismatchCategory;
  confidence: number | null;
  schemaValid: boolean;
  fallbackReason: string | null;

  // 성능
  aiLatencyMs: number | null;
  tokenUsage: number | null;
  provider: string | null;
  model: string | null;

  // Review
  reviewTags: ShadowReviewTag[];
  isReviewCandidate: boolean;
}

// ── Shadow Report ──
export interface ShadowReport {
  period: { from: Date; to: Date };
  totalProcessed: number;
  aiInvoked: number;
  fallbackCount: number;
  fallbackRate: number;
  mismatchCount: number;
  mismatchRate: number;
  autoVerifyRiskCount: number;
  unknownClassificationCount: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  avgTokenUsage: number;
  topMismatchDocTypes: { docType: string; count: number }[];
  topFallbackReasons: { reason: string; count: number }[];
  categoryBreakdown: { category: MismatchCategory; count: number }[];
}

// ── Processing Path ──
export const PROCESSING_PATHS = [
  "rules",
  "ai_shadow",
  "ai_active_canary",
  "ai_active_full",
  "ai_fallback",
] as const;

export type ProcessingPath = (typeof PROCESSING_PATHS)[number];

// ── Canary Stage (승격 순서 고정) ──
export const CANARY_STAGES = [
  "OFF",
  "SHADOW_ONLY",
  "ACTIVE_5",
  "ACTIVE_25",
  "ACTIVE_50",
  "ACTIVE_100",
] as const;

export type CanaryStage = (typeof CANARY_STAGES)[number];

// ── Critical Field Conflict ──

export const CRITICAL_FIELDS = [
  "vendor",
  "totalAmount",
  "currency",
  "documentDate",
  "classificationIndicator",
  "purchaseIdentifier",
] as const;

export type CriticalField = (typeof CRITICAL_FIELDS)[number];

export const CRITICAL_CONFLICT_TYPES = [
  "VALUE_DISAGREEMENT",
  "MISSING_EXPECTED_FIELD",
  "NORMALIZATION_MISMATCH",
  "CONFLICTING_CLASSIFICATION",
  "AMBIGUOUS_HIGH_CONFIDENCE",
] as const;

export type CriticalConflictType = (typeof CRITICAL_CONFLICT_TYPES)[number];

export interface CriticalFieldConflict {
  field: CriticalField;
  conflictType: CriticalConflictType;
  rulesValue: string | null;
  aiValue: string | null;
  severity: "HIGH" | "MEDIUM";
}

// ── Auto-Verify Eligibility ──

export const AUTO_VERIFY_ELIGIBILITY_DECISIONS = [
  "NOT_ELIGIBLE",
  "ELIGIBLE_RESTRICTED",
  "ELIGIBLE_WITH_TEMPLATE_EXCLUSIONS",
  "ELIGIBLE_WITH_VENDOR_EXCLUSIONS",
  "HOLD_REVIEW",
  "ROLLBACK_REQUIRED",
] as const;

export type AutoVerifyEligibilityDecision = (typeof AUTO_VERIFY_ELIGIBILITY_DECISIONS)[number];

// ── Final Operational Decision (6단계) ──

export const FINAL_DECISIONS = [
  "GO_RESTRICTED",
  "GO_ACTIVE_50_NO_AUTOVERIFY",
  "HOLD",
  "ROLLBACK_TO_ACTIVE_5",
  "ROLLBACK_TO_SHADOW",
  "DISABLE_RESTRICTED_AUTOVERIFY_ONLY",
] as const;

export type FinalDecision = (typeof FINAL_DECISIONS)[number];

// 하위 호환용 alias
export type RolloutDecision = FinalDecision;

// ── Auto-Verify Block Reason ──

export const AUTO_VERIFY_BLOCK_REASONS = [
  "POLICY_DISABLED",
  "STAGE_NOT_ELIGIBLE",
  "CONFIDENCE_TOO_LOW",
  "BAND_NOT_ALLOWED",
  "SCHEMA_INVALID",
  "FALLBACK_TRIGGERED",
  "CRITICAL_FIELD_CONFLICT",
  "CLASSIFICATION_AMBIGUOUS",
  "TEMPLATE_EXCLUDED",
  "VENDOR_EXCLUDED",
  "RECENT_ANOMALY_RATE_HIGH",
  "FALSE_SAFE_RISK",
  "OPS_HOLD",
  "GLOBAL_KILL_SWITCH",
  "UNKNOWN_DOC_TYPE",
] as const;

export type AutoVerifyBlockReason = (typeof AUTO_VERIFY_BLOCK_REASONS)[number];

// ── Ops Approval ──

export interface OpsApproval {
  decision: FinalDecision;
  approvedBy: string;
  approvedAt: string;
  basisReportId: string;
  documentType: string;
  previousStage: CanaryStage;
  nextStage: CanaryStage;
  restrictedAutoVerifyEnabled: boolean;
  notes: string;
}

// ── Auto-Verify Audit Trail ──

export interface AutoVerifyAuditFields {
  autoVerifyEligibilityDecision: AutoVerifyEligibilityDecision | null;
  autoVerifyPolicyMatched: boolean;
  confidenceBand: string | null;
  criticalFieldConflictPresent: boolean;
  criticalFieldConflictTypes: CriticalConflictType[];
  falseSafeCandidate: boolean;
  templateFingerprint: string | null;
  vendorNormalizationKey: string | null;
  exclusionMatched: boolean;
  finalAutoVerifyAllowed: boolean;
  autoVerifyBlockReason: string | null;
  rolloutDecision: RolloutDecision | null;
}

/** 제한적 Auto-Verify 정책 (opt-in) */
export interface AutoVerifyPolicy {
  /** auto-verify 허용 최소 confidence (예: 0.99) */
  minConfidence: number;
  /** schema valid 필수 여부 */
  onlyIfSchemaValid: boolean;
  /** critical field 충돌 시 차단 */
  onlyIfNoCriticalFieldConflict: boolean;
  /** classification 모호성 시 차단 */
  requireNoClassificationAmbiguity: boolean;
  /** fallback reason 있으면 차단 */
  requireNoFallbackReason: boolean;
  /** 안정적 template 이력 필요 */
  requireStableTemplateHistory: boolean;
  /** 최근 anomaly rate 상한 */
  maxRecentAnomalyRate: number;
  /** false-safe 첫 발생 시 즉시 off */
  rollbackOnFirstFalseSafe: boolean;
  /** auto-verify 제외 템플릿 목록 */
  excludedTemplates: string[];
  /** auto-verify 제외 벤더(orgId) 목록 */
  excludedVendors: string[];
}

/** 문서 타입별 카나리 설정 */
export interface DocTypeCanaryConfig {
  stage: CanaryStage;
  allowAutoVerify: boolean;
  /** 제한적 auto-verify 정책 (allowAutoVerify=true일 때만 적용) */
  autoVerifyPolicy?: AutoVerifyPolicy;
}

/** 전체 카나리 설정 (JSON 환경변수) */
export interface CanaryConfig {
  globalEnabled: boolean;
  docTypes: Record<string, DocTypeCanaryConfig>;
}

/** Per-doc-type 운영 지표 */
export interface DocTypeMetrics {
  docType: string;
  currentStage: CanaryStage;
  totalCount: number;
  aiActiveCount: number;
  fallbackCount: number;
  fallbackRate: number;
  mismatchCount: number;
  mismatchRate: number;
  highRiskCount: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
}

/** 서킷 브레이커 Halt 기록 */
export interface CanaryHaltEvent {
  documentType: string;
  previousStage: CanaryStage;
  haltedToStage: CanaryStage;
  reason: string;
  triggerCategory: MismatchCategory | null;
  triggerRequestId: string | null;
}

// ── Go/No-Go Gate ──
export interface RolloutGateResult {
  decision: "GO" | "NO_GO";
  hardBlocks: string[];
  candidateDocTypes: {
    docType: string;
    totalCount: number;
    mismatchRate: number;
    fallbackRate: number;
    unknownRiskCount: number;
    recommendation: "READY" | "NOT_READY";
    reason: string;
  }[];
}
