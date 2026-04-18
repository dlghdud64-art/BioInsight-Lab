/**
 * ══════════════════════════════════════════════════════════
 * Package A — PipelineOrchestrator
 * ══════════════════════════════════════════════════════════
 *
 * Ingestion → Classification → Extraction → Entity Linking
 * → Verification → Work Queue Dispatch → Audit Trail
 *
 * 단일 IngestionEntry를 기준으로 전체 Stage를 순차 실행합니다.
 * 각 Stage의 성공/실패를 IngestionEntry와 IngestionAuditLog에 기록합니다.
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

import { ClassificationProcessor } from "./processors/classification-processor";
import { ExtractionProcessor } from "./processors/extraction-processor";
import { EntityLinkingProcessor } from "./processors/entity-linking-processor";
import { VerificationProcessor } from "./processors/verification-processor";
import { findTaskMapping, buildDedupKey } from "./task-mapping";

import type {
  IngestionInput,
  PipelineExecutionResult,
  PipelineStage,
  IPipelineOrchestrator,
  ExtractionResult,
  VerificationResult,
} from "./types";

// ── Feature Flags (Stage별 Runtime 제어) ──
const FEATURE_FLAGS = {
  ENABLE_INGESTION_RUNTIME: process.env.ENABLE_INGESTION_RUNTIME !== "false",
  ENABLE_CLASSIFICATION_RUNTIME: process.env.ENABLE_CLASSIFICATION_RUNTIME !== "false",
  ENABLE_EXTRACTION_RUNTIME: process.env.ENABLE_EXTRACTION_RUNTIME !== "false",
  ENABLE_ENTITY_LINKING_RUNTIME: process.env.ENABLE_ENTITY_LINKING_RUNTIME !== "false",
  ENABLE_VERIFICATION_RUNTIME: process.env.ENABLE_VERIFICATION_RUNTIME !== "false",
  ENABLE_WORK_QUEUE_RUNTIME: process.env.ENABLE_WORK_QUEUE_RUNTIME !== "false",
} as const;

/** Runtime observability: Stage별 trace 정보 */
interface StageTrace {
  stage: PipelineStage;
  startMs: number;
  endMs: number;
  durationMs: number;
  success: boolean;
  error?: string;
  dedupHit?: boolean;
}

export class PipelineOrchestrator implements IPipelineOrchestrator {
  private classificationProcessor = new ClassificationProcessor();
  private extractionProcessor = new ExtractionProcessor();
  private entityLinkingProcessor = new EntityLinkingProcessor();
  private verificationProcessor = new VerificationProcessor();

  async execute(input: IngestionInput): Promise<PipelineExecutionResult> {
    // Feature Flag: 전체 파이프라인 비활성화 시
    if (!FEATURE_FLAGS.ENABLE_INGESTION_RUNTIME) {
      return {
        ingestionEntryId: "",
        completedStages: [],
        error: "INGESTION_RUNTIME disabled by feature flag",
        summary: { documentType: null, linkedEntityType: null, linkedEntityId: null, verificationStatus: null, workQueueTaskId: null },
        totalDurationMs: 0,
      };
    }

    const totalStart = Date.now();
    const completedStages: PipelineStage[] = [];
    const traces: StageTrace[] = [];

    // ── Stage 0: Ingestion — IngestionEntry 생성 ──
    let ingestionEntryId: string;
    try {
      const entry = await db.ingestionEntry.create({
        data: {
          organizationId: input.organizationId,
          sourceType: input.sourceType,
          sourceRef: input.sourceRef ?? null,
          filename: input.filename ?? null,
          mimeType: input.mimeType ?? null,
          uploaderId: input.uploaderId ?? null,
          rawTextRef: input.rawText,
          metadata: (input.metadata ?? {}) as Prisma.JsonObject,
        },
      });
      ingestionEntryId = entry.id;
      completedStages.push("INGESTION");

      await this.writeAudit(ingestionEntryId, "INGESTION_RECEIVED", {
        after: { sourceType: input.sourceType, filename: input.filename },
      });
    } catch (error: unknown) {
      return {
        ingestionEntryId: "",
        completedStages: [],
        failedStage: "INGESTION",
        error: error instanceof Error ? error.message : String(error),
        summary: { documentType: null, linkedEntityType: null, linkedEntityId: null, verificationStatus: null, workQueueTaskId: null },
        totalDurationMs: Date.now() - totalStart,
      };
    }

    // ── Stage 1: Classification ──
    let documentType = "UNKNOWN";
    let classificationConfidence = 0;
    try {
      const classResult = await this.classificationProcessor.process({
        ingestionEntryId,
        rawText: input.rawText,
        filename: input.filename,
        mimeType: input.mimeType,
      });

      if (classResult.success && classResult.data) {
        documentType = classResult.data.documentType;
        classificationConfidence = classResult.data.confidence;

        await db.ingestionEntry.update({
          where: { id: ingestionEntryId },
          data: {
            documentType: documentType as any,
            classificationConfidence,
            classifiedAt: new Date(),
          },
        });
      }

      completedStages.push("CLASSIFICATION");
      await this.writeAudit(ingestionEntryId, "DOCUMENT_CLASSIFIED", {
        after: { documentType, classificationConfidence },
        confidence: classificationConfidence,
        durationMs: classResult.durationMs,
      });
    } catch (error: unknown) {
      await this.recordFailure(ingestionEntryId, "CLASSIFICATION", error);
      return this.buildResult(ingestionEntryId, completedStages, "CLASSIFICATION", error, totalStart);
    }

    // ── Stage 2: Extraction ──
    let extractionResult: ExtractionResult | null = null;
    try {
      const extResult = await this.extractionProcessor.process({
        ingestionEntryId,
        rawText: input.rawText,
        documentType,
      });

      if (extResult.data) {
        extractionResult = extResult.data.extractionResult;

        await db.ingestionEntry.update({
          where: { id: ingestionEntryId },
          data: {
            extractionResult: extractionResult as unknown as Prisma.JsonObject,
            extractedAt: new Date(),
          },
        });
      }

      completedStages.push("EXTRACTION");
      await this.writeAudit(ingestionEntryId, "EXTRACTION_COMPLETED", {
        after: {
          overallConfidence: extractionResult?.overallConfidence ?? 0,
          lineItemCount: extractionResult?.lineItems.length ?? 0,
        },
        confidence: extractionResult?.overallConfidence,
        durationMs: extResult.durationMs,
      });
    } catch (error: unknown) {
      await this.recordFailure(ingestionEntryId, "EXTRACTION", error);
      return this.buildResult(ingestionEntryId, completedStages, "EXTRACTION", error, totalStart);
    }

    // ── Stage 3: Entity Linking ──
    let linkedEntityType: string | null = null;
    let linkedEntityId: string | null = null;
    let linkingConfidence: number | null = null;
    try {
      const linkResult = await this.entityLinkingProcessor.process({
        ingestionEntryId,
        organizationId: input.organizationId,
        extractionResult: extractionResult ?? ({} as ExtractionResult),
        documentType,
      });

      const bestMatch = linkResult.data?.linkingResult.bestMatch;
      if (bestMatch) {
        linkedEntityType = bestMatch.entityType;
        linkedEntityId = bestMatch.entityId;
        linkingConfidence = bestMatch.confidence;

        await db.ingestionEntry.update({
          where: { id: ingestionEntryId },
          data: {
            linkedEntityType,
            linkedEntityId,
            linkingConfidence,
            linkedAt: new Date(),
          },
        });
      }

      completedStages.push("ENTITY_LINKING");
      await this.writeAudit(ingestionEntryId, "ENTITY_LINKED", {
        after: {
          linkedEntityType,
          linkedEntityId,
          linkingConfidence,
          strategiesUsed: linkResult.data?.linkingResult.strategiesUsed,
        },
        confidence: linkingConfidence ?? undefined,
        durationMs: linkResult.durationMs,
      });

      // Entity 없으면 Verification 건너뜀
      if (!linkedEntityId && !linkResult.continueToNext) {
        return {
          ingestionEntryId,
          completedStages,
          summary: { documentType, linkedEntityType, linkedEntityId, verificationStatus: null, workQueueTaskId: null },
          totalDurationMs: Date.now() - totalStart,
        };
      }
    } catch (error: unknown) {
      await this.recordFailure(ingestionEntryId, "ENTITY_LINKING", error);
      return this.buildResult(ingestionEntryId, completedStages, "ENTITY_LINKING", error, totalStart);
    }

    // ── Stage 4: Verification ──
    let verificationResult: VerificationResult | null = null;
    try {
      if (linkedEntityType && linkedEntityId) {
        const verResult = await this.verificationProcessor.process({
          ingestionEntryId,
          organizationId: input.organizationId,
          extractionResult: extractionResult ?? ({} as ExtractionResult),
          linkedEntityType,
          linkedEntityId,
          documentType,
        });

        if (verResult.data) {
          verificationResult = verResult.data.verificationResult;

          const auditAction = this.getVerificationAuditAction(verificationResult.status);

          await db.ingestionEntry.update({
            where: { id: ingestionEntryId },
            data: {
              verificationStatus: verificationResult.status as any,
              verificationReason: verificationResult.reason,
              mismatchedFields: verificationResult.mismatchedFields as unknown as Prisma.JsonArray,
              missingFields: verificationResult.missingFields as unknown as Prisma.JsonArray,
              policyFlags: verificationResult.policyFlags as unknown as Prisma.JsonObject,
              approvalRequired: verificationResult.policyFlags.approvalRequired,
              verifiedAt: new Date(),
            },
          });

          completedStages.push("VERIFICATION");
          await this.writeAudit(ingestionEntryId, auditAction, {
            after: {
              verificationStatus: verificationResult.status,
              reason: verificationResult.reason,
              mismatchedFields: verificationResult.mismatchedFields,
              missingFields: verificationResult.missingFields,
              policyFlags: verificationResult.policyFlags,
            },
            durationMs: verResult.durationMs,
          });
        }
      }
    } catch (error: unknown) {
      await this.recordFailure(ingestionEntryId, "VERIFICATION", error);
      return this.buildResult(ingestionEntryId, completedStages, "VERIFICATION", error, totalStart);
    }

    // ── Stage 5: Work Queue Dispatch ──
    let workQueueTaskId: string | null = null;
    try {
      if (verificationResult) {
        const mapping = findTaskMapping(
          verificationResult.status,
          documentType,
          verificationResult.policyFlags as Record<string, unknown>,
        );

        if (mapping) {
          // Dedup check
          const context: Record<string, string> = {
            linkedEntityId: linkedEntityId ?? "NONE",
            [mapping.task.taskType]: mapping.task.taskType,
          };
          const dedupKey = buildDedupKey(mapping, context);

          const windowStart = new Date(Date.now() - mapping.dedupKey.windowHours * 60 * 60 * 1000);
          const existing = await db.aiActionItem.findFirst({
            where: {
              organizationId: input.organizationId,
              substatus: dedupKey,
              createdAt: { gte: windowStart },
              status: { in: ["PENDING", "APPROVED", "EXECUTING"] },
            },
            select: { id: true },
          });

          if (existing) {
            // 중복 → Task 미생성
            await this.writeAudit(ingestionEntryId, "WORK_QUEUE_TASK_CREATED", {
              after: { skipped: true, reason: "dedup_collision", existingTaskId: existing.id, dedupKey },
            });
          } else {
            // Task 생성
            const title = this.renderTemplate(mapping.task.titleTemplate, extractionResult, verificationResult);
            const summary = this.renderTemplate(mapping.task.summaryTemplate, extractionResult, verificationResult);

            const task = await db.aiActionItem.create({
              data: {
                type: mapping.task.type as any,
                status: "PENDING",
                priority: mapping.task.priority as any,
                taskStatus: mapping.task.taskStatus as any,
                approvalStatus: mapping.task.approvalStatus as any,
                substatus: dedupKey,
                userId: input.uploaderId ?? "SYSTEM",
                organizationId: input.organizationId,
                title,
                summary,
                payload: {
                  ingestionEntryId,
                  documentType,
                  linkedEntityType,
                  linkedEntityId,
                  verificationStatus: verificationResult.status,
                  mismatchedFields: verificationResult.mismatchedFields,
                  missingFields: verificationResult.missingFields,
                  policyFlags: verificationResult.policyFlags,
                } as unknown as Prisma.JsonObject,
                relatedEntityType: linkedEntityType,
                relatedEntityId: linkedEntityId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            });

            workQueueTaskId = task.id;

            await db.ingestionEntry.update({
              where: { id: ingestionEntryId },
              data: {
                workQueueTaskId: task.id,
                workQueueTaskType: mapping.task.taskType as any,
              },
            });

            await this.writeAudit(ingestionEntryId, "WORK_QUEUE_TASK_CREATED", {
              after: { taskId: task.id, taskType: mapping.task.taskType, dedupKey, priority: mapping.task.priority },
            });
          }
        }
        // AUTO_VERIFIED + no policy flags → no task (정상)
      }

      completedStages.push("WORK_QUEUE_DISPATCH");
    } catch (error: unknown) {
      await this.recordFailure(ingestionEntryId, "WORK_QUEUE_DISPATCH", error);
      return this.buildResult(ingestionEntryId, completedStages, "WORK_QUEUE_DISPATCH", error, totalStart);
    }

    completedStages.push("AUDIT_TRAIL");

    // ── Observability: runtime_metadata 저장 ──
    const totalDurationMs = Date.now() - totalStart;
    try {
      await db.ingestionEntry.update({
        where: { id: ingestionEntryId },
        data: {
          metadata: {
            ...(input.metadata ?? {}),
            runtime: {
              completedStages,
              totalDurationMs,
              traceCount: traces.length,
              featureFlags: FEATURE_FLAGS,
            },
          } as any,
        },
      });
    } catch { /* observability write failure is non-fatal */ }

    console.log(
      `[Pipeline] ✅ ${ingestionEntryId} | ${documentType} | ${verificationResult?.status ?? "N/A"} | ${completedStages.length} stages | ${totalDurationMs}ms`,
    );

    return {
      ingestionEntryId,
      completedStages,
      summary: {
        documentType,
        linkedEntityType,
        linkedEntityId,
        verificationStatus: verificationResult?.status ?? null,
        workQueueTaskId,
      },
      totalDurationMs,
    };
  }

  // ── Helpers ──

  private async writeAudit(
    ingestionEntryId: string,
    action: string,
    opts: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      confidence?: number;
      durationMs?: number;
      errorMessage?: string;
    } = {},
  ): Promise<void> {
    try {
      await db.ingestionAuditLog.create({
        data: {
          ingestionEntryId,
          action: action as any,
          actorType: "SYSTEM",
          before: opts.before ? (opts.before as Prisma.JsonObject) : undefined,
          after: opts.after ? (opts.after as Prisma.JsonObject) : undefined,
          confidence: opts.confidence ?? null,
          durationMs: opts.durationMs ?? null,
          errorMessage: opts.errorMessage ?? null,
        },
      });
    } catch (err) {
      console.warn("[IngestionAudit] 기록 실패:", err);
    }
  }

  private async recordFailure(
    ingestionEntryId: string,
    stage: string,
    error: unknown,
  ): Promise<void> {
    const errMsg = error instanceof Error ? error.message : String(error);
    try {
      await db.ingestionEntry.update({
        where: { id: ingestionEntryId },
        data: { errorMessage: `[${stage}] ${errMsg}` },
      });
    } catch { /* ignore */ }
  }

  private getVerificationAuditAction(status: string): string {
    switch (status) {
      case "AUTO_VERIFIED": return "VERIFICATION_AUTO_VERIFIED";
      case "REVIEW_NEEDED": return "VERIFICATION_REVIEW_REQUESTED";
      case "MISMATCH": return "VERIFICATION_MISMATCH_DETECTED";
      case "MISSING": return "VERIFICATION_MISSING_DETECTED";
      default: return "VERIFICATION_REVIEW_REQUESTED";
    }
  }

  private renderTemplate(
    template: string,
    extraction: ExtractionResult | null,
    verification: VerificationResult,
  ): string {
    let result = template;
    if (extraction) {
      result = result
        .replace("{{vendorName}}", extraction.vendorName.value ?? "알 수 없는 벤더")
        .replace("{{amount}}", extraction.totalAmount.value?.toLocaleString() ?? "—")
        .replace("{{orderNumber}}", extraction.orderNumber.value ?? "—")
        .replace("{{documentType}}", extraction.documentNumber.value ?? "—");
    }
    result = result.replace("{{mismatchedFields}}", verification.mismatchedFields.join(", ") || "—");
    result = result.replace("{{missingFields}}", verification.missingFields.join(", ") || "—");
    return result;
  }

  private buildResult(
    ingestionEntryId: string,
    completedStages: PipelineStage[],
    failedStage: PipelineStage,
    error: unknown,
    totalStart: number,
  ): PipelineExecutionResult {
    return {
      ingestionEntryId,
      completedStages,
      failedStage,
      error: error instanceof Error ? error.message : String(error),
      summary: { documentType: null, linkedEntityType: null, linkedEntityId: null, verificationStatus: null, workQueueTaskId: null },
      totalDurationMs: Date.now() - totalStart,
    };
  }
}
