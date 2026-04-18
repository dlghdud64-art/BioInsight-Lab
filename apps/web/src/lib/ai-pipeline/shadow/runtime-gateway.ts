/**
 * Shadow Runtime Gateway (v2 — Canary Rollout)
 *
 * 카나리 라우팅 순서:
 * 1. Global Enabled 확인
 * 2. Rules Path 실행 (항상 먼저 — persist 기준)
 * 3. Doc Type Canary Stage 조회
 * 4. Stable Bucket 판정 (hash(orgId + documentId) % 100)
 * 5. processingPath 결정 → rules / ai_shadow / ai_active_canary / ai_active_full / ai_fallback
 *
 * 불변조건:
 * - Dedup key, Task mapping, Org scope, Unknown Auto-verify 금지 — 모든 경로 유지
 * - Schema Invalid / Timeout / Low Confidence → 100% Fallback
 * - Active 모드에서도 비교 로그 상시 기록
 * - allowAutoVerify=false(기본) → AI AUTO_VERIFIED 시 Fallback
 */

import { randomUUID } from "crypto";
import { PipelineOrchestrator } from "../orchestrator";
import { ClassificationProcessor } from "../processors/classification-processor";
import { loadCanaryConfig, getDocTypeConfig, resolveProcessingPath } from "./canary-config";
import { loadShadowConfig } from "./config";
import { logShadowComparison } from "./comparison-logger";
import { checkCircuitBreaker } from "./circuit-breaker";
import { findTaskMapping } from "../task-mapping";

import type { IngestionInput, PipelineExecutionResult } from "../types";
import type { ProcessingPath, MismatchCategory } from "./types";

interface AiPathResult {
  aiDocType: string | null;
  aiVerification: string | null;
  aiTaskMapping: string | null;
  confidence: number | null;
  schemaValid: boolean;
  fallbackReason: string | null;
  aiLatencyMs: number;
  tokenUsage: number | null;
}

export class ShadowRuntimeGateway {
  private orchestrator = new PipelineOrchestrator();
  private aiClassifier = new ClassificationProcessor();

  async execute(input: IngestionInput): Promise<PipelineExecutionResult> {
    const shadowConfig = loadShadowConfig();
    const canaryConfig = loadCanaryConfig();
    const requestId = randomUUID();

    // AI 전체 비활성 → Rules Path 그대로
    if (!canaryConfig.globalEnabled && !shadowConfig.enabled) {
      return this.orchestrator.execute(input);
    }

    // ── Rules Path 실행 (항상 먼저 — 실제 persist) ──
    const rulesResult = await this.orchestrator.execute(input);
    const rulesDocType = rulesResult.summary.documentType ?? "UNKNOWN";

    // ── processingPath 결정 ──
    const path = resolveProcessingPath(
      canaryConfig,
      rulesDocType,
      input.organizationId,
      rulesResult.ingestionEntryId || requestId,
    );

    // rules → 비교 로그 없이 즉시 반환
    if (path === "rules") {
      return rulesResult;
    }

    const docConfig = getDocTypeConfig(canaryConfig, rulesDocType);

    // ── AI Path 실행 ──
    const aiResult = await this.runAiPath(requestId, input, rulesResult, shadowConfig);

    // ── 비교 로그 기록 (Shadow/Active 모두 상시) ──
    await logShadowComparison({
      requestId,
      orgId: input.organizationId,
      documentId: rulesResult.ingestionEntryId || null,
      rulesDocumentType: rulesDocType,
      rulesVerification: rulesResult.summary.verificationStatus,
      rulesTaskMapping: this.resolveRulesTaskMapping(rulesResult),
      rulesDedup: null,
      aiDocumentType: aiResult.aiDocType,
      aiVerification: aiResult.aiVerification,
      aiTaskMapping: aiResult.aiTaskMapping,
      aiDedup: null,
      confidence: aiResult.confidence,
      schemaValid: aiResult.schemaValid,
      fallbackReason: aiResult.fallbackReason,
      aiLatencyMs: aiResult.aiLatencyMs,
      tokenUsage: aiResult.tokenUsage,
      provider: shadowConfig.provider,
      model: shadowConfig.model,
      processingPath: path,
      canaryStage: docConfig.stage,
    });

    // ── 서킷 브레이커 검사 ──
    const mismatchCategory = this.classifyForCircuitBreaker(aiResult, rulesResult);
    const cbResult = await checkCircuitBreaker({
      documentType: rulesDocType,
      currentStage: docConfig.stage,
      mismatchCategory,
      processingPath: path,
      requestId,
    });

    if (cbResult.halted) {
      return rulesResult;
    }

    // Shadow → Rules 결과만 반환
    if (path === "ai_shadow") {
      return rulesResult;
    }

    // Active Canary/Full → 불변조건 + Fallback 검증 후에도 현재는 Rules 결과 반환
    // (AI Write 반영은 향후 확장 포인트 — 현재 단계에서는 비교 로그만)
    if (path === "ai_active_canary" || path === "ai_active_full") {
      if (aiResult.fallbackReason || !aiResult.schemaValid || !aiResult.aiDocType) {
        return rulesResult; // 100% Fallback
      }

      // Unknown Auto-verify 금지
      if (aiResult.aiDocType === "UNKNOWN" && aiResult.aiVerification === "AUTO_VERIFIED") {
        return rulesResult;
      }

      // allowAutoVerify=false → AI AUTO_VERIFIED 시 Fallback
      if (!docConfig.allowAutoVerify && aiResult.aiVerification === "AUTO_VERIFIED") {
        return rulesResult;
      }
    }

    // 항상 Rules 결과 반환 (Zero-impact)
    return rulesResult;
  }

  private classifyForCircuitBreaker(
    aiResult: AiPathResult,
    rulesResult: PipelineExecutionResult,
  ): MismatchCategory {
    if (aiResult.fallbackReason) {
      if (aiResult.fallbackReason.includes("timeout")) return "TIMEOUT_FALLBACK";
      return "PROVIDER_ERROR_FALLBACK";
    }

    if (
      aiResult.aiVerification === "AUTO_VERIFIED" &&
      rulesResult.summary.verificationStatus &&
      rulesResult.summary.verificationStatus !== "AUTO_VERIFIED"
    )
      return "AUTO_VERIFY_RISK";

    if (aiResult.aiDocType && rulesResult.summary.documentType &&
        aiResult.aiDocType !== rulesResult.summary.documentType)
      return "DOC_TYPE_DIFF";

    const rulesTaskMapping = this.resolveRulesTaskMapping(rulesResult);
    if (aiResult.aiTaskMapping && rulesTaskMapping && aiResult.aiTaskMapping !== rulesTaskMapping)
      return "TASK_MAPPING_DIFF";

    return "NO_DIFF";
  }

  private resolveRulesTaskMapping(rulesResult: PipelineExecutionResult): string | null {
    const { verificationStatus, documentType } = rulesResult.summary;
    if (!verificationStatus || !documentType) return null;
    const mapping = findTaskMapping(verificationStatus, documentType);
    return mapping?.task.taskType ?? null;
  }

  private async runAiPath(
    requestId: string,
    input: IngestionInput,
    rulesResult: PipelineExecutionResult,
    config: { provider: string; model: string; timeoutMs: number; minConfidence: number },
  ): Promise<AiPathResult> {
    const start = Date.now();
    const result: AiPathResult = {
      aiDocType: null,
      aiVerification: null,
      aiTaskMapping: null,
      confidence: null,
      schemaValid: true,
      fallbackReason: null,
      aiLatencyMs: 0,
      tokenUsage: null,
    };

    try {
      const classResult = await Promise.race([
        this.aiClassifier.process({
          ingestionEntryId: rulesResult.ingestionEntryId || "shadow",
          rawText: input.rawText,
          filename: input.filename,
          mimeType: input.mimeType,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), config.timeoutMs),
        ),
      ]);

      if (classResult.success && classResult.data) {
        result.aiDocType = classResult.data.documentType;
        result.confidence = classResult.data.confidence;

        if (result.confidence < config.minConfidence) {
          result.fallbackReason = `confidence_below_threshold:${result.confidence}<${config.minConfidence}`;
          result.aiDocType = null;
        }
      } else {
        result.fallbackReason = classResult.error ?? "classification_failed";
      }

      if (result.aiDocType && result.aiDocType !== "UNKNOWN") {
        const rulesVerStatus = rulesResult.summary.verificationStatus;
        if (rulesVerStatus) {
          result.aiVerification = rulesVerStatus;
          const mapping = findTaskMapping(rulesVerStatus, result.aiDocType);
          result.aiTaskMapping = mapping?.task.taskType ?? null;
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.fallbackReason = errMsg.includes("timeout") ? "timeout" : `provider_error:${errMsg}`;
    }

    result.aiLatencyMs = Date.now() - start;
    return result;
  }
}
