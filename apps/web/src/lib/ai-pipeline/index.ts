/**
 * Package A — 통합 AI 운영 레이어 공통 모듈 Barrel Export
 */

// ── A-3 ~ A-7: 공통 타입 정의 ──
export type {
  // A-3: Extraction
  ExtractedField,
  ExtractedLineItem,
  ExtractionResult,
  // A-4: Entity Linking
  LinkedEntityType,
  EntityLinkCandidate,
  EntityLinkingResult,
  // A-5: Verification
  FieldVerificationDetail,
  VerificationResult,
  // A-6: Work Queue Task
  WorkQueueTaskMapping,
  CreateWorkQueueTaskRequest,
  // A-7: Audit Trail
  CreateIngestionAuditRequest,
  // Pipeline Stages
  PipelineStage,
  StageResult,
  IngestionInput,
  IngestionOutput,
  ClassificationInput,
  ClassificationOutput,
  ExtractionInput,
  ExtractionOutput,
  EntityLinkingInput,
  EntityLinkingOutput,
  VerificationInput,
  VerificationOutput,
  WorkQueueDispatchInput,
  WorkQueueDispatchOutput,
  // Orchestrator
  IPipelineOrchestrator,
  PipelineExecutionResult,
  IStageProcessor,
  IClassificationProcessor,
  IExtractionProcessor,
  IEntityLinkingProcessor,
  IVerificationProcessor,
  IWorkQueueDispatcher,
} from "./types";

// ── A-6: Task Mapping 로직 ──
export { TASK_MAPPING_TABLE, findTaskMapping, buildDedupKey } from "./task-mapping";
