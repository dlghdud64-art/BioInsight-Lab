/**
 * Shadow Comparison Logger
 *
 * Rules Path vs AI Path 결과를 비교하여 ShadowComparisonLog에 기록.
 * Zero-impact: 실제 Write Path에 영향 없음.
 */

import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import type {
  ShadowComparisonRecord,
  MismatchCategory,
  ShadowReviewTag,
  ProcessingPath,
  CanaryStage,
} from "./types";

interface ComparisonInput {
  requestId: string;
  orgId: string;
  documentId: string | null;

  // Rules 결과
  rulesDocumentType: string | null;
  rulesVerification: string | null;
  rulesTaskMapping: string | null;
  rulesDedup: string | null;

  // AI 결과
  aiDocumentType: string | null;
  aiVerification: string | null;
  aiTaskMapping: string | null;
  aiDedup: string | null;

  // AI 메타
  confidence: number | null;
  schemaValid: boolean;
  fallbackReason: string | null;
  aiLatencyMs: number | null;
  tokenUsage: number | null;
  provider: string | null;
  model: string | null;

  // Canary 메타 (optional — 하위 호환)
  processingPath?: ProcessingPath;
  canaryStage?: CanaryStage;

  // Auto-verify audit trail (optional)
  autoVerifyEligibilityDecision?: string | null;
  autoVerifyPolicyMatched?: boolean;
  confidenceBand?: string | null;
  criticalFieldConflictPresent?: boolean;
  falseSafeCandidate?: boolean;
  templateFingerprint?: string | null;
  exclusionMatched?: boolean;
  finalAutoVerifyAllowed?: boolean;
  autoVerifyBlockReason?: string | null;
}

export async function logShadowComparison(input: ComparisonInput): Promise<void> {
  try {
    const mismatchCategory = classifyMismatch(input);
    const reviewTags = computeReviewTags(input, mismatchCategory);
    const isReviewCandidate = reviewTags.length > 0;

    await db.$executeRawUnsafe(
      `INSERT INTO "ShadowComparisonLog" (
        "id", "requestId", "orgId", "documentId",
        "documentTypeByRules", "verificationByRules", "taskMappingByRules", "dedupOutcomeByRules",
        "documentTypeByAi", "verificationByAi", "taskMappingByAi", "dedupOutcomeByAiIfApplied",
        "mismatchCategory", "confidence", "schemaValid", "fallbackReason",
        "aiLatencyMs", "tokenUsage", "provider", "model",
        "reviewTags", "isReviewCandidate",
        "processingPath", "canaryStage",
        "createdAt"
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13::"ShadowMismatchCategory", $14, $15, $16,
        $17, $18, $19, $20,
        $21::"ShadowReviewTag"[], $22,
        $23::"ProcessingPath", $24::"CanaryStage",
        NOW()
      )`,
      randomUUID(),
      input.requestId,
      input.orgId,
      input.documentId,
      input.rulesDocumentType,
      input.rulesVerification,
      input.rulesTaskMapping,
      input.rulesDedup,
      input.aiDocumentType,
      input.aiVerification,
      input.aiTaskMapping,
      input.aiDedup,
      mismatchCategory,
      input.confidence,
      input.schemaValid,
      input.fallbackReason,
      input.aiLatencyMs,
      input.tokenUsage,
      input.provider,
      input.model,
      reviewTags,
      isReviewCandidate,
      input.processingPath ?? "rules",
      input.canaryStage ?? null,
    );
  } catch (err) {
    console.warn("[ShadowComparison] 로그 기록 실패:", err);
  }
}

function classifyMismatch(input: ComparisonInput): MismatchCategory {
  // Fallback 관련 (AI 결과 없음)
  if (input.fallbackReason) {
    if (input.fallbackReason.includes("timeout")) return "TIMEOUT_FALLBACK";
    if (input.fallbackReason.includes("provider") || input.fallbackReason.includes("API"))
      return "PROVIDER_ERROR_FALLBACK";
    if (input.fallbackReason.includes("schema")) return "SCHEMA_INVALID_FALLBACK";
    if (input.fallbackReason.includes("confidence")) return "LOW_CONFIDENCE_FALLBACK";
    return "PROVIDER_ERROR_FALLBACK";
  }

  if (!input.schemaValid) return "SCHEMA_INVALID_FALLBACK";

  // AI 결과 비교
  if (input.aiDocumentType === "UNKNOWN" && input.rulesDocumentType !== "UNKNOWN")
    return "UNKNOWN_CLASSIFICATION";

  if (input.aiDocumentType && input.rulesDocumentType && input.aiDocumentType !== input.rulesDocumentType)
    return "DOC_TYPE_DIFF";

  // Auto-verify risk: AI = AUTO_VERIFIED인데 Rules = REVIEW_NEEDED or MISMATCH
  if (
    input.aiVerification === "AUTO_VERIFIED" &&
    input.rulesVerification &&
    input.rulesVerification !== "AUTO_VERIFIED"
  )
    return "AUTO_VERIFY_RISK";

  if (input.aiVerification && input.rulesVerification && input.aiVerification !== input.rulesVerification)
    return "VERIFICATION_DIFF";

  if (input.aiTaskMapping && input.rulesTaskMapping && input.aiTaskMapping !== input.rulesTaskMapping)
    return "TASK_MAPPING_DIFF";

  return "NO_DIFF";
}

function computeReviewTags(
  input: ComparisonInput,
  category: MismatchCategory,
): ShadowReviewTag[] {
  const tags: ShadowReviewTag[] = [];

  // AI = Auto verify 인데 Rules = Manual review
  if (
    input.aiVerification === "AUTO_VERIFIED" &&
    (input.rulesVerification === "REVIEW_NEEDED" || input.rulesVerification === "MISMATCH")
  ) {
    tags.push("AI_AUTO_VERIFY_VS_RULES_MANUAL");
  }

  // Document type 불일치
  if (category === "DOC_TYPE_DIFF") {
    tags.push("DOC_TYPE_CONFLICT");
  }

  // Confidence High인데 Rules와 충돌
  if (input.confidence && input.confidence >= 0.8 && category !== "NO_DIFF") {
    tags.push("HIGH_CONFIDENCE_RULES_CONFLICT");
  }

  return tags;
}
