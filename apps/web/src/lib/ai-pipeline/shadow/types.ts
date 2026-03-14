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
