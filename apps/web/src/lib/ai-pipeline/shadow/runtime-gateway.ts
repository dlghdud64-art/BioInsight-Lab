/**
 * Shadow Runtime Gateway
 *
 * 기존 PipelineOrchestrator 앞단에 위치하여:
 * 1. AI_RUNTIME_ENABLED=false → Rules Path만 실행 (기존과 Byte-level 일치)
 * 2. AI_SHADOW_MODE=true → Rules Path 실행 후 AI Path 병렬 실행, 비교 로그만 기록
 * 3. AI_SHADOW_MODE=false + enabled → Active 모드 (향후)
 *
 * 핵심 원칙: Shadow 모드에서 사용자-facing Write 결과 변경 Zero.
 */

import { randomUUID } from "crypto";
import { PipelineOrchestrator } from "../orchestrator";
import { ClassificationProcessor } from "../processors/classification-processor";
import { loadShadowConfig, isInRollout } from "./config";
import { logShadowComparison } from "./comparison-logger";
import { findTaskMapping } from "../task-mapping";

import type { IngestionInput, PipelineExecutionResult } from "../types";

export class ShadowRuntimeGateway {
  private orchestrator = new PipelineOrchestrator();
  private aiClassifier = new ClassificationProcessor();

  /**
   * 메인 진입점: Shadow 모드에서는 Rules Path만 persist하고
   * AI Path는 비교 로그만 기록.
   */
  async execute(input: IngestionInput): Promise<PipelineExecutionResult> {
    const config = loadShadowConfig();
    const requestId = randomUUID();

    // AI 비활성 → 기존 Rules Path 그대로 실행
    if (!config.enabled) {
      return this.orchestrator.execute(input);
    }

    // Rollout 대상이 아닌 경우 → Rules Path만
    if (!isInRollout(requestId, config.rolloutPercent) && config.rolloutPercent < 100) {
      return this.orchestrator.execute(input);
    }

    // ── Shadow 모드: Rules Path 실행 (실제 persist) ──
    const rulesResult = await this.orchestrator.execute(input);

    // ── AI Path 비교 실행 (persist 없음, 비교 로그만) ──
    if (config.shadowMode) {
      const shadowFn = () =>
        this.runAiShadow(requestId, input, rulesResult, config);

      if (config.asyncShadow) {
        // 비동기: Rules 응답 즉시 반환, AI는 백그라운드
        shadowFn().catch((err) =>
          console.warn("[ShadowGateway] 비동기 Shadow 실패:", err),
        );
      } else {
        // 동기: AI 완료 후 반환 (디버깅용)
        await shadowFn().catch((err) =>
          console.warn("[ShadowGateway] 동기 Shadow 실패:", err),
        );
      }
    }

    // 항상 Rules 결과만 반환 (Zero-impact 보장)
    return rulesResult;
  }

  /**
   * AI Shadow Path: DB write 없이 AI 결과만 생성하고 비교 로그 기록
   */
  private async runAiShadow(
    requestId: string,
    input: IngestionInput,
    rulesResult: PipelineExecutionResult,
    config: { provider: string; model: string; timeoutMs: number; minConfidence: number },
  ): Promise<void> {
    const start = Date.now();
    let aiDocType: string | null = null;
    let aiVerification: string | null = null;
    let aiTaskMapping: string | null = null;
    let aiDedup: string | null = null;
    let confidence: number | null = null;
    let schemaValid = true;
    let fallbackReason: string | null = null;
    let tokenUsage: number | null = null;

    try {
      // AI Classification (실제 OpenAI 호출 — API 키 있으면)
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
        aiDocType = classResult.data.documentType;
        confidence = classResult.data.confidence;

        // Confidence gate
        if (confidence < config.minConfidence) {
          fallbackReason = `confidence_below_threshold:${confidence}<${config.minConfidence}`;
          aiDocType = null;
        }
      } else {
        fallbackReason = classResult.error ?? "classification_failed";
      }

      // AI Verification/TaskMapping 시뮬레이션 (DB entity 없이 추론)
      if (aiDocType && aiDocType !== "UNKNOWN") {
        // Verification은 실제 entity linking 없이 시뮬레이션 불가
        // Rules 결과의 verification 상태를 기반으로 task mapping만 비교
        const rulesVerStatus = rulesResult.summary.verificationStatus;
        if (rulesVerStatus) {
          aiVerification = rulesVerStatus; // same entity → same verification 가정
          const mapping = findTaskMapping(rulesVerStatus, aiDocType);
          aiTaskMapping = mapping?.task.taskType ?? null;
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      fallbackReason = errMsg.includes("timeout") ? "timeout" : `provider_error:${errMsg}`;
    }

    const aiLatencyMs = Date.now() - start;

    // ── Rules 결과 추출 ──
    const rulesDocType = rulesResult.summary.documentType;
    const rulesVerification = rulesResult.summary.verificationStatus;
    let rulesTaskMapping: string | null = null;
    if (rulesVerification && rulesDocType) {
      const mapping = findTaskMapping(rulesVerification, rulesDocType);
      rulesTaskMapping = mapping?.task.taskType ?? null;
    }

    // ── 비교 로그 기록 ──
    await logShadowComparison({
      requestId,
      orgId: input.organizationId,
      documentId: rulesResult.ingestionEntryId || null,
      rulesDocumentType: rulesDocType,
      rulesVerification,
      rulesTaskMapping,
      rulesDedup: null,
      aiDocumentType: aiDocType,
      aiVerification,
      aiTaskMapping,
      aiDedup: aiDedup,
      confidence,
      schemaValid,
      fallbackReason,
      aiLatencyMs,
      tokenUsage,
      provider: config.provider,
      model: config.model,
    });
  }
}
